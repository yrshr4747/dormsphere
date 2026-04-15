import { Router, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/waves — fetch all waves
router.get('/', authenticate, authorize('admin', 'student'), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM waves ORDER BY year_group DESC');
    res.json({ waves: rows });
  } catch (err) {
    console.error('Fetch waves error:', err);
    res.status(500).json({ error: 'Failed to fetch waves.' });
  }
});

// PUT /api/waves/:id — admin adjusts wave timings
router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { gateOpen, gateClose } = req.body;
    
    // Explicitly validate incoming dates
    if (!gateOpen || !gateClose || isNaN(Date.parse(gateOpen)) || isNaN(Date.parse(gateClose))) {
      res.status(400).json({ error: 'Valid gate_open and gate_close timestamps are required.' });
      return;
    }

    if (new Date(gateOpen) >= new Date(gateClose)) {
      res.status(400).json({ error: 'Gate open time must be strictly before gate close time.' });
      return;
    }

    const targetStart = new Date(gateOpen);
    const targetEnd = new Date(gateClose);
    const { rows: overlapRows } = await query(
      `SELECT id, name, year_group
       FROM waves
       WHERE id <> $1
         AND status <> 'completed'
         AND gate_open < $3
         AND gate_close > $2
       LIMIT 1`,
      [req.params.id, gateOpen, gateClose]
    );

    if (overlapRows.length > 0) {
      const overlappingWave = overlapRows[0];
      res.status(409).json({
        error: `Wave timings overlap with ${overlappingWave.name} (Year ${overlappingWave.year_group}). Only one wave can be open at a time.`,
      });
      return;
    }

    const now = new Date();
    const waveStatus = targetEnd <= now ? 'completed' : 'pending';
    const shouldBeActive = targetStart <= now && targetEnd > now;

    const rows = await withTransaction(async (client) => {
      if (shouldBeActive) {
        await client.query(
          "UPDATE waves SET is_active = false, status = CASE WHEN gate_close <= NOW() THEN 'completed' ELSE 'pending' END WHERE id <> $1",
          [req.params.id]
        );
      }

      const result = await client.query(
        `UPDATE waves 
         SET gate_open = $1,
             gate_close = $2,
             is_active = $3,
             status = $4
         WHERE id = $5 
         RETURNING *`,
        [gateOpen, gateClose, shouldBeActive, waveStatus, req.params.id]
      );

      return result.rows;
    });

    if (rows.length === 0) {
      res.status(404).json({ error: 'Wave not found.' });
      return;
    }

    res.json({ message: 'Wave timings updated successfully.', wave: rows[0] });
  } catch (err) {
    console.error('Update wave error:', err);
    res.status(500).json({ error: 'Failed to update wave timings.' });
  }
});

/**
 * POST /api/waves/activate
 * Atomic operation to switch the active allocation gate.
 * Restricted to: Chief Warden
 */
router.post('/activate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Enforce Chief Warden designation check
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Access Denied: Only the Chief Warden can open allocation gates.' });
      return;
    }

    const { yearGroup } = req.body;
    if (!yearGroup) {
      res.status(400).json({ error: 'Missing yearGroup in request body.' });
      return;
    }

    const result = await withTransaction(async (client) => {
      await client.query("UPDATE waves SET is_active = false, status = 'pending' WHERE is_active = true");
      return client.query(
        "UPDATE waves SET is_active = true, status = 'active' WHERE year_group = $1 RETURNING name",
        [yearGroup],
      );
    });

    if (result.rowCount === 0) {
      res.status(404).json({ error: `No wave defined for Year Group ${yearGroup}.` });
      return;
    }

    // 3. Log the activity
    await query(
      'INSERT INTO activity_logs (type, description) VALUES ($1, $2)',
      ['SYSTEM', `Chief Warden activated ${result.rows[0].name} (Year ${yearGroup})`]
    );

    res.json({ 
      success: true, 
      message: `Wave for Year ${yearGroup} (${result.rows[0].name}) is now ACTIVE.` 
    });

  } catch (err) {
    console.error('Wave Activation Error:', err);
    res.status(500).json({ error: 'Failed to activate wave.' });
  }
});

export default router;
