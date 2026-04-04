import mongoose, { Schema, Document } from 'mongoose';

export interface IOutpass extends Document {
  studentId: mongoose.Types.ObjectId;
  purpose: string;
  destination?: string;
  outTime: Date;
  expectedReturn: Date;
  actualReturn?: Date;
  qrToken: string;
  hmacSignature: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  verifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const OutpassSchema = new Schema<IOutpass>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  purpose: { type: String, required: true },
  destination: String,
  outTime: { type: Date, required: true },
  expectedReturn: { type: Date, required: true },
  actualReturn: Date,
  qrToken: { type: String, required: true, unique: true },
  hmacSignature: { type: String, required: true },
  status: { type: String, enum: ['active', 'used', 'expired', 'cancelled'], default: 'active' },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'Student' },
}, { timestamps: true });

OutpassSchema.index({ studentId: 1 });
OutpassSchema.index({ qrToken: 1 });
OutpassSchema.index({ status: 1 });

export default mongoose.model<IOutpass>('Outpass', OutpassSchema);
