import { Router, Response } from 'express';
import { Asset, AssetCheckout } from '../models/Asset';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/assets
router.get('/', async (_req, res: Response) => {
  try {
    const assets = await Asset.find()
      .populate('hostelId', 'name code')
      .sort({ category: 1, name: 1 })
      .lean();

    const result = assets.map((a: any) => ({
      id: a._id,
      hostel_name: a.hostelId?.name,
      hostel_code: a.hostelId?.code,
      name: a.name,
      category: a.category,
      total_count: a.totalCount,
      available_count: a.availableCount,
    }));

    res.json({ assets: result });
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
    const existing = await AssetCheckout.findOne({ assetId, studentId: req.user!.id, status: 'checked_out' });
    if (existing) {
      res.status(409).json({ error: 'You already have this asset checked out.' });
      return;
    }

    // Atomic decrement
    const asset = await Asset.findOneAndUpdate(
      { _id: assetId, availableCount: { $gt: 0 } },
      { $inc: { availableCount: -1 } },
      { new: true }
    );

    if (!asset) {
      res.status(409).json({ error: 'Asset is not available.' });
      return;
    }

    await AssetCheckout.create({
      assetId: asset._id,
      studentId: req.user!.id,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : undefined,
    });

    res.json({ message: `${asset.name} checked out successfully.`, available: asset.availableCount });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed.' });
  }
});

// POST /api/assets/checkin
router.post('/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.body;

    const checkout = await AssetCheckout.findOneAndUpdate(
      { assetId, studentId: req.user!.id, status: 'checked_out' },
      { status: 'returned', actualReturn: new Date() },
      { new: true }
    );

    if (!checkout) {
      res.status(404).json({ error: 'No active checkout found for this asset.' });
      return;
    }

    await Asset.updateOne({ _id: assetId }, { $inc: { availableCount: 1 } });

    res.json({ message: 'Asset returned successfully.' });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: 'Checkin failed.' });
  }
});

export default router;
