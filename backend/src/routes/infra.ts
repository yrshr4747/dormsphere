import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/infra/status
router.get('/status', async (_req, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT i.id, h.name AS hostel_name, h.code AS hostel_code,
             i.wifi_strength, i.power_status, i.water_status, i.last_updated
      FROM infra_status i
      JOIN hostels h ON h.id = i.hostel_id
    `);

    res.json({ infrastructure: rows });
  } catch (err) {
    console.error('Infra status error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure status.' });
  }
});

// PUT /api/infra/status/:hostelId — warden update
router.put('/status/:hostelId', authenticate, authorize('admin', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { wifiStrength, powerStatus, waterStatus } = req.body;

    const setClauses: string[] = ['last_updated = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (wifiStrength !== undefined) { setClauses.push(`wifi_strength = $${idx++}`); params.push(wifiStrength); }
    if (powerStatus !== undefined) { setClauses.push(`power_status = $${idx++}`); params.push(powerStatus); }
    if (waterStatus !== undefined) { setClauses.push(`water_status = $${idx++}`); params.push(waterStatus); }

    params.push(req.params.hostelId);

    const { rows } = await query(
      `UPDATE infra_status SET ${setClauses.join(', ')} WHERE hostel_id = $${idx} RETURNING *`,
      params,
    );

    if (rows.length === 0) { res.status(404).json({ error: 'Hostel not found.' }); return; }

    // Broadcast update
    const io = req.app.get('io');
    if (io) io.emit('infra:updated', { hostelId: req.params.hostelId, ...rows[0] });

    res.json({ message: 'Infrastructure status updated.', infra: rows[0] });
  } catch (err) {
    console.error('Infra update error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

export default router;
