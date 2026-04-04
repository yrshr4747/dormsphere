import mongoose, { Schema, Document } from 'mongoose';

// ----- Asset -----
export interface IAsset extends Document {
  hostelId: mongoose.Types.ObjectId;
  name: string;
  category: 'laundry' | 'sports' | 'electronics' | 'furniture' | 'other';
  totalCount: number;
  availableCount: number;
}

const AssetSchema = new Schema<IAsset>({
  hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['laundry', 'sports', 'electronics', 'furniture', 'other'], required: true },
  totalCount: { type: Number, default: 1, min: 0 },
  availableCount: { type: Number, default: 1, min: 0 },
});

AssetSchema.index({ hostelId: 1 });

export const Asset = mongoose.model<IAsset>('Asset', AssetSchema);

// ----- Asset Checkout -----
export interface IAssetCheckout extends Document {
  assetId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  checkedOutAt: Date;
  expectedReturn?: Date;
  actualReturn?: Date;
  status: 'checked_out' | 'returned' | 'overdue';
}

const AssetCheckoutSchema = new Schema<IAssetCheckout>({
  assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  checkedOutAt: { type: Date, default: Date.now },
  expectedReturn: Date,
  actualReturn: Date,
  status: { type: String, enum: ['checked_out', 'returned', 'overdue'], default: 'checked_out' },
});

AssetCheckoutSchema.index({ status: 1 });

export const AssetCheckout = mongoose.model<IAssetCheckout>('AssetCheckout', AssetCheckoutSchema);
