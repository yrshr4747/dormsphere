import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToCloudinary } from '../services/cloudinary';

const router = Router();

// GET /api/media — list all media (optionally filter by hostel)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { hostel } = req.query;

    let sql = `
      SELECT m.id, m.media_type, m.url, m.caption, m.created_at,
             h.code AS hostel_code, h.name AS hostel_name,
             s.name AS uploaded_by_name, s.roll_number
      FROM media m
      LEFT JOIN hostels h ON h.id = m.hostel_id
      JOIN students s ON s.id = m.uploaded_by
    `;
    const params: any[] = [];

    if (hostel && hostel !== 'all') {
      sql += ' WHERE h.code = $1';
      params.push(hostel);
    }

    sql += ' ORDER BY m.created_at DESC';

    const { rows } = await query(sql, params);
    res.json({ media: rows });
  } catch (err) {
    console.error('Media list error:', err);
    res.status(500).json({ error: 'Failed to fetch media.' });
  }
});

// POST /api/media — upload media file
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { hostelCode, caption, mediaType } = req.body;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const type = mediaType || (req.file.mimetype.startsWith('video') ? 'video' : 'photo');

    // Upload to Cloudinary
    let url: string;
    try {
      url = await uploadToCloudinary(req.file.buffer, 'dormsphere/media');
    } catch (uploadErr) {
      console.error('Cloudinary upload error:', uploadErr);
      res.status(500).json({ error: 'File upload failed.' });
      return;
    }

    // Resolve hostel_id from code (optional)
    let hostelId: string | null = null;
    if (hostelCode) {
      const { rows: hostelRows } = await query(
        'SELECT id FROM hostels WHERE code = $1',
        [hostelCode],
      );
      if (hostelRows.length > 0) hostelId = hostelRows[0].id;
    }

    const { rows } = await query(
      `INSERT INTO media (hostel_id, uploaded_by, media_type, url, caption)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, media_type, url, caption, created_at`,
      [hostelId, req.user!.id, type, url, caption || null],
    );

    res.status(201).json({ media: rows[0] });
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: 'Media upload failed.' });
  }
});

// DELETE /api/media/:id — delete media (owner or admin)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { rows } = await query('SELECT * FROM media WHERE id = $1', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Media not found.' });
      return;
    }

    const media = rows[0];
    if (media.uploaded_by !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Not authorized to delete this media.' });
      return;
    }

    await query('DELETE FROM media WHERE id = $1', [id]);
    res.json({ message: 'Media deleted.' });
  } catch (err) {
    console.error('Media delete error:', err);
    res.status(500).json({ error: 'Failed to delete media.' });
  }
});

export default router;
