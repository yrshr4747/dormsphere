import mongoose, { Schema, Document } from 'mongoose';

export interface ILotteryRank extends Document {
  studentId: mongoose.Types.ObjectId;
  seed: string;
  hash: string;
  rank: number;
  waveId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const LotteryRankSchema = new Schema<ILotteryRank>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  seed: { type: String, required: true },
  hash: { type: String, required: true },
  rank: { type: Number, required: true },
  waveId: { type: Schema.Types.ObjectId },
}, { timestamps: true });

LotteryRankSchema.index({ studentId: 1, seed: 1 }, { unique: true });
LotteryRankSchema.index({ rank: 1 });

export default mongoose.model<ILotteryRank>('LotteryRank', LotteryRankSchema);
