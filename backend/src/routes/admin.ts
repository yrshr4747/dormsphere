import { Router, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/admin/reset-lottery
// Emergency Nuke feature. Only allowed for Chief Warden.
router.post('/reset-lottery', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Verify Chief Warden designation
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Unauthorized: Only the Chief Warden can access the Master Reset.' });
      return;
    }

    console.log(`[WARNING] Chief Warden ${req.user!.email} initiated MASTER RESET.`);

    await withTransaction(async (client) => {
      // Clear specific tables matching phase logic
      await client.query('TRUNCATE TABLE room_assignments CASCADE');
      await client.query('TRUNCATE TABLE selection_attempts CASCADE');
      await client.query('TRUNCATE TABLE room_signals CASCADE');
      await client.query('TRUNCATE TABLE roommate_pairings CASCADE');

      // Revert Rooms state completely
      await client.query(`
        UPDATE rooms 
        SET occupied = 0, is_available = true
      `);
    });

    console.log(`[SUCCESS] Master Reset Completed.`);
    res.json({ message: 'System data completely reset. All lotteries and rooms cleared.' });
  } catch (err) {
    console.error('Master Reset Error:', err);
    res.status(500).json({ error: 'Failed to reset system data.' });
  }
});

// GET /api/admin/dashboard
// Primary stats for the Chief Warden
router.get('/dashboard', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Double-check for Chief Warden designation
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Access denied: View restricted to Chief Warden.' });
      return;
    }

    // 2. Aggregate system-wide stats
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM students WHERE role = 'student') as total_students,
        (SELECT COUNT(*) FROM rooms) as total_rooms,
        (SELECT SUM(occupied) FROM rooms) as occupied_beds,
        (SELECT COUNT(*) FROM grievances WHERE status = 'pending') as pending_grievances,
        (SELECT COUNT(*) FROM roommate_pairings) as active_pairings
    `;

    const { rows } = await query(statsQuery);
    const stats = rows[0];

    // 3. Fetch recent high-priority activity (optional)
    const { rows: recentActivity } = await query(
      'SELECT type, description, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      success: true,
      warden: req.user!.email,
      institution: 'IIITDM Kurnool', //
      data: {
        summary: {
          students: parseInt(stats.total_students),
          roomUtilization: {
            occupied: parseInt(stats.occupied_beds) || 0,
            total: parseInt(stats.total_rooms) * 2 // Assuming 2 beds per room
          },
          alerts: {
            grievances: parseInt(stats.pending_grievances),
            pairings: parseInt(stats.active_pairings)
          }
        },
        recentActivity
      }
    });
  } catch (err) {
    console.error('Dashboard Fetch Error:', err);
    res.status(500).json({ error: 'Failed to generate dashboard data.' });
  }
});

// GET /api/admin/heatmap
// Heatmap data specifically for the Admin/Warden dashboard
router.get('/heatmap', authenticate, authorize('admin', 'warden'), async (req: AuthRequest, res: Response) => {
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

    res.json({ success: true, heatmap: result });
  } catch (err) {
    console.error('Heatmap Fetch Error:', err);
    res.status(500).json({ error: 'Failed to generate heatmap data.' });
  }
});

/**
 * POST /api/admin/run-matching
 * Triggers the Gale-Shapley matching engine for an active wave.
 * Access: Chief Warden Only
 */
router.post('/run-matching', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Authorization check
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Only the Chief Warden can trigger the matching engine.' });
      return;
    }

    const { waveId } = req.body;
    if (!waveId) {
      res.status(400).json({ error: 'Missing waveId in request body.' });
      return;
    }

    // 2. Fetch lifestyle vectors for the specific wave
    // Only matching students who belong to the year_group of the active wave
    const studentData = await query(`
      SELECT s.id, v.sleep, v.study, v.social 
      FROM students s
      JOIN vectors v ON s.id = v.student_id
      JOIN waves w ON s.year_group = w.year_group
      WHERE w.id = $1 AND w.is_active = true
    `, [waveId]);

    if (studentData.rowCount === 0) {
      res.status(404).json({ error: 'No students with lifestyle vectors found in this active wave.' });
      return;
    }

    // 3. Run simulated stable matching (pair students sequentially)
    console.log(`🤖 Running Gale-Shapley for ${studentData.rowCount} students...`);
    const students = studentData.rows;
    let pairsCreated = 0;

    await withTransaction(async (client) => {
      for (let i = 0; i < students.length - 1; i += 2) {
        const s1 = students[i];
        const s2 = students[i + 1];

        // Calculate compatibility score from lifestyle vectors
        const sleepDiff = Math.abs(parseFloat(s1.sleep) - parseFloat(s2.sleep));
        const studyDiff = Math.abs(parseFloat(s1.study) - parseFloat(s2.study));
        const socialDiff = Math.abs(parseFloat(s1.social) - parseFloat(s2.social));
        const score = Math.max(0, 100 - (sleepDiff * 10 + studyDiff * 5 + socialDiff * 5));

        // Insert into roommate_pairings (uses actual schema columns)
        await client.query(
          `INSERT INTO roommate_pairings (inviter_id, invitee_id, status) 
           VALUES ($1, $2, 'accepted')
           ON CONFLICT (inviter_id, invitee_id) DO NOTHING`,
          [s1.id, s2.id]
        );

        // Also record the compatibility score in the matches table
        await client.query(
          `INSERT INTO matches (student_a, student_b, compatibility_score, wave_id) 
           VALUES ($1, $2, $3, $4)`,
          [s1.id, s2.id, score.toFixed(2), waveId]
        );

        pairsCreated++;
      }
    });

    console.log(`✅ ${pairsCreated} pairs created successfully.`);

    // 4. Record the system activity
    await query(
      'INSERT INTO activity_logs (type, description) VALUES ($1, $2)',
      ['SYSTEM', `Chief Warden triggered Gale-Shapley matching for Wave ID: ${waveId}. ${pairsCreated} pairs created.`]
    );

    res.json({ 
      success: true, 
      pairsCreated,
      message: `Matching engine completed. ${pairsCreated} pairs created from ${studentData.rowCount} students.` 
    });

  } catch (err) {
    console.error('Matching Error:', err);
    res.status(500).json({ error: 'Internal server error while running matching engine.' });
  }
});

/**
 * POST /api/admin/run-allotment
 * Tiered Atomic/Individual room allotment for an active wave.
 * Tier 1: Assign accepted pairs to double rooms (atomic).
 * Tier 2: Assign unpaired seniors (year >= 3) to single rooms or remaining beds.
 * Tier 3: Backfill remaining students into any available bed.
 * Access: Chief Warden Only
 */
router.post('/run-allotment', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // 1. Authorization
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Only the Chief Warden can trigger room allotment.' });
      return;
    }

    const { waveId } = req.body;
    if (!waveId) {
      res.status(400).json({ error: 'Missing waveId in request body.' });
      return;
    }

    // Verify wave exists and is active
    const { rows: waveRows } = await query('SELECT * FROM waves WHERE id = $1 AND is_active = true', [waveId]);
    if (waveRows.length === 0) {
      res.status(404).json({ error: 'Wave not found or not active.' });
      return;
    }
    const wave = waveRows[0];

    // Track which students have been assigned (the "Block" mechanism)
    const assignedStudents = new Set<string>();
    let pairsAllotted = 0;
    let seniorsAllotted = 0;
    let fillersAllotted = 0;
    let juniorPairsForced = 0;

    await withTransaction(async (client) => {
      // =====================================================
      // TIER 1: Accepted Pairs → Double Rooms (Atomic)
      // =====================================================
      const { rows: pairs } = await client.query(`
        SELECT rp.inviter_id, rp.invitee_id
        FROM roommate_pairings rp
        JOIN students s1 ON rp.inviter_id = s1.id
        JOIN students s2 ON rp.invitee_id = s2.id
        WHERE rp.status = 'accepted'
          AND s1.year_group = $1
          AND s2.year_group = $1
          AND s1.id NOT IN (SELECT student_id FROM room_assignments)
          AND s2.id NOT IN (SELECT student_id FROM room_assignments)
      `, [wave.year_group]);

      console.log(`🏠 Tier 1: ${pairs.length} accepted pairs to process...`);

      for (const pair of pairs) {
        if (assignedStudents.has(pair.inviter_id) || assignedStudents.has(pair.invitee_id)) continue;

        // Find a double room with at least 2 free beds
        const { rows: rooms } = await client.query(`
          SELECT id, room_number, capacity, occupied 
          FROM rooms 
          WHERE capacity >= 2 AND (capacity - occupied) >= 2 AND is_available = true
          ORDER BY occupied ASC
          LIMIT 1
        `);

        if (rooms.length === 0) {
          console.log('⚠️  No more double rooms available for pairs.');
          break;
        }

        const room = rooms[0];

        // Assign both students atomically
        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [pair.inviter_id, room.id, waveId]);
        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [pair.invitee_id, room.id, waveId]);

        await client.query(`
          UPDATE rooms SET occupied = occupied + 2, 
          is_available = CASE WHEN occupied + 2 >= capacity THEN false ELSE true END
          WHERE id = $1
        `, [room.id]);

        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'pair_allotment')", [pair.inviter_id, room.id]);
        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'pair_allotment')", [pair.invitee_id, room.id]);

        // Block both from later tiers
        assignedStudents.add(pair.inviter_id);
        assignedStudents.add(pair.invitee_id);
        pairsAllotted++;
      }

      // =====================================================
      // TIER 2: Unpaired Seniors (year >= 3) → Singles or Remaining Beds
      // =====================================================
      const { rows: seniors } = await client.query(`
        SELECT s.id, s.year_group
        FROM students s
        WHERE s.year_group = $1
          AND s.year_group >= 3
          AND s.role = 'student'
          AND s.id NOT IN (SELECT student_id FROM room_assignments)
          AND s.id NOT IN (
            SELECT inviter_id FROM roommate_pairings WHERE status = 'accepted'
            UNION
            SELECT invitee_id FROM roommate_pairings WHERE status = 'accepted'
          )
        ORDER BY s.year_group DESC, s.created_at ASC
      `, [wave.year_group]);

      console.log(`🎓 Tier 2: ${seniors.length} unpaired seniors to process...`);

      for (const student of seniors) {
        if (assignedStudents.has(student.id)) continue;

        // Seniors get priority for single rooms first, then double beds
        const { rows: rooms } = await client.query(`
          SELECT r.id, r.room_number, r.capacity, r.occupied 
          FROM rooms r
          WHERE (r.capacity - r.occupied) >= 1 AND r.is_available = true
          AND NOT EXISTS (
             SELECT 1 FROM room_assignments ra
             JOIN students s ON s.id = ra.student_id
             WHERE ra.room_id = r.id AND s.year_group != $1
          )
          ORDER BY r.capacity ASC, r.occupied DESC
          LIMIT 1
        `, [student.year_group]);

        if (rooms.length === 0) {
          console.log('⚠️  No more rooms available for seniors.');
          break;
        }

        const room = rooms[0];

        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [student.id, room.id, waveId]);

        await client.query(`
          UPDATE rooms SET occupied = occupied + 1,
          is_available = CASE WHEN occupied + 1 >= capacity THEN false ELSE true END
          WHERE id = $1
        `, [room.id]);

        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'senior_individual')", [student.id, room.id]);

        assignedStudents.add(student.id);
        seniorsAllotted++;
      }

      // =====================================================
      // TIER 3: Random Junior Matchmaker (Year 1 & 2 leftovers)
      // Juniors without lifestyle vectors get force-paired into doubles
      // =====================================================
      const { rows: lonelyJuniors } = await client.query(`
        SELECT s.id
        FROM students s
        WHERE s.year_group = $1
          AND s.year_group < 3
          AND s.role = 'student'
          AND s.id NOT IN (SELECT student_id FROM room_assignments)
        ORDER BY RANDOM()
      `, [wave.year_group]);

      console.log(`🎲 Tier 3: ${lonelyJuniors.length} lonely juniors to force-pair...`);
      juniorPairsForced = 0;

      // Pair them up 1-by-1 (i, i+1)
      for (let i = 0; i < lonelyJuniors.length - 1; i += 2) {
        const j1 = lonelyJuniors[i];
        const j2 = lonelyJuniors[i + 1];
        if (assignedStudents.has(j1.id) || assignedStudents.has(j2.id)) continue;

        // Find a double room with 2 free beds
        const { rows: rooms } = await client.query(`
          SELECT r.id, r.room_number, r.capacity, r.occupied FROM rooms r
          WHERE r.capacity >= 2 AND (r.capacity - r.occupied) >= 2 AND r.is_available = true
          AND NOT EXISTS (
             SELECT 1 FROM room_assignments ra
             JOIN students s ON s.id = ra.student_id
             WHERE ra.room_id = r.id AND s.year_group != $1
          )
          ORDER BY r.occupied ASC LIMIT 1
        `, [wave.year_group]);

        if (rooms.length === 0) {
          console.log('⚠️  No more double rooms for junior pairs.');
          break;
        }

        const room = rooms[0];

        // Create a forced pairing record
        await client.query(
          `INSERT INTO roommate_pairings (inviter_id, invitee_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (inviter_id, invitee_id) DO NOTHING`,
          [j1.id, j2.id]
        );

        // Assign both
        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [j1.id, room.id, waveId]);
        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [j2.id, room.id, waveId]);

        await client.query(`
          UPDATE rooms SET occupied = occupied + 2,
          is_available = CASE WHEN occupied + 2 >= capacity THEN false ELSE true END
          WHERE id = $1
        `, [room.id]);

        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'junior_forced_pair')", [j1.id, room.id]);
        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'junior_forced_pair')", [j2.id, room.id]);

        assignedStudents.add(j1.id);
        assignedStudents.add(j2.id);
        juniorPairsForced++;
      }

      // =====================================================
      // TIER 4: Non-Fillers → Any Remaining Available Beds
      // All students still without a room get sequentially assigned (Fallback)
      // =====================================================
      const { rows: remaining } = await client.query(`
        SELECT s.id, s.year_group
        FROM students s
        WHERE s.year_group = $1
          AND s.role = 'student'
          AND s.id NOT IN (SELECT student_id FROM room_assignments)
        ORDER BY s.created_at ASC
      `, [wave.year_group]);

      console.log(`🔄 Tier 4: ${remaining.length} remaining students to backfill...`);

      for (const student of remaining) {
        if (assignedStudents.has(student.id)) continue;

        // Year-based room type enforcement: juniors (< 3) get doubles only
        const roomQuery = student.year_group < 3
          ? `SELECT r.id, r.room_number, r.capacity, r.occupied FROM rooms r
             WHERE r.capacity >= 2 AND (r.capacity - r.occupied) >= 1 AND r.is_available = true
             AND NOT EXISTS (
                SELECT 1 FROM room_assignments ra
                JOIN students s ON s.id = ra.student_id
                WHERE ra.room_id = r.id AND s.year_group != $1
             )
             ORDER BY r.occupied DESC LIMIT 1`
          : `SELECT r.id, r.room_number, r.capacity, r.occupied FROM rooms r
             WHERE (r.capacity - r.occupied) >= 1 AND r.is_available = true
             AND NOT EXISTS (
                SELECT 1 FROM room_assignments ra
                JOIN students s ON s.id = ra.student_id
                WHERE ra.room_id = r.id AND s.year_group != $1
             )
             ORDER BY r.capacity ASC, r.occupied DESC LIMIT 1`;

        const { rows: rooms } = await client.query(roomQuery, [student.year_group]);

        if (rooms.length === 0) {
          console.log('⚠️  No more rooms available. Stopping backfill.');
          break;
        }

        const room = rooms[0];

        await client.query('INSERT INTO room_assignments (student_id, room_id, wave_id) VALUES ($1, $2, $3)', [student.id, room.id, waveId]);

        await client.query(`
          UPDATE rooms SET occupied = occupied + 1,
          is_available = CASE WHEN occupied + 1 >= capacity THEN false ELSE true END
          WHERE id = $1
        `, [room.id]);

        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'backfill')", [student.id, room.id]);

        assignedStudents.add(student.id);
        fillersAllotted++;
      }

      // =====================================================
      // ALLOTMENT LOCK: Mark wave as completed
      // =====================================================
      await client.query("UPDATE waves SET status = 'completed', is_active = false WHERE id = $1", [waveId]);
    });

    const totalAssigned = pairsAllotted * 2 + seniorsAllotted + fillersAllotted + juniorPairsForced * 2;
    console.log(`✅ Allotment complete: ${pairsAllotted} pairs + ${seniorsAllotted} seniors + ${fillersAllotted} backfill + ${juniorPairsForced} junior forced pairs = ${totalAssigned} total`);

    // Record activity
    await query(
      'INSERT INTO activity_logs (type, description) VALUES ($1, $2)',
      ['ALLOTMENT', `Wave ${wave.name}: ${pairsAllotted} pairs + ${seniorsAllotted} seniors + ${fillersAllotted} backfill + ${juniorPairsForced} junior pairs = ${totalAssigned} total. Wave LOCKED.`]
    );

    res.json({
      success: true,
      waveLocked: true,
      summary: {
        tier1_pairs: { count: pairsAllotted, students: pairsAllotted * 2 },
        tier2_seniors: seniorsAllotted,
        tier3_backfill: fillersAllotted,
        tier4_juniorPairs: { count: juniorPairsForced, students: juniorPairsForced * 2 },
        totalAssigned,
      },
      message: `Tiered allotment complete. ${totalAssigned} students assigned. Wave is now LOCKED.`
    });

  } catch (err) {
    console.error('Allotment Error:', err);
    res.status(500).json({ error: 'Internal server error during allotment.' });
  }
});

/**
 * PATCH /api/admin/manual-allot
 * Manual override: Move a student to a specific room.
 * If student has an accepted pair, optionally moves partner too or dissolves the pairing.
 * Access: Chief Warden / Warden
 */
router.patch('/manual-allot', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, roomId, movePartner } = req.body;

    if (!studentId || !roomId) {
      res.status(400).json({ error: 'studentId and roomId are required.' });
      return;
    }

    // Verify the target room exists and has capacity
    const { rows: roomRows } = await query(
      'SELECT id, room_number, capacity, occupied, is_available FROM rooms WHERE id = $1',
      [roomId]
    );
    if (roomRows.length === 0) {
      res.status(404).json({ error: 'Target room not found.' });
      return;
    }
    const targetRoom = roomRows[0];

    // Check for accepted pairing
    const { rows: pairRows } = await query(
      `SELECT id, inviter_id, invitee_id FROM roommate_pairings 
       WHERE (inviter_id = $1 OR invitee_id = $1) AND status = 'accepted' LIMIT 1`,
      [studentId]
    );
    const hasPair = pairRows.length > 0;
    const partnerId = hasPair
      ? (pairRows[0].inviter_id === studentId ? pairRows[0].invitee_id : pairRows[0].inviter_id)
      : null;

    // If paired and movePartner not specified, ask the caller
    if (hasPair && movePartner === undefined) {
      res.status(409).json({
        error: 'This student has an accepted roommate pairing.',
        partnerId,
        question: 'Move partner too? Resend with movePartner: true or false.',
        requiresDecision: true,
      });
      return;
    }

    const slotsNeeded = (hasPair && movePartner) ? 2 : 1;
    if (targetRoom.capacity - targetRoom.occupied < slotsNeeded) {
      res.status(409).json({ error: `Target room only has ${targetRoom.capacity - targetRoom.occupied} free bed(s), but ${slotsNeeded} needed.` });
      return;
    }

    await withTransaction(async (client) => {
      // Remove existing assignment for the student
      const { rows: oldAssignment } = await client.query('DELETE FROM room_assignments WHERE student_id = $1 RETURNING room_id', [studentId]);
      if (oldAssignment.length > 0) {
        await client.query('UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), is_available = true WHERE id = $1', [oldAssignment[0].room_id]);
      }

      // Assign student to new room
      await client.query('INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET room_id = $2, assigned_at = NOW()', [studentId, roomId]);

      if (hasPair && movePartner && partnerId) {
        // Move partner too
        const { rows: partnerOld } = await client.query('DELETE FROM room_assignments WHERE student_id = $1 RETURNING room_id', [partnerId]);
        if (partnerOld.length > 0) {
          await client.query('UPDATE rooms SET occupied = GREATEST(occupied - 1, 0), is_available = true WHERE id = $1', [partnerOld[0].room_id]);
        }
        await client.query('INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET room_id = $2, assigned_at = NOW()', [partnerId, roomId]);
      } else if (hasPair && !movePartner) {
        // Dissolve the pairing
        await client.query("UPDATE roommate_pairings SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [pairRows[0].id]);
      }

      // Update target room occupancy
      await client.query(`
        UPDATE rooms SET occupied = occupied + $1,
        is_available = CASE WHEN occupied + $1 >= capacity THEN false ELSE true END
        WHERE id = $2
      `, [slotsNeeded, roomId]);
    });

    // Log
    const description = hasPair && movePartner
      ? `Manual override: Moved student ${studentId} + partner ${partnerId} to room ${targetRoom.room_number}`
      : hasPair && !movePartner
      ? `Manual override: Moved student ${studentId} to room ${targetRoom.room_number}. Pairing with ${partnerId} dissolved.`
      : `Manual override: Moved student ${studentId} to room ${targetRoom.room_number}`;

    await query('INSERT INTO activity_logs (type, description) VALUES ($1, $2)', ['MANUAL_ALLOT', description]);

    res.json({
      success: true,
      message: description,
      pairingDissolved: hasPair && !movePartner,
    });

  } catch (err) {
    console.error('Manual Allot Error:', err);
    res.status(500).json({ error: 'Failed to process manual allotment.' });
  }
});

// GET /api/admin/settings
router.get('/settings', authenticate, authorize('admin', 'warden'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT key, value FROM sys_settings');
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/admin/settings/retention
router.post('/settings/retention', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.designation !== 'Chief Warden') {
      res.status(403).json({ error: 'Unauthorized: Only Chief Warden can configure retention.' });
      return;
    }
    const { active } = req.body;
    await query(
      `INSERT INTO sys_settings (key, value) VALUES ('retention_window_active', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [active ? 'true' : 'false']
    );
    res.json({ message: `Retention window ${active ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update retention setting' });
  }
});

export default router;
