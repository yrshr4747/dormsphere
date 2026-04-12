import { Router, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/assets
router.get('/', async (_req, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT a.id, h.name AS hostel_name, h.code AS hostel_code,
             a.name, a.category, a.total_count, a.available_count
      FROM assets a
      JOIN hostels h ON h.id = a.hostel_id
      ORDER BY a.category, a.name
    `);

    res.json({ assets: rows });
  } catch (err) {
    console.error('List assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets.' });
  }
});

// POST /api/assets/checkout — atomic checkout
router.post('/checkout', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { assetId, expectedReturn } = req.body;

    // Check if student already has this asset
    const { rows: existing } = await query(
      "SELECT id FROM asset_checkouts WHERE asset_id = $1 AND student_id = $2 AND status = 'checked_out'",
      [assetId, req.user!.id],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: 'You already have this asset checked out.' });
      return;
    }

    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE assets SET available_count = available_count - 1 WHERE id = $1 AND available_count > 0 RETURNING *',
        [assetId],
      );

      if (rows.length === 0) {
        throw new Error('Asset is not available.');
      }

      await client.query(
        'INSERT INTO asset_checkouts (asset_id, student_id, expected_return) VALUES ($1, $2, $3)',
        [assetId, req.user!.id, expectedReturn ? new Date(expectedReturn) : null],
      );

      return rows[0];
    });

    res.json({ message: `${updated.name} checked out successfully.`, available: updated.available_count });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(err instanceof Error && err.message === 'Asset is not available.' ? 409 : 500).json({ error: err instanceof Error ? err.message : 'Checkout failed.' });
  }
});

// POST /api/assets/checkin
router.post('/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.body;

    const checkout = await withTransaction(async (client) => {
      const { rows } = await client.query(
        "UPDATE asset_checkouts SET status = 'returned', actual_return = NOW() WHERE asset_id = $1 AND student_id = $2 AND status = 'checked_out' RETURNING id",
        [assetId, req.user!.id],
      );

      if (rows.length === 0) {
        throw new Error('No active checkout found for this asset.');
      }

      await client.query('UPDATE assets SET available_count = available_count + 1 WHERE id = $1', [assetId]);
      return rows[0];
    });

    if (!checkout) {
      res.status(404).json({ error: 'No active checkout found for this asset.' });
      return;
    }

    res.json({ message: 'Asset returned successfully.' });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(err instanceof Error && err.message === 'No active checkout found for this asset.' ? 404 : 500).json({ error: err instanceof Error ? err.message : 'Checkin failed.' });
  }
});

export default router;
