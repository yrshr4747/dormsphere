import mongoose, { Schema, Document } from 'mongoose';

export interface IStudent extends Document {
  rollNumber: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'warden' | 'guard' | 'judcomm';
  year?: number;
  department?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>({
  rollNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'warden', 'guard', 'judcomm'], default: 'student' },
  year: { type: Number, min: 2015, max: 2035 },
  department: String,
  phone: String,
}, { timestamps: true });

StudentSchema.index({ email: 1 });
StudentSchema.index({ rollNumber: 1 });
StudentSchema.index({ role: 1 });

export default mongoose.model<IStudent>('Student', StudentSchema);
