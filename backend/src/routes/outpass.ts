import { Router, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const OUTPASS_SECRET = process.env.OUTPASS_SECRET || 'outpass-hmac-secret-change-me';

function signOutpass(data: string): string {
  return crypto.createHmac('sha256', OUTPASS_SECRET).update(data).digest('hex');
}

function buildOutpassPayload(token: string, studentId: string, outTime: Date, expectedReturn: Date): string {
  return `${token}|${studentId}|${outTime.toISOString()}|${expectedReturn.toISOString()}`;
}

// POST /api/outpass/generate
router.post('/generate', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { purpose, destination, outTime, expectedReturn } = req.body;
    if (!purpose || !outTime || !expectedReturn) {
      res.status(400).json({ error: 'Purpose, out time, and expected return are required.' });
      return;
    }

    const outDate = new Date(outTime);
    const returnDate = new Date(expectedReturn);
    if (Number.isNaN(outDate.getTime()) || Number.isNaN(returnDate.getTime()) || returnDate <= outDate) {
      res.status(400).json({ error: 'Out time and expected return must be valid, and return must be after out time.' });
      return;
    }

    const qrToken = uuidv4();
    const payloadData = buildOutpassPayload(qrToken, req.user!.id, outDate, returnDate);
    const hmacSignature = signOutpass(payloadData);
    const qrPayload = JSON.stringify({ token: qrToken, sig: hmacSignature, student: req.user!.id });

    await query(
      'INSERT INTO outpasses (student_id, purpose, destination, out_time, expected_return, qr_token, hmac_signature) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user!.id, purpose, destination || '', outDate, returnDate, qrToken, hmacSignature],
    );

    res.json({ message: 'Outpass generated.', qrPayload, token: qrToken });
  } catch (err) {
    console.error('Outpass generate error:', err);
    res.status(500).json({ error: 'Outpass generation failed.' });
  }
});

// GET /api/outpass/verify/:token
router.get('/verify/:token', authenticate, authorize('guard', 'admin', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT o.*, s.name, s.roll_number, s.email, s.year, s.department
      FROM outpasses o
      JOIN students s ON s.id = o.student_id
      WHERE o.qr_token = $1
    `, [req.params.token]);

    if (rows.length === 0) {
      res.status(404).json({ valid: false, error: 'Outpass not found.' });
      return;
    }

    const outpass = rows[0];

    // Verify HMAC
    const payloadData = buildOutpassPayload(outpass.qr_token, outpass.student_id, outpass.out_time, outpass.expected_return);
    const expectedSig = signOutpass(payloadData);
    const sigValid = expectedSig === outpass.hmac_signature;

    // Check expiry
    const now = new Date();
    const isExpired = now > outpass.expected_return;
    const isUsed = outpass.status === 'used';

    res.json({
      valid: sigValid && !isExpired && !isUsed && outpass.status === 'active',
      outpass: {
        student: { name: outpass.name, roll_number: outpass.roll_number, email: outpass.email, year: outpass.year, department: outpass.department },
        purpose: outpass.purpose,
        destination: outpass.destination,
        outTime: outpass.out_time,
        expectedReturn: outpass.expected_return,
        status: outpass.status,
      },
      checks: { signatureValid: sigValid, expired: isExpired, alreadyUsed: isUsed },
    });

    // Mark as used
    if (sigValid && !isExpired && !isUsed) {
      await query("UPDATE outpasses SET status = 'used', verified_by = $1 WHERE id = $2", [req.user!.id, outpass.id]);
    }
  } catch (err) {
    console.error('Outpass verify error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// GET /api/outpass/my
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT id, purpose, destination, out_time, expected_return, status, created_at FROM outpasses WHERE student_id = $1 ORDER BY created_at DESC',
      [req.user!.id],
    );

    res.json({ outpasses: rows });
  } catch (err) {
    console.error('My outpasses error:', err);
    res.status(500).json({ error: 'Failed to fetch outpasses.' });
  }
});

export default router;
