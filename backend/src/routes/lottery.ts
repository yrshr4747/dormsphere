import { Router, Response } from 'express';
import Student from '../models/Student';
import LotteryRank from '../models/LotteryRank';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { runLottery } from '../services/engineBridge';

const router = Router();

// POST /api/lottery/generate — trigger lottery engine (warden only)
router.post('/generate', authenticate, authorize('warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { seed, yearGroup } = req.body;
    const lotterySeed = seed || process.env.LOTTERY_SEED || 'public-seed-2026';

    const query: any = { role: 'student' };
    if (yearGroup) query.year = yearGroup;

    const students = await Student.find(query).select('_id rollNumber').lean();
    const studentIds = students.map((s) => s._id.toString());

    if (studentIds.length === 0) {
      res.status(404).json({ error: 'No students found for lottery.' });
      return;
    }

    const result = await runLottery(studentIds, lotterySeed);

    // Upsert rankings
    const bulkOps = result.rankings.map((r: any) => ({
      updateOne: {
        filter: { studentId: r.student_id, seed: lotterySeed },
        update: { studentId: r.student_id, seed: lotterySeed, hash: r.hash, rank: r.rank },
        upsert: true,
      },
    }));
    await LotteryRank.bulkWrite(bulkOps);

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
    const rank = await LotteryRank.findOne({ studentId: req.user!.id }).sort({ createdAt: -1 }).lean();
    if (!rank) { res.status(404).json({ error: 'No lottery rank found.' }); return; }
    res.json({ lottery: { rank: rank.rank, hash: rank.hash, seed: rank.seed, created_at: rank.createdAt } });
  } catch (err) {
    console.error('Rank fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch rank.' });
  }
});

// GET /api/lottery/rankings
router.get('/rankings', async (_req, res: Response) => {
  try {
    const rankings = await LotteryRank.find()
      .populate('studentId', 'rollNumber name')
      .sort({ rank: 1 })
      .lean();

    const result = rankings.map((r: any) => ({
      rank: r.rank, hash: r.hash, seed: r.seed,
      roll_number: r.studentId?.rollNumber, name: r.studentId?.name,
    }));
    res.json({ rankings: result });
  } catch (err) {
    console.error('Rankings error:', err);
    res.status(500).json({ error: 'Failed to fetch rankings.' });
  }
});

export default router;
