import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.example' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dormsphere';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🗄️  MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting reconnect...');
  });
}

export default mongoose;
