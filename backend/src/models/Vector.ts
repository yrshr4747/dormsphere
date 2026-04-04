import mongoose, { Schema, Document } from 'mongoose';

export interface IVector extends Document {
  studentId: mongoose.Types.ObjectId;
  sleep: number;
  study: number;
  social: number;
  rawAnswers: Record<string, any>;
  createdAt: Date;
}

const VectorSchema = new Schema<IVector>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  sleep: { type: Number, required: true, min: 0, max: 10 },
  study: { type: Number, required: true, min: 0, max: 10 },
  social: { type: Number, required: true, min: 0, max: 10 },
  rawAnswers: { type: Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model<IVector>('Vector', VectorSchema);
