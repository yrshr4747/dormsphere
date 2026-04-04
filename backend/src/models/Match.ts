import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  studentA: mongoose.Types.ObjectId;
  studentB: mongoose.Types.ObjectId;
  compatibilityScore: number;
  waveId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>({
  studentA: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  studentB: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  compatibilityScore: { type: Number, required: true, min: 0, max: 100 },
  waveId: { type: Schema.Types.ObjectId },
}, { timestamps: true });

MatchSchema.index({ studentA: 1 });
MatchSchema.index({ studentB: 1 });

export default mongoose.model<IMatch>('Match', MatchSchema);
