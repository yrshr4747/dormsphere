import mongoose, { Schema, Document } from 'mongoose';

export interface ISelectionAttempt extends Document {
  studentId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  status: 'success' | 'failed' | 'pending';
  reason?: string;
  attemptedAt: Date;
}

const SelectionAttemptSchema = new Schema<ISelectionAttempt>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  status: { type: String, enum: ['success', 'failed', 'pending'], required: true },
  reason: String,
  attemptedAt: { type: Date, default: Date.now },
});

SelectionAttemptSchema.index({ roomId: 1, status: 1 });
SelectionAttemptSchema.index({ studentId: 1 });

export default mongoose.model<ISelectionAttempt>('SelectionAttempt', SelectionAttemptSchema);
