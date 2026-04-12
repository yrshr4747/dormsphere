import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection';
import { generateOTP, sendOTP } from '../services/email';
import { parseIdentity, UserIdentity } from '../utils/parseIdentity';
import { upload } from '../middleware/upload';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = 86400; // 24 hours

type RegisterRequest = Request & {
  file?: { filename?: string };
  identity?: UserIdentity;
};

// POST /api/auth/register — Step 1: send OTP (bypassed if super-admin)
router.post('/register', upload.single('profileImage'), async (req: RegisterRequest, res: Response) => {
  console.log('>>>> RAW BODY:', req.body);
  console.log('>>>> FILE RECEIVED:', req.file ? req.file.filename : 'NO FILE');
  console.log('>>>> HEADERS:', req.headers['content-type']);
  try {
    const { rollNumber, name, email, password, designation } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    const identity = parseIdentity(email, rollNumber);
    if (!identity) {
      res.status(400).json({
        error: 'Invalid email or roll number. Must be @iiitk.ac.in. Student rolls must follow 123CS0076 pattern.',
      });
      return;
    }

    // Check existing user
    const { rows: existing } = await query(
      'SELECT id FROM students WHERE email = $1 OR ($2::text IS NOT NULL AND roll_number = $2::text) LIMIT 1',
      [email, rollNumber || null],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email or roll number already exists.' });
      return;
    }

    if (identity.isVerified) {
      // Super Admin Fast-Path Bypass
      res.json({
        message: 'Super Admin bypass. Proceed directly to verification.',
        requiresOTP: false,
        email,
        detectedRole: identity.role,
        designation: identity.designation,
      });
      return;
    }

    // Normal User OTP flow
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query("DELETE FROM otps WHERE email = $1 AND purpose = 'registration'", [email]);
    await query(
      'INSERT INTO otps (email, otp, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [email, otp, 'registration', expiresAt],
    );

    await sendOTP(email, otp);

    res.json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      requiresOTP: true,
      email,
      detectedRole: identity.role,
      ...(identity.role === 'student' ? {
        parsed: {
          branch: identity.branch,
          branchName: identity.branchName,
          degreeType: identity.degreeType,
          yearGroup: identity.yearGroup,
        },
      } : {}),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});


// Step 2 Validation Middleware
const validateRegister = (req: RegisterRequest, res: Response, next: any) => {
  const { email, name, password, rollNumber } = req.body;

  console.log('MIDDLEWARE CHECK:', req.body);

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required.' });
    return;
  }

  const identity = parseIdentity(email, rollNumber);
  if (!identity) {
    res.status(400).json({ error: 'Invalid email or roll number validation.' });
    return;
  }

  req.identity = identity;
  next();
};

// Step 2 Controller Logic
const registerController = async (req: RegisterRequest, res: Response) => {
  try {
    const { email, otp, rollNumber, name, password, designation } = req.body;
    const identity = req.identity;

    if (!identity) {
      res.status(400).json({ error: 'Identity validation failed.' });
      return;
    }

    // OTP Check if not super-admin
    if (!identity.isVerified) {
      if (!otp) {
        res.status(400).json({ error: 'OTP is required.' });
        return;
      }
      const { rows: otpRows } = await query(
        "SELECT * FROM otps WHERE email = $1 AND purpose = 'registration' AND verified = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [email],
      );

      if (otpRows.length === 0) {
        res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
        return;
      }
      const otpDoc = otpRows[0];
      if (otpDoc.attempts >= 5) {
        await query('DELETE FROM otps WHERE id = $1', [otpDoc.id]);
        res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
        return;
      }
      if (otpDoc.otp !== otp) {
        await query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [otpDoc.id]);
        res.status(400).json({ error: 'Invalid OTP.', attemptsRemaining: 5 - (otpDoc.attempts + 1) });
        return;
      }
      await query('UPDATE otps SET verified = true WHERE id = $1', [otpDoc.id]);
    }

    // Race-condition guard
    const { rows: existing } = await query(
      'SELECT id FROM students WHERE email = $1 OR ($2::text IS NOT NULL AND roll_number = $2::text) LIMIT 1',
      [email, rollNumber || null],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: 'Account already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    let student: any;

    if (identity.role === 'student') {
      const { rows } = await query(
        `INSERT INTO students (roll_number, name, email, password_hash, role, department, branch, degree_type, year_group, designation, profile_image_url)
         VALUES ($1, $2, $3, $4, 'student', $5, $6, $7, $8, $9, $10)
         RETURNING id, roll_number, name, email, role, branch, degree_type, year_group, designation, profile_image_url`,
        [rollNumber, name, email, passwordHash,
          identity.branchName, identity.branch, identity.degreeType, identity.yearGroup, identity.designation, profileImageUrl],
      );
      student = rows[0];
    } else {
      // Admin ACCOUNT / Super Admin
      const finalDesignation = identity.isVerified ? identity.designation : (designation || 'Staff');
      const emailPrefix = email.split('@')[0];
      const rollNumberStr = identity.isVerified ? 'SUPER-ADMIN' : emailPrefix.toUpperCase();

      const { rows } = await query(
        `INSERT INTO students (roll_number, name, email, password_hash, role, department, designation, profile_image_url)
         VALUES ($1, $2, $3, $4, 'admin', 'Administration', $5, $6)
         RETURNING id, roll_number, name, email, role, designation, profile_image_url`,
        [rollNumberStr, name, email, passwordHash, finalDesignation, profileImageUrl],
      );
      student = rows[0];
    }

    const token = jwt.sign(
      { id: student.id, role: student.role, rollNumber: student.roll_number, designation: student.designation, email: student.email, name: student.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    // Clean up OTP
    await query("DELETE FROM otps WHERE email = $1 AND purpose = 'registration'", [email]);

    res.status(201).json({
      student: {
        id: student.id,
        rollNumber: student.roll_number,
        name: student.name,
        email: student.email,
        role: student.role,
        branch: student.branch || null,
        degreeType: student.degree_type || null,
        yearGroup: student.year_group || null,
        designation: student.designation,
        profileImageUrl: student.profile_image_url,
      },
      token,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
};

// POST /api/auth/verify-otp-json — Temporary JSON-only route for postman fallback
router.post('/verify-otp-json', validateRegister, registerController);

// POST /api/auth/verify-otp — Step 2: verify OTP and create account (with image upload)
router.post('/verify-otp', upload.single('profileImage'), validateRegister, registerController);


// POST /api/auth/resend-otp
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }

    const { rows: recent } = await query(
      "SELECT id FROM otps WHERE email = $1 AND purpose = 'registration' AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1",
      [email],
    );
    if (recent.length > 0) {
      res.status(429).json({ error: 'Please wait 60 seconds before requesting a new OTP.' });
      return;
    }

    const otp = generateOTP();
    await query("DELETE FROM otps WHERE email = $1 AND purpose = 'registration'", [email]);
    await query(
      'INSERT INTO otps (email, otp, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [email, otp, 'registration', new Date(Date.now() + 10 * 60 * 1000)],
    );
    await sendOTP(email, otp);

    res.json({ message: 'New OTP sent.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required.' });
      return;
    }

    const { rows } = await query(`
      SELECT s.*, 
             r.room_number, h.name AS hostel_name 
      FROM students s
      LEFT JOIN room_assignments ra ON s.id = ra.student_id
      LEFT JOIN rooms r ON r.id = ra.room_id
      LEFT JOIN hostels h ON h.id = r.hostel_id
      WHERE s.email = $1
    `, [email]);
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const student = rows[0];
    const validPassword = await bcrypt.compare(password.toString(), student.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const token = jwt.sign(
      { id: student.id, role: student.role, rollNumber: student.roll_number, designation: student.designation, email: student.email, name: student.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    res.json({
      student: {
        id: student.id, rollNumber: student.roll_number, name: student.name,
        email: student.email, role: student.role, branch: student.branch,
        degreeType: student.degree_type, yearGroup: student.year_group,
        department: student.department, designation: student.designation,
        profileImageUrl: student.profile_image_url,
        roomNumber: student.room_number || null,
        hostelName: student.hostel_name || null,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

export default router;
