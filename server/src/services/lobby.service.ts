import type { Player } from '../game/types.js';

interface LobbyUser {
  id: string;
  username: string;
  friendCode: string;
  socketId: string;
  status: 'online' | 'in-game' | 'away';
  joinedAt: number;
}

class LobbyService {
  private users: Map<string, LobbyUser> = new Map();

  addUser(player: Player): void {
    this.users.set(player.id, {
      id: player.id,
      username: player.username,
      friendCode: player.friendCode,
      socketId: player.socketId,
      status: 'online',
      joinedAt: Date.now(),
    });
  }

  removeUser(playerId: string): void {
    this.users.delete(playerId);
  }

  updateUserStatus(playerId: string, status: 'online' | 'in-game' | 'away'): void {
    const user = this.users.get(playerId);
    if (user) {
      user.status = status;
    }
  }

  updateSocketId(playerId: string, socketId: string): void {
    const user = this.users.get(playerId);
    if (user) {
      user.socketId = socketId;
    }
  }

  getUser(playerId: string): LobbyUser | undefined {
    return this.users.get(playerId);
  }

  getUserBySocketId(socketId: string): LobbyUser | undefined {
    for (const user of this.users.values()) {
      if (user.socketId === socketId) {
        return user;
      }
    }
    return undefined;
  }

  getOnlineUsers(): LobbyUser[] {
    return Array.from(this.users.values()).filter(u => u.status !== 'away');
  }

  getAllUsers(): LobbyUser[] {
    return Array.from(this.users.values());
  }

  getUserCount(): number {
    return this.users.size;
  }

  isUserOnline(playerId: string): boolean {
    return this.users.has(playerId);
  }
}

export const lobbyService = new LobbyService();
