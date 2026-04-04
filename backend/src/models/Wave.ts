import mongoose, { Schema, Document } from 'mongoose';

export interface IWave extends Document {
  name: string;
  yearGroup: number;
  gateOpen: Date;
  gateClose: Date;
  isActive: boolean;
  createdAt: Date;
}

const WaveSchema = new Schema<IWave>({
  name: { type: String, required: true },
  yearGroup: { type: Number, required: true },
  gateOpen: { type: Date, required: true },
  gateClose: { type: Date, required: true },
  isActive: { type: Boolean, default: false },
}, { timestamps: true });

WaveSchema.index({ isActive: 1 });
WaveSchema.index({ yearGroup: 1 });

export default mongoose.model<IWave>('Wave', WaveSchema);
