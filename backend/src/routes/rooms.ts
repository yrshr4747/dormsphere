import { Router, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { broadcastRoomUpdate, broadcastDemandUpdate, broadcastSignalUpdate } from '../services/websocket';
import { runConflictResolver } from '../services/engineBridge';

const router = Router();

// GET /api/rooms — list all rooms with demand signals + interest tracking
router.get('/', async (_req, res: Response) => {
  try {
    const { rows: rooms } = await query(`
      SELECT r.id, r.hostel_id, h.name AS hostel_name, h.code AS hostel_code,
             r.room_number, r.floor, r.capacity, r.occupied, r.is_available, r.amenities,
             COALESCE(sa.fail_count, 0) AS demand_count,
             COALESCE(sig.signal_count, 0) AS signal_count,
             COALESCE(ri.interest_count, 0) AS interest_count
      FROM rooms r
      JOIN hostels h ON h.id = r.hostel_id
      LEFT JOIN (
        SELECT room_id, COUNT(*) AS fail_count
        FROM selection_attempts WHERE status = 'failed'
        GROUP BY room_id
      ) sa ON sa.room_id = r.id
      LEFT JOIN (
        SELECT room_id, COUNT(*) AS signal_count
        FROM room_signals
        GROUP BY room_id
      ) sig ON sig.room_id = r.id
      LEFT JOIN (
        SELECT room_id, COUNT(*) AS interest_count
        FROM room_interest
        GROUP BY room_id
      ) ri ON ri.room_id = r.id
      ORDER BY h.code, r.floor, r.room_number
    `);

    const result = rooms.map((r: any) => {
      const totalInterest = parseInt(r.demand_count) + parseInt(r.signal_count) + parseInt(r.interest_count);
      const interestCount = parseInt(r.interest_count);
      const capacity = parseInt(r.capacity);
      return {
        id: r.id,
        hostel_id: r.hostel_id,
        hostel_name: r.hostel_name,
        hostel_code: r.hostel_code,
        room_number: r.room_number,
        floor: r.floor,
        capacity: r.capacity,
        occupied: r.occupied,
        is_available: r.is_available,
        demand_count: parseInt(r.demand_count),
        signal_count: parseInt(r.signal_count),
        interest_count: interestCount,
        demand_ratio: capacity > 0 ? parseFloat((interestCount / capacity).toFixed(1)) : 0,
        demandLevel: totalInterest > 10 ? 'critical' : totalInterest > 5 ? 'high' : totalInterest > 2 ? 'medium' : 'low',
      };
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
    const { rows: rooms } = await query(`
      SELECT r.id, r.hostel_id, h.name AS hostel_name, h.code AS hostel_code,
             r.room_number, r.floor, r.capacity, r.occupied, r.is_available
      FROM rooms r
      JOIN hostels h ON h.id = r.hostel_id
      WHERE r.hostel_id = $1
      ORDER BY r.floor, r.room_number
    `, [req.params.hostelId]);

    const result = rooms.map((r: any) => ({
      id: r.id,
      hostel_id: r.hostel_id,
      hostel_name: r.hostel_name,
      hostel_code: r.hostel_code,
      room_number: r.room_number,
      floor: r.floor,
      capacity: r.capacity,
      occupied: r.occupied,
      is_available: r.is_available,
    }));

    res.json({ rooms: result });
  } catch (err) {
    console.error('Hostel rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// POST /api/rooms/:id/signal — 🔥 heatmap signal
router.post('/:id/signal', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    // Insert signal
    await query(
      'INSERT INTO room_signals (room_id, student_id) VALUES ($1, $2)',
      [req.params.id, req.user!.id],
    );

    // Count signals for this room
    const { rows } = await query(
      'SELECT COUNT(*) AS cnt FROM room_signals WHERE room_id = $1',
      [req.params.id],
    );
    const signalCount = parseInt(rows[0].cnt);

    // Broadcast to all clients via WebSocket
    const io = req.app.get('io');
    broadcastSignalUpdate(io, {
      roomId: req.params.id,
      signalCount,
      demandLevel: signalCount > 10 ? 'critical' : signalCount > 5 ? 'high' : signalCount > 2 ? 'medium' : 'low',
    });

    res.json({ message: 'Interest signaled 🔥', signalCount });
  } catch (err) {
    console.error('Signal error:', err);
    res.status(500).json({ error: 'Failed to signal interest.' });
  }
});

/**
 * POST /api/rooms/express-interest
 * Pre-lottery demand tracking. Records a student's interest for a specific room.
 * If the student has an accepted pair, records interest for both automatically.
 */
router.post('/express-interest', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user!.id;
    const { roomId } = req.body;

    if (!roomId) {
      res.status(400).json({ error: 'roomId is required.' });
      return;
    }

    // Verify the room exists
    const { rows: roomRows } = await query('SELECT id, capacity FROM rooms WHERE id = $1', [roomId]);
    if (roomRows.length === 0) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    // Fetch student year_group
    const { rows: studentRows } = await query('SELECT year_group FROM students WHERE id = $1', [studentId]);
    if (studentRows.length === 0) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const yearGroup = studentRows[0].year_group;

    // Allotment lock check
    const { rows: lockCheck } = await query(
      "SELECT id FROM waves WHERE year_group = $1 AND status = 'completed' LIMIT 1",
      [yearGroup]
    );
    if (lockCheck.length > 0) {
      res.status(403).json({ error: '🔒 Interest tracking is locked. Allotment has been completed.' });
      return;
    }

    // Check for active wave
    const { rows: waveCheck } = await query(
      "SELECT id FROM waves WHERE year_group = $1 AND (status = 'pending' OR status = 'active') LIMIT 1",
      [yearGroup]
    );
    if (waveCheck.length === 0) {
      res.status(403).json({ error: 'No active or pending wave for your year group.' });
      return;
    }

    // Check for accepted pair — auto-record for both
    const { rows: pairRows } = await query(
      `SELECT inviter_id, invitee_id FROM roommate_pairings
       WHERE (inviter_id = $1 OR invitee_id = $1) AND status = 'accepted' LIMIT 1`,
      [studentId]
    );

    const studentsToRecord = [studentId];
    if (pairRows.length > 0) {
      const partnerId = pairRows[0].inviter_id === studentId ? pairRows[0].invitee_id : pairRows[0].inviter_id;
      studentsToRecord.push(partnerId);
    }

    let recorded = 0;
    for (const sid of studentsToRecord) {
      await query(
        `INSERT INTO room_interest (student_id, room_id, year_group)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, room_id) DO NOTHING`,
        [sid, roomId, yearGroup]
      );
      recorded++;
    }

    // Fetch updated interest count for this room
    const { rows: countRows } = await query(
      'SELECT COUNT(*) AS cnt FROM room_interest WHERE room_id = $1',
      [roomId]
    );
    const interestCount = parseInt(countRows[0].cnt);
    const demandRatio = parseFloat((interestCount / parseInt(roomRows[0].capacity)).toFixed(1));

    // Broadcast demand update
    const io = req.app.get('io');
    broadcastDemandUpdate(io, {
      roomId,
      interestCount,
      demandRatio,
      demandLevel: interestCount > 10 ? 'critical' : interestCount > 5 ? 'high' : interestCount > 2 ? 'medium' : 'low',
    });

    res.json({
      message: `Interest recorded for ${recorded} student(s). ${pairRows.length > 0 ? 'Partner included automatically.' : ''}`,
      interestCount,
      demandRatio,
      pairedRecording: pairRows.length > 0,
    });
  } catch (err) {
    console.error('Express interest error:', err);
    res.status(500).json({ error: 'Failed to record interest.' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/rooms/:id/attempt
// Atomic room selection with:
//   Step 0: Admin bypass (skip all restrictions)
//   Step 1: Wave gatekeeping (year_group based, unified B.Tech + Dual)
//   Step 2: Duplicate assignment check
//   Step 3: Room state pre-check
//   Step 4: C++ mutex-based ConflictResolver
//   Step 5: Atomic SQL UPDATE
//   Step 6: Commit assignment
//   Step 7: WebSocket broadcast
// ═══════════════════════════════════════════════════════════════════
router.post('/:id/attempt', authenticate, authorize('student', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const roomId = req.params.id;
    const studentId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // ── STEP 0: ADMIN BYPASS ──────────────────────────────────
    // Admins (staff with name-based emails) bypass ALL wave timing,
    // year-group restrictions, and room capacity checks.
    // This allows manual overrides and reassignments.
    if (isAdmin) {
      console.log(`  🔑 ADMIN OVERRIDE: ${req.user!.rollNumber} bypassing all checks for room ${roomId}`);

      // For admin: allow specifying a target student via body
      const targetStudentId = req.body.student_id || studentId;
      const result = await withTransaction(async (client) => {
        const { rows: existingAssignment } = await client.query(
          'SELECT room_id FROM room_assignments WHERE student_id = $1',
          [targetStudentId],
        );
        const currentRoomId = existingAssignment[0]?.room_id || null;

        if (currentRoomId === roomId) {
          const { rows: sameRoom } = await client.query(
            'SELECT id, hostel_id, room_number, floor, capacity, occupied, is_available FROM rooms WHERE id = $1',
            [roomId],
          );
          if (sameRoom.length === 0) throw new Error('Room not found.');
          return { room: sameRoom[0], oldRoomId: null };
        }

        const { rows: updatedRoom } = await client.query(
          `UPDATE rooms
           SET occupied = occupied + 1,
               is_available = CASE WHEN occupied + 1 >= capacity THEN false ELSE true END
           WHERE id = $1 AND is_available = true AND occupied < capacity
           RETURNING id, hostel_id, room_number, floor, capacity, occupied, is_available`,
          [roomId],
        );

        if (updatedRoom.length === 0) {
          const { rows: roomExists } = await client.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
          throw new Error(roomExists.length === 0 ? 'Room not found.' : 'Room is already full.');
        }

        if (currentRoomId) {
          await client.query(
            'UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), is_available = true WHERE id = $1',
            [currentRoomId],
          );
        }

        await client.query('DELETE FROM room_assignments WHERE student_id = $1', [targetStudentId]);
        await client.query(
          'INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2)',
          [targetStudentId, roomId],
        );
        await client.query(
          "INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'admin_override')",
          [targetStudentId, roomId],
        );

        return { room: updatedRoom[0], oldRoomId: currentRoomId };
      });

      const room = result.room;

      const { rows: hostelRows } = await query('SELECT id, name, code FROM hostels WHERE id = $1', [room.hostel_id]);
      const hostel = hostelRows[0];

      const io = req.app.get('io');
      broadcastRoomUpdate(io, {
        roomId: room.id,
        hostelId: hostel?.id || '',
        occupied: room.occupied,
        capacity: room.capacity,
        isAvailable: room.is_available,
        lastAction: 'admin_override',
      });

      console.log(`  🔑 Admin assigned room ${room.room_number} to ${targetStudentId}`);
      res.json({
        success: true,
        message: '🔑 Room assigned via admin override.',
        adminOverride: true,
        assignment: { roomId: room.id, roomNumber: room.room_number, floor: room.floor, hostelId: hostel?.id, previousRoomId: result.oldRoomId },
      });
      return;
    }

    // ═══ STUDENT PATH (all checks enforced) ═══════════════════

    // ── ALLOTMENT LOCK CHECK ──────────────────────────────────
    // If the wave for this year group is completed, block all student actions
    const { rows: lockCheck } = await query(
      "SELECT id FROM waves WHERE year_group = (SELECT year_group FROM students WHERE id = $1) AND status = 'completed' LIMIT 1",
      [studentId]
    );
    if (lockCheck.length > 0) {
      res.status(403).json({ error: '🔒 Room selection is locked. Allotment for your year group has been completed.' });
      return;
    }

    // ── STEP 1: WAVE GATEKEEPING (year_group based) ────────────
    // Fetch the student's year_group (auto-populated from roll number at registration).
    // Both B.Tech (1xx) and Dual Degree (5xx) of the same batch share the same
    // year_group, so they compete in the same wave — no degree discrimination.
    const { rows: studentRows } = await query(
      'SELECT year_group, branch, degree_type FROM students WHERE id = $1',
      [studentId],
    );
    const student = studentRows[0];

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const yearGroup = student.year_group;

    if (yearGroup) {
      const { rows: waveRows } = await query(
        `SELECT id, name, gate_open, gate_close
         FROM waves
         WHERE year_group = $1
           AND gate_open <= NOW()
           AND gate_close > NOW()
           AND is_active = true
         LIMIT 1`,
        [yearGroup],
      );

      if (waveRows.length === 0) {
        const { rows: futureWave } = await query(
          'SELECT name, gate_open FROM waves WHERE year_group = $1 AND gate_open > NOW() ORDER BY gate_open LIMIT 1',
          [yearGroup],
        );
        const msg = futureWave.length > 0
          ? `🚫 Selection is not open for Year ${yearGroup} yet. "${futureWave[0].name}" opens at ${new Date(futureWave[0].gate_open).toLocaleString()}.`
          : `🚫 No selection wave is scheduled for Year ${yearGroup}.`;
        res.status(403).json({ error: msg, yearGroup });
        return;
      }
      console.log(`  ✅ Wave gate passed: Year ${yearGroup} ${student.degree_type} (wave: ${waveRows[0].name})`);
    }

    // ── STEP 2: DUPLICATE ASSIGNMENT CHECK ─────────────────────
    const { rows: existingAssignment } = await query(
      'SELECT id FROM room_assignments WHERE student_id = $1',
      [studentId],
    );
    if (existingAssignment.length > 0) {
      res.status(409).json({ error: 'You already have a room assignment.' });
      return;
    }

    // ── STEP 3: FETCH ROOM STATE & ROOMMATES ───────────────────
    const { rows: roomCheck } = await query(
      'SELECT occupied, capacity, is_available FROM rooms WHERE id = $1',
      [roomId],
    );
    if (roomCheck.length === 0) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    const currentRoom = roomCheck[0];

    // Year-Based Room Type Restriction
    // Years 1 & 2: ONLY double rooms (capacity >= 2)
    // Years 3, 4, 5: Both single and double allowed
    if (yearGroup && yearGroup < 3 && currentRoom.capacity === 1) {
      res.status(403).json({
        error: '🔒 Years 1 & 2 are restricted to Double rooms only. Single rooms are reserved for seniors (Year 3+).',
        restriction: 'year_based',
        yearGroup,
        roomType: 'single',
        requiredYearGroup: 3
      });
      return;
    }

    // Check for an accepted roommate
    const { rows: partnerRows } = await query(
      `SELECT inviter_id, invitee_id 
       FROM roommate_pairings 
       WHERE (inviter_id = $1 OR invitee_id = $1) AND status = 'accepted'`,
      [studentId]
    );
    const hasPartner = partnerRows.length > 0;
    const partnerId = hasPartner
      ? (partnerRows[0].inviter_id === studentId ? partnerRows[0].invitee_id : partnerRows[0].inviter_id)
      : null;

    // If we have a partner, we must book 2 slots atomically
    const occupancyIncrease = hasPartner ? 2 : 1;

    if (!currentRoom.is_available || (currentRoom.capacity - currentRoom.occupied < occupancyIncrease)) {
      res.status(409).json({ error: hasPartner ? 'Room cannot fit both you and your partner.' : 'Room is already full.' });
      return;
    }

    // ── STEP 4: C++ MUTEX-BASED CONFLICT RESOLVER ──────────────
    const remainingSlots = currentRoom.capacity - currentRoom.occupied;
    try {
      // Execute standard C++ concurrency logic utilizing occupancy levels 
      const resolverResult = await runConflictResolver(1, occupancyIncrease, remainingSlots);

      const myDecision = resolverResult.decisions?.[0];
      if (!myDecision || !myDecision.success) {
        await query(
          "INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'failed', 'mutex_race_lost')",
          [studentId, roomId],
        );
        res.status(409).json({ error: 'Another student grabbed this room at the exact same millisecond. Try again.' });
        return;
      }

      console.log(`  🔓 Mutex granted in ${resolverResult.elapsed_ms}ms (double_bookings=${resolverResult.double_bookings})`);
    } catch (engineErr: any) {
      console.warn(`  ⚠️  ConflictResolver unavailable (${engineErr.message}), using DB-only lock.`);
    }

    // ── STEP 5: ATOMIC DATABASE UPDATE ─────────────────────────
    let room: any;
    try {
      const txResult = await withTransaction(async (client) => {
        const { rows: updatedRoom } = await client.query(
          `UPDATE rooms
           SET occupied = occupied + $2,
               is_available = CASE WHEN occupied + $2 >= capacity THEN false ELSE true END
           WHERE id = $1 AND is_available = true AND capacity - occupied >= $2
           RETURNING id, hostel_id, room_number, floor, capacity, occupied, is_available`,
          [roomId, occupancyIncrease],
        );

        if (updatedRoom.length === 0) {
          throw new Error('room_full');
        }

        const bookedRoom = updatedRoom[0];

        await client.query(
          'INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2)',
          [studentId, bookedRoom.id],
        );
        await client.query(
          "INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'assigned')",
          [studentId, bookedRoom.id],
        );

        if (hasPartner && partnerId) {
          await client.query(
            'INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2)',
            [partnerId, bookedRoom.id],
          );
          await client.query(
            "INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'assigned_as_partner')",
            [partnerId, bookedRoom.id],
          );
        }

        return bookedRoom;
      });
      room = txResult;
    } catch (error: any) {
      if (error.message === 'room_full') {
        await query(
          "INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'failed', 'room_full')",
          [studentId, roomId],
        );

        const { rows: failRows } = await query(
          "SELECT COUNT(*) AS cnt FROM selection_attempts WHERE room_id = $1 AND status = 'failed'",
          [roomId],
        );
        const failCount = parseInt(failRows[0].cnt);

        const io = req.app.get('io');
        broadcastDemandUpdate(io, {
          roomId,
          demandLevel: failCount > 10 ? 'critical' : failCount > 5 ? 'high' : 'medium',
          attemptCount: failCount,
        });

        res.status(409).json({ error: 'Room was taken. Try another room.' });
        return;
      }

      throw error;
    }

    // ── STEP 7: BROADCAST UPDATE ───────────────────────────────
    const { rows: hostelRows } = await query('SELECT id, name, code FROM hostels WHERE id = $1', [room.hostel_id]);
    const hostel = hostelRows[0];

    const io = req.app.get('io');
    broadcastRoomUpdate(io, {
      roomId: room.id,
      hostelId: hostel?.id || '',
      occupied: room.occupied,
      capacity: room.capacity,
      isAvailable: room.is_available,
      lastAction: 'booked',
    });

    console.log(`  🎉 Room ${room.room_number} assigned to student ${studentId}`);
    res.json({
      success: true,
      message: '🎉 Room assigned successfully!',
      assignment: {
        roomId: room.id,
        roomNumber: room.room_number,
        floor: room.floor,
        hostelId: hostel?.id,
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
    const { rows: hostels } = await query('SELECT * FROM hostels ORDER BY name');
    res.json({ hostels });
  } catch (err) {
    console.error('List hostels error:', err);
    res.status(500).json({ error: 'Failed to fetch hostels.' });
  }
});

// GET /api/rooms/waves/status — get active wave info for current user
router.get('/waves/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: studentRows } = await query(
      'SELECT year_group, branch, degree_type FROM students WHERE id = $1',
      [req.user!.id],
    );
    const yearGroup = studentRows[0]?.year_group;

    if (!yearGroup) {
      res.json({ wave: null, gateOpen: false, message: 'Year group not set.' });
      return;
    }

    // 1. Check if the allotment is already COMPLETED for this year group
    const { rows: completedWave } = await query(
      "SELECT * FROM waves WHERE year_group = $1 AND status = 'completed' LIMIT 1",
      [yearGroup]
    );

    if (completedWave.length > 0) {
      res.json({
        wave: completedWave[0],
        gateOpen: false, // BUTTON INACTIVE
        message: 'Allotment finalized. Selection is closed for your batch.',
      });
      return;
    }

    // 2. Check if a wave is currently ACTIVE
    const { rows: activeWave } = await query(
      'SELECT * FROM waves WHERE year_group = $1 AND gate_open <= NOW() AND gate_close > NOW() AND is_active = true LIMIT 1',
      [yearGroup],
    );

    if (activeWave.length > 0) {
      res.json({
        wave: activeWave[0],
        gateOpen: true, // BUTTON ACTIVE
        message: `Wave "${activeWave[0].name}" is OPEN for Year ${yearGroup}!`,
      });
      return;
    }

    // 3. Otherwise, check for the NEXT scheduled wave
    const { rows: nextWave } = await query(
      'SELECT * FROM waves WHERE year_group = $1 AND gate_open > NOW() ORDER BY gate_open LIMIT 1',
      [yearGroup],
    );

    res.json({
      wave: nextWave[0] || null,
      gateOpen: false, // BUTTON INACTIVE
      message: nextWave.length > 0
        ? `Selection opens at ${new Date(nextWave[0].gate_open).toLocaleString()}`
        : 'No selection wave is currently scheduled for your batch.',
    });

  } catch (err) {
    console.error('Wave status error:', err);
    res.status(500).json({ error: 'Failed to fetch wave status.' });
  }
});


export default router;
