import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { Server as SocketServer } from 'socket.io';
import { connectDB } from './db/connection';
import { initWebSocket } from './services/websocket';
import { seedDatabase } from './db/seed';
import { startWaveScheduler } from './services/waveScheduler';

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
import waveRoutes from './routes/waves';
import roommateRoutes from './routes/roommates';
import adminRoutes from './routes/admin';
import mediaRoutes from './routes/media';
import communityRoutes from './routes/community';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`[SERVER DEBUG] ${req.method} ${req.path} | Has Body: ${Object.keys(req.body || {}).length > 0}`);
  }
  next();
});
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


// Make io available in routes
app.set('io', io);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'DormSphere API',
    database: 'PostgreSQL',
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
app.use('/api/waves', waveRoutes);
app.use('/api/roommates', roommateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/community', communityRoutes);

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

// Forcing explicit route mounting to resolve Render 404 issues
app.use('/api/community', communityRoutes);
app.use('/api/student', studentRoutes);

const PORT = parseInt(process.env.PORT || '3001', 10);

// Connect to PostgreSQL then start server
connectDB().then(async () => {
  console.log('✅ Database Connected');
  await seedDatabase();
  startWaveScheduler(io);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏛️  DormSphere API: Explicitly listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('🚨 FAILED TO CONNECT TO POSTGRESQL ON STARTUP:');
  console.error(err);
  process.exit(1);
});

export { app, io };
