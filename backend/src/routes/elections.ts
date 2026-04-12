import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/elections
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT e.*,
             COALESCE(cc.cnt, 0) AS candidate_count,
             COALESCE(vc.cnt, 0) AS total_votes
      FROM elections e
      LEFT JOIN (SELECT election_id, COUNT(*) AS cnt FROM candidates GROUP BY election_id) cc ON cc.election_id = e.id
      LEFT JOIN (SELECT election_id, COUNT(*) AS cnt FROM votes GROUP BY election_id) vc ON vc.election_id = e.id
      ORDER BY e.created_at DESC
    `);

    const result = rows.map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      election_type: e.election_type,
      is_active: e.is_active,
      start_time: e.start_time,
      end_time: e.end_time,
      candidate_count: parseInt(e.candidate_count),
      total_votes: parseInt(e.total_votes),
    }));

    res.json({ elections: result });
  } catch (err) {
    console.error('List elections error:', err);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
});

// GET /api/elections/:id/candidates
router.get('/:id/candidates', async (req, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.manifesto, s.name, s.roll_number, s.department, s.year
      FROM candidates c
      JOIN students s ON s.id = c.student_id
      WHERE c.election_id = $1
    `, [req.params.id]);

    res.json({ candidates: rows });
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
    const { rows: electionRows } = await query('SELECT * FROM elections WHERE id = $1 AND is_active = true', [electionId]);
    if (electionRows.length === 0) {
      res.status(404).json({ error: 'Election not found or not active.' });
      return;
    }

    const election = electionRows[0];
    const now = new Date();
    if (now < election.start_time || now > election.end_time) {
      res.status(400).json({ error: 'Election is not currently accepting votes.' });
      return;
    }

    // One vote per student — UNIQUE constraint will reject duplicates
    try {
      await query(
        'INSERT INTO votes (election_id, voter_id, candidate_id) VALUES ($1, $2, $3)',
        [electionId, req.user!.id, candidateId],
      );
    } catch (dupErr: any) {
      // PostgreSQL unique violation error code
      if (dupErr.code === '23505') {
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
    const { rows: results } = await query(`
      SELECT c.id, s.name, s.roll_number, COUNT(v.id) AS vote_count
      FROM candidates c
      JOIN students s ON s.id = c.student_id
      LEFT JOIN votes v ON v.candidate_id = c.id
      WHERE c.election_id = $1
      GROUP BY c.id, s.name, s.roll_number
      ORDER BY vote_count DESC
    `, [req.params.id]);

    const totalVotes = results.reduce((sum: number, r: any) => sum + parseInt(r.vote_count), 0);
    res.json({ results: results.map((r: any) => ({ ...r, vote_count: parseInt(r.vote_count) })), totalVotes });
  } catch (err) {
    console.error('Results error:', err);
    res.status(500).json({ error: 'Failed to fetch results.' });
  }
});

export default router;
