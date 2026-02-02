import { GameSession } from '../game/GameSession.js';
import { TimeControl, TimeControlSettings } from '../game/Timer.js';
import type { Player, GameResult } from '../game/types.js';
import { supabase } from '../config/database.js';
import { updateUserStats } from './auth.service.js';

class GameService {
  private activeSessions: Map<string, GameSession> = new Map();
  private gameCodeToId: Map<string, string> = new Map();
  private playerToGame: Map<string, string> = new Map();

  createGame(timeControl: TimeControl = 'standard', customSettings?: TimeControlSettings): GameSession {
    const id = crypto.randomUUID();
    const session = new GameSession(id, timeControl, customSettings);

    this.activeSessions.set(id, session);
    this.gameCodeToId.set(session.gameCode, id);

    return session;
  }

  getGame(gameId: string): GameSession | undefined {
    return this.activeSessions.get(gameId);
  }

  getGameByCode(gameCode: string): GameSession | undefined {
    const gameId = this.gameCodeToId.get(gameCode.toUpperCase());
    return gameId ? this.activeSessions.get(gameId) : undefined;
  }

  getGameByPlayer(playerId: string): GameSession | undefined {
    const gameId = this.playerToGame.get(playerId);
    return gameId ? this.activeSessions.get(gameId) : undefined;
  }

  joinGame(gameId: string, player: Player): 'white' | 'black' | null {
    const session = this.activeSessions.get(gameId);
    if (!session) return null;

    const color = session.addPlayer(player);
    if (color) {
      this.playerToGame.set(player.id, gameId);
    }

    return color;
  }

  leaveGame(playerId: string): void {
    const gameId = this.playerToGame.get(playerId);
    if (!gameId) return;

    const session = this.activeSessions.get(gameId);
    if (session) {
      session.removePlayer(playerId);
    }

    this.playerToGame.delete(playerId);
  }

  async endGame(gameId: string, result: GameResult): Promise<void> {
    const session = this.activeSessions.get(gameId);
    if (!session) return;

    // Update player stats in database
    const whitePlayer = session.getPlayer('white');
    const blackPlayer = session.getPlayer('black');

    if (whitePlayer && blackPlayer && supabase) {
      try {
        // Determine results for each player
        let whiteResult: 'win' | 'loss' | 'draw';
        let blackResult: 'win' | 'loss' | 'draw';

        if (result.winner === 'white') {
          whiteResult = 'win';
          blackResult = 'loss';
        } else if (result.winner === 'black') {
          whiteResult = 'loss';
          blackResult = 'win';
        } else {
          whiteResult = 'draw';
          blackResult = 'draw';
        }

        await Promise.all([
          updateUserStats(whitePlayer.id, whiteResult, 'white'),
          updateUserStats(blackPlayer.id, blackResult, 'black'),
        ]);

        // Save game to database
        await supabase.from('games').insert({
          id: session.id,
          white_player: whitePlayer.id,
          black_player: blackPlayer.id,
          status: 'finished',
          time_control: session.timeControl,
          moves: session.getMoveHistory(),
          result: `${result.type}:${result.winner || 'draw'}`,
        });
      } catch (error) {
        console.error('Error saving game result:', error);
      }
    }

    // Clean up player mappings
    if (whitePlayer) this.playerToGame.delete(whitePlayer.id);
    if (blackPlayer) this.playerToGame.delete(blackPlayer.id);

    // Remove from active sessions after a delay (for reconnection)
    setTimeout(() => {
      this.activeSessions.delete(gameId);
      this.gameCodeToId.delete(session.gameCode);
    }, 60000); // Keep for 1 minute for potential reconnection
  }

  removeGame(gameId: string): void {
    const session = this.activeSessions.get(gameId);
    if (session) {
      const whitePlayer = session.getPlayer('white');
      const blackPlayer = session.getPlayer('black');
      if (whitePlayer) this.playerToGame.delete(whitePlayer.id);
      if (blackPlayer) this.playerToGame.delete(blackPlayer.id);
      this.gameCodeToId.delete(session.gameCode);
    }
    this.activeSessions.delete(gameId);
  }

  getActiveGameCount(): number {
    return this.activeSessions.size;
  }

  getWaitingGames(): GameSession[] {
    return Array.from(this.activeSessions.values()).filter(
      session => !session.isFull() && !session.isStarted()
    );
  }
}

export const gameService = new GameService();
