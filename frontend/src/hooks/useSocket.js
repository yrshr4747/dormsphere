import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const configuredUrl = import.meta.env.VITE_SOCKET_URL
      || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '')
      || window.location.origin;

    const socket = io(configuredUrl, {
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

  const onSignalUpdate = (callback) => {
    socketRef.current?.on('room:signal', callback);
    return () => socketRef.current?.off('room:signal', callback);
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
    onSignalUpdate,
    onWaveEvent,
    onSelectionResult,
  };
}
