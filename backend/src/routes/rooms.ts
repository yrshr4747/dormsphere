import { Router, Response } from 'express';
import Room from '../models/Room';
import Hostel from '../models/Hostel';
import RoomAssignment from '../models/RoomAssignment';
import SelectionAttempt from '../models/SelectionAttempt';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { broadcastRoomUpdate, broadcastDemandUpdate } from '../services/websocket';

const router = Router();

// GET /api/rooms — list all rooms with demand signals
router.get('/', async (_req, res: Response) => {
  try {
    const rooms = await Room.find().populate('hostelId', 'name code').lean();

    // Get demand counts
    const demandCounts = await SelectionAttempt.aggregate([
      { $match: { status: 'failed' } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    const demandMap = new Map(demandCounts.map((d: any) => [d._id.toString(), d.count]));

    const result = rooms.map((r: any) => {
      const demandCount = demandMap.get(r._id.toString()) || 0;
      return {
        id: r._id,
        hostel_id: (r.hostelId as any)?._id,
        hostel_name: (r.hostelId as any)?.name,
        hostel_code: (r.hostelId as any)?.code,
        room_number: r.roomNumber,
        floor: r.floor,
        capacity: r.capacity,
        occupied: r.occupied,
        is_available: r.isAvailable,
        demand_count: demandCount,
        demandLevel: demandCount > 10 ? 'critical' : demandCount > 5 ? 'high' : demandCount > 2 ? 'medium' : 'low',
      };
    });

    // Sort by hostel code, floor, room number
    result.sort((a: any, b: any) => {
      if (a.hostel_code !== b.hostel_code) return (a.hostel_code || '').localeCompare(b.hostel_code || '');
      if (a.floor !== b.floor) return a.floor - b.floor;
      return (a.room_number || '').localeCompare(b.room_number || '');
    });

    res.json({ rooms: result });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// GET /api/rooms/hostel/:hostelId — rooms by hostel
router.get('/hostel/:hostelId', async (req, res: Response) => {
  try {
    const rooms = await Room.find({ hostelId: req.params.hostelId })
      .populate('hostelId', 'name code')
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    const result = rooms.map((r: any) => ({
      id: r._id,
      hostel_id: (r.hostelId as any)?._id,
      hostel_name: (r.hostelId as any)?.name,
      hostel_code: (r.hostelId as any)?.code,
      room_number: r.roomNumber,
      floor: r.floor,
      capacity: r.capacity,
      occupied: r.occupied,
      is_available: r.isAvailable,
    }));

    res.json({ rooms: result });
  } catch (err) {
    console.error('Hostel rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// POST /api/rooms/:id/attempt — atomic room selection (findOneAndUpdate)
router.post('/:id/attempt', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    // Check if student already has an assignment
    const existingAssignment = await RoomAssignment.findOne({ studentId: req.user!.id });
    if (existingAssignment) {
      res.status(409).json({ error: 'You already have a room assignment.' });
      return;
    }

    // Atomic update: only increment if occupied < capacity
    const room = await Room.findOneAndUpdate(
      {
        _id: req.params.id,
        isAvailable: true,
        $expr: { $lt: ['$occupied', '$capacity'] },
      },
      {
        $inc: { occupied: 1 },
      },
      { new: true }
    ).populate('hostelId', 'name code');

    if (!room) {
      // Room full or not available — log failed attempt
      await SelectionAttempt.create({
        studentId: req.user!.id,
        roomId: req.params.id,
        status: 'failed',
        reason: 'room_full',
      });

      // Broadcast demand update
      const io = req.app.get('io');
      const failCount = await SelectionAttempt.countDocuments({ roomId: req.params.id, status: 'failed' });
      broadcastDemandUpdate(io, {
        roomId: req.params.id,
        demandLevel: failCount > 10 ? 'critical' : 'high',
        attemptCount: failCount,
      });

      res.status(409).json({ error: 'Room is no longer available.' });
      return;
    }

    // Update availability if now full
    if (room.occupied >= room.capacity) {
      room.isAvailable = false;
      await room.save();
    }

    // Create assignment
    await RoomAssignment.create({ studentId: req.user!.id, roomId: room._id });

    // Log successful attempt
    await SelectionAttempt.create({
      studentId: req.user!.id,
      roomId: room._id,
      status: 'success',
      reason: 'assigned',
    });

    // Broadcast via WebSocket
    const io = req.app.get('io');
    const hostel = room.hostelId as any;
    broadcastRoomUpdate(io, {
      roomId: room._id.toString(),
      hostelId: hostel?._id?.toString() || '',
      occupied: room.occupied,
      capacity: room.capacity,
      isAvailable: room.isAvailable,
      lastAction: 'booked',
    });

    res.json({
      success: true,
      message: 'Room assigned successfully!',
      assignment: {
        roomId: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        hostelId: hostel?._id,
      },
    });
  } catch (err) {
    console.error('Room selection error:', err);
    res.status(500).json({ error: 'Room selection failed.' });
  }
});

// GET /api/rooms/hostels/list — list all hostels
router.get('/hostels/list', async (_req, res: Response) => {
  try {
    const hostels = await Hostel.find().sort({ name: 1 }).lean();
    res.json({ hostels });
  } catch (err) {
    console.error('List hostels error:', err);
    res.status(500).json({ error: 'Failed to fetch hostels.' });
  }
});

export default router;
