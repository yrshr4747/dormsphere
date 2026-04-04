import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(email: string, otp: string): Promise<boolean> {
  // Dev fallback: if no SMTP configured, log to console
  if (!SMTP_USER || !SMTP_PASS) {
    console.log(`\n📧 ═══════════════════════════════════════`);
    console.log(`   OTP for ${email}: ${otp}`);
    console.log(`   (SMTP not configured — logging to console)`);
    console.log(`═══════════════════════════════════════════\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"DormSphere" <${SMTP_USER}>`,
      to: email,
      subject: '🏛️ DormSphere — Email Verification OTP',
      html: `
        <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1A1918; color: #F2F1EB; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #8C1515, #B83A3A); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px;">🏛️</div>
            <h1 style="margin: 12px 0 4px; font-size: 24px; color: #F2F1EB;">DormSphere</h1>
            <p style="color: #9B9A97; font-size: 13px; margin: 0;">IIITK Hostel Management</p>
          </div>
          <div style="text-align: center; padding: 24px; background: rgba(46,45,41,0.6); border-radius: 12px; margin-bottom: 24px;">
            <p style="color: #9B9A97; font-size: 14px; margin: 0 0 12px;">Your verification code is</p>
            <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #B83A3A;">${otp}</div>
          </div>
          <p style="color: #9B9A97; font-size: 12px; text-align: center;">
            This code expires in <strong>10 minutes</strong>.<br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`📧 OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    // Fallback to console
    console.log(`\n📧 OTP for ${email}: ${otp} (email send failed, logged here)\n`);
    return true;
  }
}
