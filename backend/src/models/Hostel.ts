import mongoose, { Schema, Document } from 'mongoose';

export interface IHostel extends Document {
  name: string;
  code: string;
  totalRooms: number;
  floors: number;
  createdAt: Date;
}

const HostelSchema = new Schema<IHostel>({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  totalRooms: { type: Number, default: 0 },
  floors: { type: Number, default: 3 },
}, { timestamps: true });

export default mongoose.model<IHostel>('Hostel', HostelSchema);
