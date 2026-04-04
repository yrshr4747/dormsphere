import { Router, Response } from 'express';
import Vector from '../models/Vector';
import Match from '../models/Match';
import RoomAssignment from '../models/RoomAssignment';
import Room from '../models/Room';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { vectorizeSurvey, calculateCompatibility } from '../services/vectorizer';

const router = Router();

// POST /api/student/survey
router.post('/survey', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const answers = req.body;
    const vector = vectorizeSurvey(answers);

    await Vector.findOneAndUpdate(
      { studentId: req.user!.id },
      { studentId: req.user!.id, sleep: vector.sleep, study: vector.study, social: vector.social, rawAnswers: answers },
      { upsert: true, new: true }
    );

    res.json({ message: 'Survey submitted successfully.', vector });
  } catch (err) {
    console.error('Survey error:', err);
    res.status(500).json({ error: 'Survey submission failed.' });
  }
});

// GET /api/student/vector
router.get('/vector', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const vec = await Vector.findOne({ studentId: req.user!.id }).lean();
    if (!vec) { res.status(404).json({ error: 'No survey data found. Please complete the personality survey.' }); return; }
    res.json({ vector: { sleep: vec.sleep, study: vec.study, social: vec.social } });
  } catch (err) {
    console.error('Vector fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch vector.' });
  }
});

// GET /api/student/match
router.get('/match', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const match = await Match.findOne({
      $or: [{ studentA: req.user!.id }, { studentB: req.user!.id }],
    })
    .populate('studentA', 'name rollNumber')
    .populate('studentB', 'name rollNumber')
    .sort({ createdAt: -1 })
    .lean();

    if (!match) { res.status(404).json({ error: 'No match found yet.' }); return; }

    const isA = match.studentA._id.toString() === req.user!.id;
    const partner = isA ? match.studentB : match.studentA;

    res.json({
      match: {
        partnerId: (partner as any)._id,
        partnerName: (partner as any).name,
        partnerRoll: (partner as any).rollNumber,
        compatibilityScore: match.compatibilityScore,
        matchedAt: match.createdAt,
      },
    });
  } catch (err) {
    console.error('Match fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch match.' });
  }
});

// GET /api/student/compatibility/:targetId
router.get('/compatibility/:targetId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const myVec = await Vector.findOne({ studentId: req.user!.id }).lean();
    const targetVec = await Vector.findOne({ studentId: req.params.targetId }).lean();
    if (!myVec || !targetVec) { res.status(404).json({ error: 'Survey data missing for one or both students.' }); return; }
    const score = calculateCompatibility(myVec, targetVec);
    res.json({ compatibilityScore: score });
  } catch (err) {
    console.error('Compatibility error:', err);
    res.status(500).json({ error: 'Compatibility check failed.' });
  }
});

// GET /api/student/assignment
router.get('/assignment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await RoomAssignment.findOne({ studentId: req.user!.id })
      .populate({ path: 'roomId', populate: { path: 'hostelId', select: 'name code' } })
      .lean();

    if (!assignment) { res.status(404).json({ error: 'No room assignment found.' }); return; }

    const room = assignment.roomId as any;
    const hostel = room?.hostelId as any;

    res.json({
      assignment: {
        room_number: room?.roomNumber,
        floor: room?.floor,
        capacity: room?.capacity,
        occupied: room?.occupied,
        hostel_name: hostel?.name,
        hostel_code: hostel?.code,
        assigned_at: assignment.assignedAt,
      },
    });
  } catch (err) {
    console.error('Assignment fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch assignment.' });
  }
});

export default router;
