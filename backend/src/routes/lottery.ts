import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { runLottery } from '../services/engineBridge';

const router = Router();

// POST /api/lottery/generate — trigger lottery engine (warden only)
router.post('/generate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { seed, yearGroup } = req.body;
    const lotterySeed = seed || process.env.LOTTERY_SEED || 'public-seed-2026';

    let studentQuery = 'SELECT id, roll_number FROM students WHERE role = $1';
    const params: any[] = ['student'];

    if (yearGroup) {
      studentQuery += ' AND year_group = $2';
      params.push(yearGroup);
    }

    const { rows: students } = await query(studentQuery, params);
    const studentIds = students.map((s: any) => s.id);

    if (studentIds.length === 0) {
      res.status(404).json({ error: 'No students found for lottery.' });
      return;
    }

    const result = await runLottery(studentIds, lotterySeed);

    // Upsert rankings
    for (const r of result.rankings) {
      await query(
        `INSERT INTO lottery_ranks (student_id, seed, hash, rank)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, seed) DO UPDATE SET hash = $3, rank = $4`,
        [r.student_id, lotterySeed, r.hash, r.rank],
      );
    }

    res.json({
      message: 'Lottery generated successfully.',
      seed: lotterySeed,
      totalStudents: studentIds.length,
      rankings: result.rankings.slice(0, 20),
    });
  } catch (err) {
    console.error('Lottery error:', err);
    res.status(500).json({ error: 'Lottery generation failed.' });
  }
});

// GET /api/lottery/rank
router.get('/rank', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT rank, hash, seed, created_at FROM lottery_ranks WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id],
    );
    if (rows.length === 0) { res.status(404).json({ error: 'No lottery rank found.' }); return; }
    res.json({ lottery: { rank: rows[0].rank, hash: rows[0].hash, seed: rows[0].seed, created_at: rows[0].created_at } });
  } catch (err) {
    console.error('Rank fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch rank.' });
  }
});

// GET /api/lottery/rankings
router.get('/rankings', async (_req, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT lr.rank, lr.hash, lr.seed, s.roll_number, s.name
      FROM lottery_ranks lr
      JOIN students s ON s.id = lr.student_id
      ORDER BY lr.rank
    `);

    res.json({ rankings: rows });
  } catch (err) {
    console.error('Rankings error:', err);
    res.status(500).json({ error: 'Failed to fetch rankings.' });
  }
});

export default router;
