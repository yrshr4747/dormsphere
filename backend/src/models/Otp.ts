import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  purpose: 'registration' | 'password_reset';
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['registration', 'password_reset'], default: 'registration' },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

// Auto-delete expired OTPs
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpSchema.index({ email: 1, purpose: 1 });

export default mongoose.model<IOtp>('Otp', OtpSchema);
