import mongoose, { Schema, Document } from 'mongoose';

// ----- Election -----
export interface IElection extends Document {
  title: string;
  description?: string;
  electionType: 'block_rep' | 'mess_committee' | 'cultural' | 'sports' | 'general';
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdAt: Date;
}

const ElectionSchema = new Schema<IElection>({
  title: { type: String, required: true },
  description: String,
  electionType: { type: String, enum: ['block_rep', 'mess_committee', 'cultural', 'sports', 'general'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: false },
}, { timestamps: true });

export const Election = mongoose.model<IElection>('Election', ElectionSchema);

// ----- Candidate -----
export interface ICandidate extends Document {
  electionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  manifesto?: string;
}

const CandidateSchema = new Schema<ICandidate>({
  electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  manifesto: String,
});

CandidateSchema.index({ electionId: 1, studentId: 1 }, { unique: true });

export const Candidate = mongoose.model<ICandidate>('Candidate', CandidateSchema);

// ----- Vote -----
export interface IVote extends Document {
  electionId: mongoose.Types.ObjectId;
  voterId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  votedAt: Date;
}

const VoteSchema = new Schema<IVote>({
  electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
  voterId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
  votedAt: { type: Date, default: Date.now },
});

VoteSchema.index({ electionId: 1, voterId: 1 }, { unique: true }); // ONE vote per student

export const Vote = mongoose.model<IVote>('Vote', VoteSchema);
