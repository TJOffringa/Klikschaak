import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../services/auth.service.js';
import { setupLobbyHandlers } from './handlers/lobby.js';
import { setupGameHandlers } from './handlers/game.js';
import type { Player } from '../game/types.js';

export function setupSocketIO(httpServer: HttpServer, clientUrl: string): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid token'));
    }

    // Attach user info to socket
    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`User connected: ${user.username} (${socket.id})`);

    const player: Player = {
      id: user.userId,
      username: user.username,
      friendCode: user.friendCode,
      socketId: socket.id,
    };

    // Set up handlers
    setupLobbyHandlers(io, socket, player);
    setupGameHandlers(io, socket, player);

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${user.username}:`, error);
    });
  });

  return io;
}
