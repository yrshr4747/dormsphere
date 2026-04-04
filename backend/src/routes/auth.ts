import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Student from '../models/Student';
import Otp from '../models/Otp';
import { generateOTP, sendOTP } from '../services/email';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = 86400; // 24 hours
const ALLOWED_DOMAIN = '@iiitk.ac.in';

// POST /api/auth/register — Step 1: send OTP
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { rollNumber, name, email, password, year, department } = req.body;

    if (!rollNumber || !name || !email || !password) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    // Domain restriction
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      res.status(400).json({ error: `Only ${ALLOWED_DOMAIN} emails are allowed.` });
      return;
    }

    // Roll number format validation: 123CS0076 (B.Tech) or 523ME0001 (Dual Degree)
    // Pattern: [1 or 5][2-digit year][CS|EC|ME|AD][4-digit serial]
    const rollRegex = /^[15]\d{2}(CS|EC|ME|AD)\d{4}$/;
    if (!rollRegex.test(rollNumber)) {
      res.status(400).json({ error: 'Invalid roll number format. Expected: 123CS0076 (B.Tech) or 523CS0001 (Dual Degree).' });
      return;
    }

    // AI&DS (AD) cannot have dual degree (prefix 5)
    if (rollNumber.startsWith('5') && rollNumber.includes('AD')) {
      res.status(400).json({ error: 'Dual Degree is not available for AI & DS.' });
      return;
    }

    // Check existing verified student
    const existing = await Student.findOne({ $or: [{ email }, { rollNumber }] });
    if (existing) {
      res.status(409).json({ error: 'Student with this email or roll number already exists.' });
      return;
    }

    // Generate and send OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous OTPs for this email
    await Otp.deleteMany({ email, purpose: 'registration' });

    await Otp.create({ email, otp, purpose: 'registration', expiresAt });

    // Store registration data temporarily in the OTP doc's purpose field
    // We'll re-read from the request in verify-otp
    await sendOTP(email, otp);

    res.json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      requiresOTP: true,
      email,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/verify-otp — Step 2: verify OTP and create account
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, rollNumber, name, password, year, department } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP are required.' });
      return;
    }

    // Find valid OTP
    const otpDoc = await Otp.findOne({
      email,
      purpose: 'registration',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
      return;
    }

    // Max 5 attempts
    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
      return;
    }

    // Check OTP
    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      res.status(400).json({
        error: 'Invalid OTP.',
        attemptsRemaining: 5 - otpDoc.attempts,
      });
      return;
    }

    // OTP is valid — create the account
    otpDoc.verified = true;
    await otpDoc.save();

    // Check again for race conditions
    const existing = await Student.findOne({ $or: [{ email }, { rollNumber }] });
    if (existing) {
      res.status(409).json({ error: 'Account already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await Student.create({
      rollNumber, name, email, passwordHash,
      role: 'student',
      year: year || undefined,
      department: department || undefined,
    });

    const token = jwt.sign(
      { id: student._id, role: student.role, rollNumber: student.rollNumber },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Clean up OTP
    await Otp.deleteMany({ email, purpose: 'registration' });

    res.status(201).json({
      student: { id: student._id, rollNumber: student.rollNumber, name: student.name, email: student.email, role: student.role, year: student.year },
      token,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }

    // Rate limit: max 1 OTP per 60 seconds
    const recent = await Otp.findOne({
      email, purpose: 'registration',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recent) {
      res.status(429).json({ error: 'Please wait 60 seconds before requesting a new OTP.' });
      return;
    }

    const otp = generateOTP();
    await Otp.deleteMany({ email, purpose: 'registration' });
    await Otp.create({ email, otp, purpose: 'registration', expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
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

    const student = await Student.findOne({ email });
    if (!student) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, student.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const token = jwt.sign(
      { id: student._id, role: student.role, rollNumber: student.rollNumber },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      student: {
        id: student._id, rollNumber: student.rollNumber, name: student.name,
        email: student.email, role: student.role, year: student.year, department: student.department,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

export default router;
