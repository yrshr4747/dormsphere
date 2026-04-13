import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

function getElectionPhase(election: any): 'nomination' | 'voting' | 'closed' | 'upcoming' {
  const now = new Date();
  const nominationStart = election.nomination_start ? new Date(election.nomination_start) : null;
  const nominationEnd = election.nomination_end ? new Date(election.nomination_end) : null;
  const voteStart = new Date(election.start_time);
  const voteEnd = new Date(election.end_time);

  if (nominationStart && nominationEnd && now >= nominationStart && now <= nominationEnd) return 'nomination';
  if (now >= voteStart && now <= voteEnd) return 'voting';
  if (nominationStart && now < nominationStart) return 'upcoming';
  if (now < voteStart) return 'upcoming';
  return 'closed';
}

// GET /api/elections
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const params: any[] = [];
    let studentExtras = '';

    if (req.user?.role === 'student') {
      params.push(req.user.id);
      studentExtras = `,
        EXISTS(SELECT 1 FROM candidates c2 WHERE c2.election_id = e.id AND c2.student_id = $1) AS has_nominated,
        EXISTS(SELECT 1 FROM votes v2 WHERE v2.election_id = e.id AND v2.voter_id = $1) AS has_voted
      `;
    }

    const { rows } = await query(`
      SELECT e.*,
             COALESCE(cc.cnt, 0) AS candidate_count,
             COALESCE(vc.cnt, 0) AS total_votes
             ${studentExtras}
      FROM elections e
      LEFT JOIN (SELECT election_id, COUNT(*) AS cnt FROM candidates GROUP BY election_id) cc ON cc.election_id = e.id
      LEFT JOIN (SELECT election_id, COUNT(*) AS cnt FROM votes GROUP BY election_id) vc ON vc.election_id = e.id
      ORDER BY e.created_at DESC
    `, params);

    const elections = rows.map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      election_type: e.election_type,
      nomination_start: e.nomination_start,
      nomination_end: e.nomination_end,
      start_time: e.start_time,
      end_time: e.end_time,
      is_active: e.is_active,
      candidate_count: parseInt(e.candidate_count, 10),
      total_votes: parseInt(e.total_votes, 10),
      has_nominated: e.has_nominated ?? false,
      has_voted: e.has_voted ?? false,
      phase: getElectionPhase(e),
    }));

    res.json({ elections });
  } catch (err) {
    console.error('List elections error:', err);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
});

// POST /api/elections
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, electionType, nominationStart, nominationEnd, voteStart, voteEnd } = req.body;
    if (!title || !electionType || !voteStart || !voteEnd) {
      res.status(400).json({ error: 'Title, type, vote start, and vote end are required.' });
      return;
    }

    const voteStartDate = new Date(voteStart);
    const voteEndDate = new Date(voteEnd);
    const nominationStartDate = nominationStart ? new Date(nominationStart) : null;
    const nominationEndDate = nominationEnd ? new Date(nominationEnd) : null;

    if (Number.isNaN(voteStartDate.getTime()) || Number.isNaN(voteEndDate.getTime()) || voteEndDate <= voteStartDate) {
      res.status(400).json({ error: 'Voting start and end times must be valid, and end must be after start.' });
      return;
    }

    if ((nominationStartDate && Number.isNaN(nominationStartDate.getTime())) || (nominationEndDate && Number.isNaN(nominationEndDate.getTime()))) {
      res.status(400).json({ error: 'Nomination timings must be valid.' });
      return;
    }

    if (nominationStartDate && nominationEndDate && nominationEndDate > voteStartDate) {
      res.status(400).json({ error: 'Nomination window must close before voting starts.' });
      return;
    }

    const { rows } = await query(`
      INSERT INTO elections (title, description, election_type, nomination_start, nomination_end, start_time, end_time, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id
    `, [title, description || null, electionType, nominationStartDate, nominationEndDate, voteStartDate, voteEndDate]);

    res.status(201).json({ message: 'Election created successfully.', electionId: rows[0].id });
  } catch (err) {
    console.error('Create election error:', err);
    res.status(500).json({ error: 'Failed to create election.' });
  }
});

// POST /api/elections/:id/nominate
router.post('/:id/nominate', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows: electionRows } = await query('SELECT * FROM elections WHERE id = $1 AND is_active = true', [req.params.id]);
    if (electionRows.length === 0) {
      res.status(404).json({ error: 'Election not found.' });
      return;
    }

    const election = electionRows[0];
    const now = new Date();
    const nominationStart = election.nomination_start ? new Date(election.nomination_start) : null;
    const nominationEnd = election.nomination_end ? new Date(election.nomination_end) : null;

    if (!nominationStart || !nominationEnd || now < nominationStart || now > nominationEnd) {
      res.status(400).json({ error: 'Nominations are not open for this election.' });
      return;
    }

    const { cgpa, manifesto } = req.body;
    if (cgpa === undefined || cgpa === null || !manifesto) {
      res.status(400).json({ error: 'CGPA and manifesto are required for nomination.' });
      return;
    }

    const cgpaValue = parseFloat(cgpa);
    if (Number.isNaN(cgpaValue) || cgpaValue < 0 || cgpaValue > 10) {
      res.status(400).json({ error: 'CGPA must be between 0 and 10.' });
      return;
    }

    try {
      await query(
        'INSERT INTO candidates (election_id, student_id, cgpa, manifesto) VALUES ($1, $2, $3, $4)',
        [req.params.id, req.user!.id, cgpaValue, manifesto],
      );
    } catch (dupErr: any) {
      if (dupErr.code === '23505') {
        res.status(409).json({ error: 'You have already filed a nomination for this election.' });
        return;
      }
      throw dupErr;
    }

    res.status(201).json({ message: 'Nomination filed successfully.' });
  } catch (err) {
    console.error('Nomination error:', err);
    res.status(500).json({ error: 'Failed to file nomination.' });
  }
});

// GET /api/elections/:id/candidates
router.get('/:id/candidates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.manifesto, c.cgpa, c.nomination_created_at, s.name, s.roll_number, s.department, s.year, s.year_group
      FROM candidates c
      JOIN students s ON s.id = c.student_id
      WHERE c.election_id = $1
      ORDER BY c.nomination_created_at ASC
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

    const { rows: electionRows } = await query('SELECT * FROM elections WHERE id = $1 AND is_active = true', [electionId]);
    if (electionRows.length === 0) {
      res.status(404).json({ error: 'Election not found or not active.' });
      return;
    }

    const election = electionRows[0];
    const now = new Date();
    if (now < new Date(election.start_time) || now > new Date(election.end_time)) {
      res.status(400).json({ error: 'Voting is not currently open for this election.' });
      return;
    }

    const { rows: candidateRows } = await query('SELECT id FROM candidates WHERE id = $1 AND election_id = $2', [candidateId, electionId]);
    if (candidateRows.length === 0) {
      res.status(400).json({ error: 'Selected candidate is invalid for this election.' });
      return;
    }

    try {
      await query(
        'INSERT INTO votes (election_id, voter_id, candidate_id) VALUES ($1, $2, $3)',
        [electionId, req.user!.id, candidateId],
      );
    } catch (dupErr: any) {
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
router.get('/:id/results', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: results } = await query(`
      SELECT c.id, s.name, s.roll_number, c.cgpa, COUNT(v.id) AS vote_count
      FROM candidates c
      JOIN students s ON s.id = c.student_id
      LEFT JOIN votes v ON v.candidate_id = c.id
      WHERE c.election_id = $1
      GROUP BY c.id, s.name, s.roll_number, c.cgpa
      ORDER BY vote_count DESC, s.name ASC
    `, [req.params.id]);

    const totalVotes = results.reduce((sum: number, r: any) => sum + parseInt(r.vote_count, 10), 0);
    res.json({ results: results.map((r: any) => ({ ...r, vote_count: parseInt(r.vote_count, 10) })), totalVotes });
  } catch (err) {
    console.error('Results error:', err);
    res.status(500).json({ error: 'Failed to fetch results.' });
  }
});

export default router;
