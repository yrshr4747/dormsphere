import { Router, Response } from 'express';
import crypto from 'crypto';
import Grievance from '../models/Grievance';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const GRIEVANCE_KEY = process.env.GRIEVANCE_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(GRIEVANCE_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), authTag };
}

function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  const key = Buffer.from(GRIEVANCE_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// POST /api/grievance — submit encrypted grievance
router.post('/', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { content, category } = req.body;
    if (!content) { res.status(400).json({ error: 'Grievance content is required.' }); return; }

    const { encrypted, iv, authTag } = encrypt(content);
    const grievance = await Grievance.create({
      studentId: req.user!.id,
      encryptedContent: encrypted,
      iv,
      authTag,
      category: category || 'general',
    });

    res.status(201).json({
      message: 'Grievance submitted securely.',
      grievance: { id: grievance._id, category: grievance.category, status: grievance.status, created_at: grievance.createdAt },
    });
  } catch (err) {
    console.error('Grievance submit error:', err);
    res.status(500).json({ error: 'Submission failed.' });
  }
});

// GET /api/grievance — list all (decrypted, judcomm/warden only)
router.get('/', authenticate, authorize('judcomm', 'warden'), async (_req: AuthRequest, res: Response) => {
  try {
    const grievances = await Grievance.find()
      .populate('studentId', 'name rollNumber department year')
      .sort({ createdAt: -1 })
      .lean();

    const result = grievances.map((g) => {
      let content = '[Decryption Error]';
      try {
        content = decrypt(g.encryptedContent, g.iv, g.authTag);
      } catch {}
      return {
        id: g._id,
        student: g.studentId,
        content,
        category: g.category,
        status: g.status,
        created_at: g.createdAt,
        resolved_at: g.resolvedAt,
      };
    });

    res.json({ grievances: result });
  } catch (err) {
    console.error('List grievances error:', err);
    res.status(500).json({ error: 'Failed to fetch grievances.' });
  }
});

// GET /api/grievance/my — own grievances (status only, no content)
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const grievances = await Grievance.find({ studentId: req.user!.id })
      .select('category status createdAt resolvedAt')
      .sort({ createdAt: -1 })
      .lean();

    const result = grievances.map((g) => ({
      id: g._id, category: g.category, status: g.status, created_at: g.createdAt, resolved_at: g.resolvedAt,
    }));

    res.json({ grievances: result });
  } catch (err) {
    console.error('My grievances error:', err);
    res.status(500).json({ error: 'Failed to fetch grievances.' });
  }
});

// PATCH /api/grievance/:id/resolve
router.patch('/:id/resolve', authenticate, authorize('judcomm', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const grievance = await Grievance.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    if (!grievance) { res.status(404).json({ error: 'Grievance not found.' }); return; }
    res.json({ message: 'Grievance marked as resolved.', status: grievance.status });
  } catch (err) {
    console.error('Resolve error:', err);
    res.status(500).json({ error: 'Resolution failed.' });
  }
});

export default router;
