import { Router, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/connection';
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
    const { rows } = await query(
      'INSERT INTO grievances (student_id, encrypted_content, iv, auth_tag, category) VALUES ($1, $2, $3, $4, $5) RETURNING id, category, status, created_at',
      [req.user!.id, encrypted, iv, authTag, category || 'general'],
    );

    res.status(201).json({
      message: 'Grievance submitted securely.',
      grievance: rows[0],
    });
  } catch (err) {
    console.error('Grievance submit error:', err);
    res.status(500).json({ error: 'Submission failed.' });
  }
});

// GET /api/grievance — list all (decrypted, judcomm/warden only)
router.get('/', authenticate, authorize('judcomm', 'admin', 'warden'), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT g.*, s.name, s.roll_number, s.department, s.year
      FROM grievances g
      JOIN students s ON s.id = g.student_id
      ORDER BY g.created_at DESC
    `);

    const result = rows.map((g: any) => {
      let content = '[Decryption Error]';
      try {
        content = decrypt(g.encrypted_content, g.iv, g.auth_tag);
      } catch {}
      return {
        id: g.id,
        student: { name: g.name, roll_number: g.roll_number, department: g.department, year: g.year },
        content,
        category: g.category,
        status: g.status,
        created_at: g.created_at,
        resolved_at: g.resolved_at,
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
    const { rows } = await query(
      'SELECT id, category, status, created_at, resolved_at FROM grievances WHERE student_id = $1 ORDER BY created_at DESC',
      [req.user!.id],
    );
    res.json({ grievances: rows });
  } catch (err) {
    console.error('My grievances error:', err);
    res.status(500).json({ error: 'Failed to fetch grievances.' });
  }
});

// PATCH /api/grievance/:id/resolve
router.patch('/:id/resolve', authenticate, authorize('judcomm', 'admin', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      "UPDATE grievances SET status = 'resolved', resolved_at = NOW() WHERE id = $1 RETURNING id, status",
      [req.params.id],
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Grievance not found.' }); return; }
    res.json({ message: 'Grievance marked as resolved.', status: rows[0].status });
  } catch (err) {
    console.error('Resolve error:', err);
    res.status(500).json({ error: 'Resolution failed.' });
  }
});

export default router;
