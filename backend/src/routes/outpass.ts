import { Router, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Outpass from '../models/Outpass';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const OUTPASS_SECRET = process.env.OUTPASS_SECRET || 'outpass-hmac-secret-change-me';

function signOutpass(data: string): string {
  return crypto.createHmac('sha256', OUTPASS_SECRET).update(data).digest('hex');
}

// POST /api/outpass/generate
router.post('/generate', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { purpose, destination, outTime, expectedReturn } = req.body;
    if (!purpose || !outTime || !expectedReturn) {
      res.status(400).json({ error: 'Purpose, out time, and expected return are required.' });
      return;
    }

    const qrToken = uuidv4();
    const payloadData = `${qrToken}|${req.user!.id}|${outTime}|${expectedReturn}`;
    const hmacSignature = signOutpass(payloadData);
    const qrPayload = JSON.stringify({ token: qrToken, sig: hmacSignature, student: req.user!.id });

    await Outpass.create({
      studentId: req.user!.id,
      purpose,
      destination: destination || '',
      outTime: new Date(outTime),
      expectedReturn: new Date(expectedReturn),
      qrToken,
      hmacSignature,
    });

    res.json({ message: 'Outpass generated.', qrPayload, token: qrToken });
  } catch (err) {
    console.error('Outpass generate error:', err);
    res.status(500).json({ error: 'Outpass generation failed.' });
  }
});

// GET /api/outpass/verify/:token
router.get('/verify/:token', authenticate, authorize('guard', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const outpass = await Outpass.findOne({ qrToken: req.params.token })
      .populate('studentId', 'name rollNumber email year department')
      .lean();

    if (!outpass) {
      res.status(404).json({ valid: false, error: 'Outpass not found.' });
      return;
    }

    // Verify HMAC
    const payloadData = `${outpass.qrToken}|${(outpass.studentId as any)._id}|${outpass.outTime.toISOString()}|${outpass.expectedReturn.toISOString()}`;
    const expectedSig = signOutpass(payloadData);
    const sigValid = expectedSig === outpass.hmacSignature;

    // Check expiry
    const now = new Date();
    const isExpired = now > outpass.expectedReturn;
    const isUsed = outpass.status === 'used';

    res.json({
      valid: sigValid && !isExpired && !isUsed && outpass.status === 'active',
      outpass: {
        student: outpass.studentId,
        purpose: outpass.purpose,
        destination: outpass.destination,
        outTime: outpass.outTime,
        expectedReturn: outpass.expectedReturn,
        status: outpass.status,
      },
      checks: { signatureValid: sigValid, expired: isExpired, alreadyUsed: isUsed },
    });

    // Mark as used
    if (sigValid && !isExpired && !isUsed) {
      await Outpass.updateOne({ _id: outpass._id }, { status: 'used', verifiedBy: req.user!.id });
    }
  } catch (err) {
    console.error('Outpass verify error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// GET /api/outpass/my
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const outpasses = await Outpass.find({ studentId: req.user!.id })
      .sort({ createdAt: -1 })
      .select('purpose destination outTime expectedReturn status createdAt')
      .lean();

    const result = outpasses.map((op) => ({
      id: op._id,
      purpose: op.purpose,
      destination: op.destination,
      out_time: op.outTime,
      expected_return: op.expectedReturn,
      status: op.status,
      created_at: op.createdAt,
    }));

    res.json({ outpasses: result });
  } catch (err) {
    console.error('My outpasses error:', err);
    res.status(500).json({ error: 'Failed to fetch outpasses.' });
  }
});

export default router;
