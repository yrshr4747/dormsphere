import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  hostelId: mongoose.Types.ObjectId;
  floor: number;
  roomNumber: string;
  capacity: number;
  occupied: number;
  isAvailable: boolean;
  amenities: string[];
}

const RoomSchema = new Schema<IRoom>({
  hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
  floor: { type: Number, required: true },
  roomNumber: { type: String, required: true },
  capacity: { type: Number, required: true, default: 2, min: 1, max: 4 },
  occupied: { type: Number, default: 0, min: 0 },
  isAvailable: { type: Boolean, default: true },
  amenities: [String],
}, { timestamps: true });

RoomSchema.index({ hostelId: 1, roomNumber: 1 }, { unique: true });
RoomSchema.index({ hostelId: 1, isAvailable: 1 });
RoomSchema.index({ hostelId: 1, floor: 1 });

export default mongoose.model<IRoom>('Room', RoomSchema);
