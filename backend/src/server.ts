import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { Server as SocketServer } from 'socket.io';
import { connectDB } from './db/connection';
import { initWebSocket } from './services/websocket';
import { seedDatabase } from './db/seed';

// Route imports
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import studentRoutes from './routes/students';
import lotteryRoutes from './routes/lottery';
import outpassRoutes from './routes/outpass';
import grievanceRoutes from './routes/grievance';
import infraRoutes from './routes/infra';
import assetRoutes from './routes/assets';
import electionRoutes from './routes/elections';

const app = express();
const server = http.createServer(app);

// Build allowed origins list from FRONTEND_URL (comma-separated) + localhost
const allowedOrigins: string[] = ['http://localhost:5173'];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(u => {
    const trimmed = u.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

// Dynamic origin checker: allows explicit origins + any *.vercel.app subdomain
function checkOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  // Allow requests with no origin (e.g. server-to-server, curl)
  if (!origin) return callback(null, true);
  // Allow any Vercel preview/production URL
  if (origin.endsWith('.vercel.app')) return callback(null, true);
  // Allow explicitly listed origins
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
}

// Socket.io setup
const io = new SocketServer(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: checkOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Make io available in routes
app.set('io', io);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'DormSphere API',
    database: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/outpass', outpassRoutes);
app.use('/api/grievance', grievanceRoutes);
app.use('/api/infra', infraRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/elections', electionRoutes);

// WebSocket init
initWebSocket(io);

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '3001', 10);

// Connect to MongoDB then start server
connectDB().then(async () => {
  // Seed initial data if empty
  await seedDatabase();

  server.listen(PORT, () => {
    console.log(`🏛️  DormSphere API running on port ${PORT}`);
    console.log(`📡 WebSocket server active`);
    console.log(`🗄️  Database: MongoDB Atlas`);
  });
}).catch(err => {
  console.error('🚨 FAILED TO CONNECT TO MONGODB ATLAS ON STARTUP:');
  console.error(err);
  process.exit(1);
});

export { app, io };
