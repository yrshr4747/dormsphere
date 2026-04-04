import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('🔌 WebSocket connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinHostel = (hostelId) => {
    socketRef.current?.emit('join:hostel', hostelId);
  };

  const onRoomUpdate = (callback) => {
    socketRef.current?.on('room:updated', callback);
    return () => socketRef.current?.off('room:updated', callback);
  };

  const onDemandUpdate = (callback) => {
    socketRef.current?.on('room:demand', callback);
    return () => socketRef.current?.off('room:demand', callback);
  };

  const onWaveEvent = (callback) => {
    socketRef.current?.on('wave:event', callback);
    return () => socketRef.current?.off('wave:event', callback);
  };

  const onSelectionResult = (callback) => {
    socketRef.current?.on('selection:result', callback);
    return () => socketRef.current?.off('selection:result', callback);
  };

  return {
    socket: socketRef.current,
    connected,
    joinHostel,
    onRoomUpdate,
    onDemandUpdate,
    onWaveEvent,
    onSelectionResult,
  };
}
