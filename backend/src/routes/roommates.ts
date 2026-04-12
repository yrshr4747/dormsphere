import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/roommates/status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    
    // Check if user HAS an accepted partner
    const { rows: acceptedRows } = await query(
      `SELECT rp.id, rp.status, 
         CASE WHEN rp.inviter_id = $1 THEN u2.name ELSE u1.name END AS partner_name,
         CASE WHEN rp.inviter_id = $1 THEN u2.roll_number ELSE u1.roll_number END AS partner_roll
       FROM roommate_pairings rp
       JOIN students u1 ON rp.inviter_id = u1.id
       JOIN students u2 ON rp.invitee_id = u2.id
       WHERE (rp.inviter_id = $1 OR rp.invitee_id = $1)
         AND rp.status = 'accepted'`,
      [studentId]
    );

    // List all incoming pending invitations
    const { rows: incomingRows } = await query(
      `SELECT rp.id, u1.name AS inviter_name, u1.roll_number AS inviter_roll
       FROM roommate_pairings rp
       JOIN students u1 ON rp.inviter_id = u1.id
       WHERE rp.invitee_id = $1 AND rp.status = 'pending'`,
      [studentId]
    );

    // List outgoing pending invitations
    const { rows: outgoingRows } = await query(
      `SELECT rp.id, u2.name AS invitee_name, u2.roll_number AS invitee_roll
       FROM roommate_pairings rp
       JOIN students u2 ON rp.invitee_id = u2.id
       WHERE rp.inviter_id = $1 AND rp.status = 'pending'`,
      [studentId]
    );

    res.json({
      activePartner: acceptedRows[0] || null,
      incomingRequests: incomingRows,
      outgoingRequests: outgoingRows,
    });
  } catch (err) {
    console.error('Roommate status error:', err);
    res.status(500).json({ error: 'Failed to fetch roommate status.' });
  }
});

// POST /api/roommates/invite
router.post('/invite', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const inviterId = req.user!.id;
    const { rollNumber } = req.body;

    // Allotment lock: block invitations if wave is completed
    const { rows: lockCheck } = await query(
      "SELECT id FROM waves WHERE year_group = (SELECT year_group FROM students WHERE id = $1) AND status = 'completed' LIMIT 1",
      [inviterId]
    );
    if (lockCheck.length > 0) {
      res.status(403).json({ error: '🔒 Roommate invitations are locked. Allotment for your year group has been completed.' });
      return;
    }

    if (!rollNumber || rollNumber.toUpperCase() === req.user!.rollNumber) {
      res.status(400).json({ error: 'Invalid roll number.' });
      return;
    }

    // Check if inviter already has an accepted partner
    const { rows: existingAccepted } = await query(
      `SELECT id FROM roommate_pairings 
       WHERE (inviter_id = $1 OR invitee_id = $1) AND status = 'accepted'`,
      [inviterId]
    );
    if (existingAccepted.length > 0) {
      res.status(400).json({ error: 'You already have an accepted roommate.' });
      return;
    }

    // Fetch inviter's year group
    const { rows: inviterRows } = await query('SELECT year_group FROM students WHERE id = $1', [inviterId]);
    const inviterYearGroup = inviterRows[0].year_group;

    // Find the invitee
    const { rows: inviteeRows } = await query('SELECT id, year_group FROM students WHERE roll_number = $1', [rollNumber.toUpperCase()]);
    if (inviteeRows.length === 0) {
      res.status(404).json({ error: 'Student with this roll number not found.' });
      return;
    }
    const inviteeId = inviteeRows[0].id;
    const inviteeYearGroup = inviteeRows[0].year_group;

    if (inviterYearGroup !== inviteeYearGroup) {
      res.status(400).json({ error: 'Roommates must belong to the same year group.' });
      return;
    }

    // Check if invitee already has an accepted partner
    const { rows: inviteeAccepted } = await query(
      `SELECT id FROM roommate_pairings 
       WHERE (inviter_id = $1 OR invitee_id = $1) AND status = 'accepted'`,
      [inviteeId]
    );
    if (inviteeAccepted.length > 0) {
      res.status(400).json({ error: 'This student already has a confirmed roommate.' });
      return;
    }

    // Check if an invite already exists
    const { rows: existingInvite } = await query(
      `SELECT id FROM roommate_pairings 
       WHERE (inviter_id = $1 AND invitee_id = $2) OR (inviter_id = $2 AND invitee_id = $1)`,
      [inviterId, inviteeId]
    );

    if (existingInvite.length > 0) {
      res.status(409).json({ error: 'An invitation already exists between you two.' });
      return;
    }

    await query(
      `INSERT INTO roommate_pairings (inviter_id, invitee_id) VALUES ($1, $2)`,
      [inviterId, inviteeId]
    );

    res.json({ message: 'Invitation sent successfully! 🤝' });
  } catch (err) {
    console.error('Roommate invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation.' });
  }
});

// POST /api/roommates/respond
router.post('/respond', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const { pairingId, action } = req.body; // action = 'accept' or 'reject'

    if (!['accept', 'reject', 'cancel'].includes(action)) {
      res.status(400).json({ error: 'Invalid action.' });
      return;
    }

    // Verify pairing exists and user is involved
    const { rows: pairingRows } = await query(
      `SELECT * FROM roommate_pairings WHERE id = $1`,
      [pairingId]
    );
    if (pairingRows.length === 0) {
      res.status(404).json({ error: 'Invitation not found.' });
      return;
    }

    const pairing = pairingRows[0];
    const isInvitee = pairing.invitee_id === studentId;
    const isInviter = pairing.inviter_id === studentId;

    if (!isInvitee && !isInviter) {
      res.status(403).json({ error: 'Unauthorized to respond to this invitation.' });
      return;
    }

    if (action === 'cancel') {
      if (!isInviter) {
         res.status(403).json({ error: 'Only the inviter can cancel a request.' });
         return;
      }
      await query(`UPDATE roommate_pairings SET status = 'cancelled' WHERE id = $1`, [pairingId]);
      res.json({ message: 'Invitation cancelled.' });
      return;
    }

    if (!isInvitee) {
       res.status(403).json({ error: 'Only the invitee can accept or reject.' });
       return;
    }

    if (action === 'reject') {
      await query(`UPDATE roommate_pairings SET status = 'rejected' WHERE id = $1`, [pairingId]);
      res.json({ message: 'Invitation rejected.' });
      return;
    }

    // --- ACCPTANCE LOGIC ---
    // Check if inviter or invitee already managed to accept someone else in the meantime
    const { rows: safetyCheck } = await query(
      `SELECT id FROM roommate_pairings 
       WHERE (inviter_id IN ($1, $2) OR invitee_id IN ($1, $2)) 
         AND status = 'accepted'`,
      [pairing.inviter_id, pairing.invitee_id]
    );
    if (safetyCheck.length > 0) {
      res.status(409).json({ error: 'One of the users already has an accepted roommate.' });
      return;
    }

    // 1. Accept this specific pairing
    await query(`UPDATE roommate_pairings SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [pairingId]);

    // 2. Reject all other pending pairings for BOTH students
    await query(
      `UPDATE roommate_pairings 
       SET status = 'rejected' 
       WHERE (inviter_id IN ($1, $2) OR invitee_id IN ($1, $2))
         AND status = 'pending' AND id != $3`,
      [pairing.inviter_id, pairing.invitee_id, pairingId]
    );

    res.json({ message: '🤝 Roommate connection officially established!' });
  } catch (err) {
    console.error('Roommate respond error:', err);
    res.status(500).json({ error: 'Failed to respond to invitation.' });
  }
});

export default router;
