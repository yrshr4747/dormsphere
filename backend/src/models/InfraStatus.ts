import mongoose, { Schema, Document } from 'mongoose';

export interface IInfraStatus extends Document {
  hostelId: mongoose.Types.ObjectId;
  wifiStrength: number;
  powerStatus: 'on' | 'off' | 'backup';
  waterStatus: 'on' | 'off' | 'low';
  lastUpdated: Date;
}

const InfraStatusSchema = new Schema<IInfraStatus>({
  hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
  wifiStrength: { type: Number, min: 0, max: 100 },
  powerStatus: { type: String, enum: ['on', 'off', 'backup'], default: 'on' },
  waterStatus: { type: String, enum: ['on', 'off', 'low'], default: 'on' },
  lastUpdated: { type: Date, default: Date.now },
});

InfraStatusSchema.index({ hostelId: 1 });

export default mongoose.model<IInfraStatus>('InfraStatus', InfraStatusSchema);
