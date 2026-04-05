import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'DormSphere <onboarding@resend.dev>';

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(email: string, otp: string): Promise<boolean> {
  // Dev fallback: if no Resend API key configured, log to console
  if (!resend) {
    console.log(`\n📧 ═══════════════════════════════════════`);
    console.log(`   OTP for ${email}: ${otp}`);
    console.log(`   (RESEND_API_KEY not configured — logging to console)`);
    console.log(`═══════════════════════════════════════════\n`);
    return true;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
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

    if (error) {
      console.error('Resend email error:', error);
      console.log(`\n📧 OTP for ${email}: ${otp} (email send failed, logged here)\n`);
      return true;
    }

    console.log(`📧 OTP sent to ${email} (Resend ID: ${data?.id})`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    // Fallback to console
    console.log(`\n📧 OTP for ${email}: ${otp} (email send failed, logged here)\n`);
    return true;
  }
}
