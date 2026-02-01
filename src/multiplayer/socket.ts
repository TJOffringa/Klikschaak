import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './auth.js';

let socket: Socket | null = null;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const token = getAuthToken();

    if (!token) {
      reject(new Error('Not authenticated'));
      return;
    }

    if (socket?.connected) {
      resolve(socket);
      return;
    }

    socket = io(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
    });
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isConnected(): boolean {
  return socket?.connected || false;
}
