import { getSocket } from './socket.js';

export interface LobbyUser {
  id: string;
  username: string;
  friendCode: string;
  status: 'online' | 'in-game' | 'away';
}

// State
let onlineUsers: LobbyUser[] = [];
let onUsersUpdate: ((users: LobbyUser[]) => void) | null = null;

export function setupLobbyListeners(): void {
  const socket = getSocket();
  if (!socket) return;

  socket.on('lobby:users', (users: LobbyUser[]) => {
    onlineUsers = users;
    onUsersUpdate?.(onlineUsers);
  });

  socket.on('lobby:user-joined', (user: Omit<LobbyUser, 'status'>) => {
    const exists = onlineUsers.find(u => u.id === user.id);
    if (!exists) {
      onlineUsers.push({ ...user, status: 'online' });
      onUsersUpdate?.(onlineUsers);
    }
  });

  socket.on('lobby:user-left', (data: { id: string }) => {
    onlineUsers = onlineUsers.filter(u => u.id !== data.id);
    onUsersUpdate?.(onlineUsers);
  });

  socket.on('lobby:user-status', (data: { id: string; status: 'online' | 'in-game' | 'away' }) => {
    const user = onlineUsers.find(u => u.id === data.id);
    if (user) {
      user.status = data.status;
      onUsersUpdate?.(onlineUsers);
    }
  });
}

export function setOnUsersUpdate(callback: (users: LobbyUser[]) => void): void {
  onUsersUpdate = callback;
  // Immediately call with current users
  callback(onlineUsers);
}

export function getOnlineUsers(): LobbyUser[] {
  return onlineUsers;
}

export function joinLobby(): void {
  const socket = getSocket();
  socket?.emit('lobby:join');
}

export function leaveLobby(): void {
  const socket = getSocket();
  socket?.emit('lobby:leave');
}
