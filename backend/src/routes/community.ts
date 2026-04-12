import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToCloudinary } from '../services/cloudinary';

const router = Router();

// ==============================================
// LOST & FOUND ROUTES
// ==============================================

// GET /api/community/lost-found
router.get('/lost-found', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT lf.id, lf.item_type, lf.title, lf.description, lf.location, lf.image_url, 
             lf.status, lf.created_at, 
             s.name as reporter_name, s.roll_number as reporter_roll, s.email as reporter_email
      FROM lost_and_found lf
      JOIN students s ON lf.reported_by = s.id
      ORDER BY lf.created_at DESC
    `);
    res.json({ items: rows });
  } catch (err) {
    console.error('Fetch lost-found error:', err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// POST /api/community/lost-found
router.post('/lost-found', authenticate, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { itemType, title, description, location } = req.body;
    let url = null;
    
    if (req.file) {
      url = await uploadToCloudinary(req.file.buffer, 'dormsphere/lost-found');
    }

    const { rows } = await query(`
      INSERT INTO lost_and_found (item_type, title, description, location, image_url, reported_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [itemType, title, description, location, url, req.user!.id]);

    res.status(201).json({ item: rows[0] });
  } catch (err) {
    console.error('Post lost-found error:', err);
    res.status(500).json({ error: 'Failed to post item.' });
  }
});

// PATCH /api/community/lost-found/:id/resolve
router.patch('/lost-found/:id/resolve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Admins or the original reporter can resolve
    const { rows: item } = await query('SELECT reported_by FROM lost_and_found WHERE id = $1', [id]);
    if (item.length === 0) return res.status(404).json({ error: 'Item not found.' });
    if (item[0].reported_by !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to resolve this item.' });
    }

    await query("UPDATE lost_and_found SET status = 'resolved' WHERE id = $1", [id]);
    res.json({ message: 'Item marked as resolved!' });
  } catch (err) {
    console.error('Resolve lost-found error:', err);
    res.status(500).json({ error: 'Failed to resolve item.' });
  }
});


// ==============================================
// PUBLIC GRIEVANCES ROUTES (REDDIT STYLE)
// ==============================================

// GET /api/community/grievances
router.get('/grievances', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT g.id, g.title, g.description, g.category, g.is_anonymous, g.status, g.created_at, g.resolved_at,
             (SELECT COUNT(*) FROM grievance_upvotes u WHERE u.grievance_id = g.id) AS upvotes,
             EXISTS(SELECT 1 FROM grievance_upvotes u WHERE u.grievance_id = g.id AND u.student_id = $1) AS has_upvoted,
             CASE WHEN g.is_anonymous THEN 'Anonymous Resident' ELSE s.name END as author_name,
             CASE WHEN g.is_anonymous THEN 'H1' ELSE s.department END as author_dept
      FROM public_grievances g
      JOIN students s ON g.student_id = s.id
      ORDER BY upvotes DESC, g.created_at DESC
    `, [req.user!.id]);
    
    res.json({ grievances: rows });
  } catch (err) {
    console.error('Fetch grievances error:', err);
    res.status(500).json({ error: 'Failed to fetch public grievances.' });
  }
});

// POST /api/community/grievances
router.post('/grievances', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, anonymous } = req.body;
    
    const { rows } = await query(`
      INSERT INTO public_grievances (student_id, title, description, category, is_anonymous)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user!.id, title, description, category, anonymous === true]);

    res.status(201).json({ grievance: rows[0] });
  } catch (err) {
    console.error('Post grievance error:', err);
    res.status(500).json({ error: 'Failed to post grievance.' });
  }
});

// POST /api/community/grievances/:id/upvote
router.post('/grievances/:id/upvote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const io = req.app.get('io');
    
    // Toggle Upvote
    const { rowCount } = await query(
      'DELETE FROM grievance_upvotes WHERE grievance_id = $1 AND student_id = $2', 
      [id, req.user!.id]
    );

    let upvoted = false;
    if (rowCount === 0) {
      await query(
        'INSERT INTO grievance_upvotes (grievance_id, student_id) VALUES ($1, $2)',
        [id, req.user!.id]
      );
      upvoted = true;
    }
    
    // Fetch live count to broadcast
    const { rows } = await query('SELECT COUNT(*) as count FROM grievance_upvotes WHERE grievance_id = $1', [id]);
    const liveCount = parseInt(rows[0].count);

    // Broadcast live WebSocket update
    if (io) {
      io.emit('grievance:upvote', { grievanceId: id, upvotes: liveCount });
    }

    res.json({ success: true, upvoted, upvotes: liveCount });
  } catch (err) {
    console.error('Upvote error:', err);
    res.status(500).json({ error: 'Failed to toggle upvote.' });
  }
});

// PATCH /api/community/grievances/:id/resolve
// Admin only: Resolves the grievance and broadcasts real-time
router.patch('/grievances/:id/resolve', authenticate, authorize('admin', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const io = req.app.get('io');
    
    await query(`
      UPDATE public_grievances 
      SET status = 'resolved', resolved_at = NOW(), resolved_by = $1 
      WHERE id = $2
    `, [req.user!.id, id]);
    
    if (io) {
      io.emit('grievance:resolved', { grievanceId: id });
    }

    res.json({ message: 'Grievance marked as resolved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve grievance.' });
  }
});

export default router;
