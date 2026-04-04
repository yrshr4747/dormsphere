import { Router, Response } from 'express';
import InfraStatus from '../models/InfraStatus';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/infra/status
router.get('/status', async (_req, res: Response) => {
  try {
    const infra = await InfraStatus.find()
      .populate('hostelId', 'name code')
      .lean();

    const result = infra.map((i: any) => ({
      id: i._id,
      hostel_name: i.hostelId?.name,
      hostel_code: i.hostelId?.code,
      wifi_strength: i.wifiStrength,
      power_status: i.powerStatus,
      water_status: i.waterStatus,
      last_updated: i.lastUpdated,
    }));

    res.json({ infrastructure: result });
  } catch (err) {
    console.error('Infra status error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure status.' });
  }
});

// PUT /api/infra/status/:hostelId — warden update
router.put('/status/:hostelId', authenticate, authorize('warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { wifiStrength, powerStatus, waterStatus } = req.body;
    const update: any = { lastUpdated: new Date() };
    if (wifiStrength !== undefined) update.wifiStrength = wifiStrength;
    if (powerStatus !== undefined) update.powerStatus = powerStatus;
    if (waterStatus !== undefined) update.waterStatus = waterStatus;

    const infra = await InfraStatus.findOneAndUpdate(
      { hostelId: req.params.hostelId },
      update,
      { new: true }
    );
    if (!infra) { res.status(404).json({ error: 'Hostel not found.' }); return; }

    // Broadcast update
    const io = req.app.get('io');
    if (io) io.emit('infra:updated', { hostelId: req.params.hostelId, ...update });

    res.json({ message: 'Infrastructure status updated.', infra });
  } catch (err) {
    console.error('Infra update error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

export default router;
