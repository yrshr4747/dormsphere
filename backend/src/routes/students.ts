import { Router, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { vectorizeSurvey, calculateCompatibility } from '../services/vectorizer';
import bcrypt from 'bcryptjs';
import { upload } from '../middleware/upload';
import { uploadToCloudinary } from '../services/cloudinary';

const router = Router();

// POST /api/student/survey
router.post('/survey', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const answers = req.body;
    
    let vector: { sleep: number; study: number; social: number };
    if (answers.sleep !== undefined && answers.study !== undefined && answers.social !== undefined) {
      // Scale 1-5 slider values into 2-10 vector score 
      vector = {
        sleep: Math.min(10, (parseFloat(answers.sleep) || 3) * 2),
        study: Math.min(10, (parseFloat(answers.study) || 3) * 2),
        social: Math.min(10, (parseFloat(answers.social) || 3) * 2)
      };
    } else {
      vector = vectorizeSurvey(answers);
    }

    await query(
      `INSERT INTO vectors (student_id, sleep, study, social, raw_answers)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id) DO UPDATE SET sleep = $2, study = $3, social = $4, raw_answers = $5`,
      [req.user!.id, vector.sleep, vector.study, vector.social, JSON.stringify(answers)],
    );

    res.json({ message: 'Survey submitted successfully.', vector });
  } catch (err) {
    console.error('Survey error:', err);
    res.status(500).json({ error: 'Survey submission failed.' });
  }
});

// GET /api/student/vector
router.get('/vector', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT sleep, study, social FROM vectors WHERE student_id = $1', [req.user!.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'No survey data found. Please complete the personality survey.' }); return; }
    res.json({ vector: { sleep: parseFloat(rows[0].sleep), study: parseFloat(rows[0].study), social: parseFloat(rows[0].social) } });
  } catch (err) {
    console.error('Vector fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch vector.' });
  }
});

// GET /api/student/match
router.get('/match', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT m.*, sa.name AS name_a, sa.roll_number AS roll_a, sb.name AS name_b, sb.roll_number AS roll_b
      FROM matches m
      JOIN students sa ON sa.id = m.student_a
      JOIN students sb ON sb.id = m.student_b
      WHERE m.student_a = $1 OR m.student_b = $1
      ORDER BY m.created_at DESC LIMIT 1
    `, [req.user!.id]);

    if (rows.length === 0) {
      res.json({ match: null });
      return;
    }

    const match = rows[0];
    const isA = match.student_a === req.user!.id;
    const partner = {
      id: isA ? match.student_b : match.student_a,
      name: isA ? match.name_b : match.name_a,
      rollNumber: isA ? match.roll_b : match.roll_a,
    };

    res.json({
      match: {
        partnerId: partner.id,
        partnerName: partner.name,
        partnerRoll: partner.rollNumber,
        compatibilityScore: parseFloat(match.compatibility_score),
        matchedAt: match.created_at,
      },
    });
  } catch (err) {
    console.error('Match fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch match.' });
  }
});

// GET /api/student/top-matches
// Returns top 5 compatible roommates based on vector similarity (same year only)
router.get('/top-matches', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: myVecRows } = await query(`
      SELECT v.sleep, v.study, v.social, s.year_group 
      FROM vectors v 
      JOIN students s ON s.id = v.student_id 
      WHERE v.student_id = $1
    `, [req.user!.id]);

    if (myVecRows.length === 0) {
      res.status(404).json({ error: 'Please complete the personality survey to find matches.' });
      return;
    }

    const { sleep, study, social, year_group } = myVecRows[0];
    const myVector = {
      sleep: parseFloat(sleep),
      study: parseFloat(study),
      social: parseFloat(social)
    };

    // Fetch only students in the same year who have filled the survey
    const { rows: allVectors } = await query(`
      SELECT v.student_id, v.sleep, v.study, v.social, s.name, s.roll_number, s.department
      FROM vectors v
      JOIN students s ON s.id = v.student_id
      WHERE v.student_id != $1 AND s.year_group = $2
    `, [req.user!.id, year_group]);

    const matches = allVectors.map(v => {
      const targetVector = {
        sleep: parseFloat(v.sleep),
        study: parseFloat(v.study),
        social: parseFloat(v.social)
      };
      const score = calculateCompatibility(myVector, targetVector);
      return {
        id: v.student_id,
        name: v.name,
        rollNumber: v.roll_number,
        department: v.department,
        compatibilityScore: score
      };
    });

    const topMatches = matches
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 5);

    res.json({ matches: topMatches });
  } catch (err) {
    console.error('Top matches error:', err);
    res.status(500).json({ error: 'Failed to calculate matches.' });
  }
});

// GET /api/student/compatibility/:targetId
router.get('/compatibility/:targetId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: myVecRows } = await query('SELECT sleep, study, social FROM vectors WHERE student_id = $1', [req.user!.id]);
    const { rows: targetVecRows } = await query('SELECT sleep, study, social FROM vectors WHERE student_id = $1', [req.params.targetId]);
    if (myVecRows.length === 0 || targetVecRows.length === 0) { res.status(404).json({ error: 'Survey data missing for one or both students.' }); return; }
    const score = calculateCompatibility(myVecRows[0], targetVecRows[0]);
    res.json({ compatibilityScore: score });
  } catch (err) {
    console.error('Compatibility error:', err);
    res.status(500).json({ error: 'Compatibility check failed.' });
  }
});

// GET /api/student/assignment
router.get('/assignment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT ra.assigned_at, r.room_number, r.floor, r.capacity, r.occupied,
             h.name AS hostel_name, h.code AS hostel_code
      FROM room_assignments ra
      JOIN rooms r ON r.id = ra.room_id
      JOIN hostels h ON h.id = r.hostel_id
      WHERE ra.student_id = $1
    `, [req.user!.id]);

    if (rows.length === 0) {
      res.json({ assignment: null });
      return;
    }

    const a = rows[0];
    res.json({
      assignment: {
        room_number: a.room_number,
        floor: a.floor,
        capacity: a.capacity,
        occupied: a.occupied,
        hostel_name: a.hostel_name,
        hostel_code: a.hostel_code,
        assigned_at: a.assigned_at,
      },
    });
  } catch (err) {
    console.error('Assignment fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch assignment.' });
  }
});

// GET /api/student/retention/status
router.get('/retention/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: studentRows } = await query(
      'SELECT retention_status, previous_room_id, year_group FROM students WHERE id = $1',
      [req.user!.id]
    );

    const { rows: settingRows } = await query("SELECT value FROM sys_settings WHERE key = 'retention_window_active'");
    const retentionWindowActive = settingRows.length > 0 ? settingRows[0].value === 'true' : false;

    if (studentRows.length === 0) return res.status(404).json({ error: 'Student not found.' });

    let previousRoom = null;
    if (studentRows[0].previous_room_id) {
       const { rows: pr } = await query(
         'SELECT r.room_number, h.name AS hostel_name, r.capacity FROM rooms r JOIN hostels h ON h.id = r.hostel_id WHERE r.id = $1',
         [studentRows[0].previous_room_id]
       );
       if (pr.length > 0) previousRoom = pr[0];
    }

    res.json({
      retentionStatus: studentRows[0].retention_status,
      previousRoom,
      retentionWindowActive,
      yearGroup: studentRows[0].year_group
    });
  } catch (err) {
    console.error('Retention fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch retention status.' });
  }
});

// POST /api/student/retention
router.post('/retention', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body; // 'retain' or 'release'
    if (!['retain', 'release'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

    const { rows: studentRows } = await query('SELECT retention_status, previous_room_id, year_group FROM students WHERE id = $1', [req.user!.id]);
    const student = studentRows[0];

    if (!student || student.year_group < 3) return res.status(403).json({ error: 'Not eligible for retention.' });
    if (student.retention_status !== 'none') return res.status(400).json({ error: 'Retention choice already made.' });

    const { rows: settingRows } = await query("SELECT value FROM sys_settings WHERE key = 'retention_window_active'");
    if (!settingRows.length || settingRows[0].value !== 'true') return res.status(403).json({ error: 'Retention window is closed.' });

    if (action === 'release') {
      await query("UPDATE students SET retention_status = 'released', updated_at = NOW() WHERE id = $1", [req.user!.id]);
      res.json({ message: 'Room released successfully. You will enter the wave pool.' });
      return;
    }

    // Action = 'retain'
    if (!student.previous_room_id) return res.status(400).json({ error: 'No previous room found to retain.' });

    try {
      await withTransaction(async (client) => {
        const { rows: roomRows } = await client.query(
        `UPDATE rooms SET occupied = occupied + 1, is_available = CASE WHEN occupied + 1 >= capacity THEN false ELSE true END
         WHERE id = $1 AND is_available = true AND occupied < capacity RETURNING id`,
          [student.previous_room_id],
        );

        if (roomRows.length === 0) throw new Error('Previous room is already fully booked or unavailable.');

        await client.query("UPDATE students SET retention_status = 'retained', updated_at = NOW() WHERE id = $1", [req.user!.id]);
        await client.query("INSERT INTO room_assignments (student_id, room_id) VALUES ($1, $2)", [req.user!.id, student.previous_room_id]);
        await client.query("INSERT INTO selection_attempts (student_id, room_id, status, reason) VALUES ($1, $2, 'success', 'retained')", [req.user!.id, student.previous_room_id]);
      });
      res.json({ message: 'Room retained successfully! 🎉' });
    } catch (txErr: any) {
      res.status(400).json({ error: txErr.message });
    }
  } catch (err) {
    console.error('Retention post error:', err);
    res.status(500).json({ error: 'Failed to process retention.' });
  }
});

// PUT /api/student/profile-image
router.put('/profile-image', authenticate, upload.single('profileImage'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image uploaded.' });
      return;
    }
    const url = await uploadToCloudinary(req.file.buffer, 'dormsphere/profiles');
    await query('UPDATE students SET profile_image_url = $1, updated_at = NOW() WHERE id = $2', [url, req.user!.id]);
    res.json({ message: 'Profile image updated.', profileImageUrl: url });
  } catch (err) {
    console.error('Profile image update error:', err);
    res.status(500).json({ error: 'Failed to update profile image.' });
  }
});

// PUT /api/student/password
router.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
       res.status(400).json({ error: 'Missing current or new password.' });
       return;
    }

    const { rows } = await query('SELECT password_hash FROM students WHERE id = $1', [req.user!.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'User not found.' }); return; }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect.' }); return; }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE students SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user!.id]);
    
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export default router;
