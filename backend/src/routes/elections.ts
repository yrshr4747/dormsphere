import { Router, Response } from 'express';
import { Election, Candidate, Vote } from '../models/Election';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/elections
router.get('/', async (_req, res: Response) => {
  try {
    const elections = await Election.find().sort({ createdAt: -1 }).lean();

    const result = await Promise.all(
      elections.map(async (e) => {
        const candidateCount = await Candidate.countDocuments({ electionId: e._id });
        const totalVotes = await Vote.countDocuments({ electionId: e._id });
        return {
          id: e._id,
          title: e.title,
          description: e.description,
          election_type: e.electionType,
          is_active: e.isActive,
          start_time: e.startTime,
          end_time: e.endTime,
          candidate_count: candidateCount,
          total_votes: totalVotes,
        };
      })
    );

    res.json({ elections: result });
  } catch (err) {
    console.error('List elections error:', err);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
});

// GET /api/elections/:id/candidates
router.get('/:id/candidates', async (req, res: Response) => {
  try {
    const candidates = await Candidate.find({ electionId: req.params.id })
      .populate('studentId', 'name rollNumber department year')
      .lean();

    const result = candidates.map((c: any) => ({
      id: c._id,
      name: c.studentId?.name,
      roll_number: c.studentId?.rollNumber,
      department: c.studentId?.department,
      year: c.studentId?.year,
      manifesto: c.manifesto,
    }));

    res.json({ candidates: result });
  } catch (err) {
    console.error('List candidates error:', err);
    res.status(500).json({ error: 'Failed to fetch candidates.' });
  }
});

// POST /api/elections/vote
router.post('/vote', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { electionId, candidateId } = req.body;

    // Check election is active
    const election = await Election.findOne({ _id: electionId, isActive: true });
    if (!election) {
      res.status(404).json({ error: 'Election not found or not active.' });
      return;
    }

    // Check timing
    const now = new Date();
    if (now < election.startTime || now > election.endTime) {
      res.status(400).json({ error: 'Election is not currently accepting votes.' });
      return;
    }

    // One vote per student — unique index on (electionId, voterId) will reject duplicates
    try {
      await Vote.create({
        electionId,
        voterId: req.user!.id,
        candidateId,
      });
    } catch (dupErr: any) {
      if (dupErr.code === 11000) {
        res.status(409).json({ error: 'You have already voted in this election.' });
        return;
      }
      throw dupErr;
    }

    res.json({ message: 'Vote recorded successfully.' });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Voting failed.' });
  }
});

// GET /api/elections/:id/results
router.get('/:id/results', async (req, res: Response) => {
  try {
    const voteCounts = await Vote.aggregate([
      { $match: { electionId: { $toObjectId: req.params.id } } },
      { $group: { _id: '$candidateId', vote_count: { $sum: 1 } } },
    ]);

    // Get candidate details
    const candidates = await Candidate.find({ electionId: req.params.id })
      .populate('studentId', 'name rollNumber')
      .lean();

    const voteMap = new Map(voteCounts.map((v: any) => [v._id.toString(), v.vote_count]));
    const results = candidates.map((c: any) => ({
      id: c._id,
      name: c.studentId?.name,
      roll_number: c.studentId?.rollNumber,
      vote_count: voteMap.get(c._id.toString()) || 0,
    }));

    // Sort by votes descending
    results.sort((a, b) => b.vote_count - a.vote_count);

    res.json({ results, totalVotes: voteCounts.reduce((sum: number, v: any) => sum + v.vote_count, 0) });
  } catch (err) {
    console.error('Results error:', err);
    res.status(500).json({ error: 'Failed to fetch results.' });
  }
});

export default router;
