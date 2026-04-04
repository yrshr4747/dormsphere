import mongoose, { Schema, Document } from 'mongoose';

export interface IRoomAssignment extends Document {
  studentId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  assignedAt: Date;
  waveId?: mongoose.Types.ObjectId;
}

const RoomAssignmentSchema = new Schema<IRoomAssignment>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  assignedAt: { type: Date, default: Date.now },
  waveId: { type: Schema.Types.ObjectId },
});

RoomAssignmentSchema.index({ roomId: 1 });

export default mongoose.model<IRoomAssignment>('RoomAssignment', RoomAssignmentSchema);
