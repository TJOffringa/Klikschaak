import { Server, Socket } from 'socket.io';
import { lobbyService } from '../../services/lobby.service.js';
import type { Player } from '../../game/types.js';

export function setupLobbyHandlers(io: Server, socket: Socket, player: Player): void {
  // Add player to lobby
  lobbyService.addUser(player);

  // Notify all clients about new user
  io.emit('lobby:user-joined', {
    id: player.id,
    username: player.username,
    friendCode: player.friendCode,
  });

  // Send current online users to the new client
  const onlineUsers = lobbyService.getOnlineUsers().map(u => ({
    id: u.id,
    username: u.username,
    friendCode: u.friendCode,
    status: u.status,
  }));
  socket.emit('lobby:users', onlineUsers);

  // Handle explicit lobby join
  socket.on('lobby:join', () => {
    lobbyService.updateUserStatus(player.id, 'online');
    io.emit('lobby:user-status', {
      id: player.id,
      status: 'online',
    });
  });

  // Handle lobby leave (going away)
  socket.on('lobby:leave', () => {
    lobbyService.updateUserStatus(player.id, 'away');
    io.emit('lobby:user-status', {
      id: player.id,
      status: 'away',
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    lobbyService.removeUser(player.id);
    io.emit('lobby:user-left', {
      id: player.id,
      username: player.username,
    });
  });
}
