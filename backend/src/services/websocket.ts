import { Server, Socket } from 'socket.io';

export function initWebSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join hostel-specific room for targeted broadcasts
    socket.on('join:hostel', (hostelId: string) => {
      socket.join(`hostel:${hostelId}`);
      console.log(`  → ${socket.id} joined hostel:${hostelId}`);
    });

    // Join floor-specific room
    socket.on('join:floor', (data: { hostelId: string; floor: number }) => {
      socket.join(`floor:${data.hostelId}:${data.floor}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

// Broadcast room status update to all connected clients
export function broadcastRoomUpdate(io: Server, roomData: {
  roomId: string;
  hostelId: string;
  occupied: number;
  capacity: number;
  isAvailable: boolean;
  lastAction: string;
}): void {
  io.emit('room:updated', roomData);
  io.to(`hostel:${roomData.hostelId}`).emit('room:hostel-updated', roomData);
}

// Broadcast demand signal (room popularity)
export function broadcastDemandUpdate(io: Server, data: {
  roomId: string;
  demandLevel: 'low' | 'medium' | 'high' | 'critical';
  attemptCount: number;
}): void {
  io.emit('room:demand', data);
}

// Broadcast wave/gate time events
export function broadcastWaveEvent(io: Server, data: {
  waveId: string;
  event: 'opening' | 'closing' | 'active';
  yearGroup: number;
  message: string;
}): void {
  io.emit('wave:event', data);
}

// Broadcast selection result to a specific student
export function notifySelectionResult(io: Server, studentSocketId: string, data: {
  success: boolean;
  roomId: string;
  message: string;
}): void {
  io.to(studentSocketId).emit('selection:result', data);
}
