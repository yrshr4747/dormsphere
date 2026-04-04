import mongoose, { Schema, Document } from 'mongoose';

export interface IGrievance extends Document {
  studentId: mongoose.Types.ObjectId;
  encryptedContent: string;
  iv: string;
  authTag: string;
  category?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  resolvedAt?: Date;
  createdAt: Date;
}

const GrievanceSchema = new Schema<IGrievance>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  encryptedContent: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  category: String,
  status: { type: String, enum: ['pending', 'reviewing', 'resolved', 'dismissed'], default: 'pending' },
  resolvedAt: Date,
}, { timestamps: true });

export default mongoose.model<IGrievance>('Grievance', GrievanceSchema);
