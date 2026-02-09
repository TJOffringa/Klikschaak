import { Server, Socket } from 'socket.io';
import { gameService } from '../../services/game.service.js';
import { lobbyService } from '../../services/lobby.service.js';
import type { Player, GameMove, MoveType, Piece } from '../../game/types.js';
import type { TimeControl, TimeControlSettings } from '../../game/Timer.js';

export function setupGameHandlers(io: Server, socket: Socket, player: Player): void {
  // Create a new game
  socket.on('game:create', (data: { timeControl?: TimeControl; customSettings?: TimeControlSettings }) => {
    // Check if player is already in a game
    const existingGame = gameService.getGameByPlayer(player.id);
    if (existingGame) {
      socket.emit('game:error', { message: 'You are already in a game' });
      return;
    }

    const timeControl = data?.timeControl || 'standard';
    const customSettings = data?.customSettings;
    const session = gameService.createGame(timeControl, customSettings);
    const color = gameService.joinGame(session.id, player);

    if (!color) {
      socket.emit('game:error', { message: 'Failed to create game' });
      return;
    }

    // Join socket room for this game
    socket.join(`game:${session.id}`);

    // Update lobby status
    lobbyService.updateUserStatus(player.id, 'in-game');
    io.emit('lobby:user-status', { id: player.id, status: 'in-game' });

    socket.emit('game:created', {
      gameId: session.id,
      gameCode: session.gameCode,
      color,
      timeControl,
    });
  });

  // Join an existing game
  socket.on('game:join', (data: { gameCode: string }) => {
    // Check if player is already in a game
    const existingGame = gameService.getGameByPlayer(player.id);
    if (existingGame) {
      socket.emit('game:error', { message: 'You are already in a game' });
      return;
    }

    const session = gameService.getGameByCode(data.gameCode);
    if (!session) {
      socket.emit('game:error', { message: 'Game not found' });
      return;
    }

    if (session.isFull()) {
      socket.emit('game:error', { message: 'Game is full' });
      return;
    }

    if (session.isStarted()) {
      socket.emit('game:error', { message: 'Game has already started' });
      return;
    }

    const color = gameService.joinGame(session.id, player);
    if (!color) {
      socket.emit('game:error', { message: 'Failed to join game' });
      return;
    }

    // Join socket room
    socket.join(`game:${session.id}`);

    // Update lobby status
    lobbyService.updateUserStatus(player.id, 'in-game');
    io.emit('lobby:user-status', { id: player.id, status: 'in-game' });

    // Notify the joining player
    socket.emit('game:joined', {
      gameId: session.id,
      gameCode: session.gameCode,
      color,
      opponent: {
        username: session.getPlayer(color === 'white' ? 'black' : 'white')?.username,
      },
    });

    // If game is now full, start it
    if (session.isFull()) {
      // Set up game callbacks
      session.setCallbacks(
        (white, black) => {
          io.to(`game:${session.id}`).emit('game:timer-sync', { white, black });
        },
        async (result) => {
          io.to(`game:${session.id}`).emit('game:over', result);
          await gameService.endGame(session.id, result);

          // Update lobby status for both players
          const whitePlayer = session.getPlayer('white');
          const blackPlayer = session.getPlayer('black');
          if (whitePlayer) {
            lobbyService.updateUserStatus(whitePlayer.id, 'online');
            io.emit('lobby:user-status', { id: whitePlayer.id, status: 'online' });
          }
          if (blackPlayer) {
            lobbyService.updateUserStatus(blackPlayer.id, 'online');
            io.emit('lobby:user-status', { id: blackPlayer.id, status: 'online' });
          }
        }
      );

      session.startGame();

      // Notify both players that game is starting
      io.to(`game:${session.id}`).emit('game:started', {
        gameId: session.id,
        board: session.getBoard(),
        currentTurn: session.getCurrentTurn(),
        timer: session.getTimerState(),
        white: { username: session.getPlayer('white')?.username },
        black: { username: session.getPlayer('black')?.username },
      });
    }
  });

  // Make a move
  socket.on('game:move', (data: {
    gameId: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
    moveType: MoveType;
    unklikIndex?: number;
    promoteTo?: Piece;
  }) => {
    const session = gameService.getGame(data.gameId);
    if (!session) {
      socket.emit('game:error', { message: 'Game not found' });
      return;
    }

    const playerColor = session.getPlayerColor(player.id);
    if (!playerColor) {
      socket.emit('game:error', { message: 'You are not in this game' });
      return;
    }

    // Get pieces from the board
    const board = session.getBoard();
    const fromSquare = board[data.from.row][data.from.col];

    const move: GameMove = {
      from: data.from,
      to: data.to,
      moveType: data.moveType,
      pieces: fromSquare.pieces,
      unklikIndex: data.unklikIndex,
      promoteTo: data.promoteTo,
    };

    // Validate move
    const validation = session.validateMove(player.id, move);
    if (!validation.valid) {
      socket.emit('game:move-rejected', { error: validation.error });
      return;
    }

    // Execute move
    const result = session.executeMove(move);
    if (!result.success) {
      socket.emit('game:move-rejected', { error: result.error });
      return;
    }

    // Broadcast move to both players
    io.to(`game:${session.id}`).emit('game:move-made', {
      from: data.from,
      to: data.to,
      moveType: data.moveType,
      unklikIndex: data.unklikIndex,
      promoteTo: data.promoteTo,
      notation: result.notation,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      enPassantTarget: session.getEnPassantTarget(),
      castlingRights: session.getCastlingRights(),
      movedPawns: session.getMovedPawns(),
    });
  });

  // Resign
  socket.on('game:resign', (data: { gameId: string }) => {
    const session = gameService.getGame(data.gameId);
    if (!session) return;

    const playerColor = session.getPlayerColor(player.id);
    if (!playerColor) return;

    session.resign(player.id);
  });

  // Draw offer
  socket.on('game:draw-offer', (data: { gameId: string }) => {
    const session = gameService.getGame(data.gameId);
    if (!session) return;

    const playerColor = session.getPlayerColor(player.id);
    if (!playerColor) return;

    if (session.offerDraw(player.id)) {
      // Send to the opponent only
      const opponentColor = playerColor === 'white' ? 'black' : 'white';
      const opponent = session.getPlayer(opponentColor);
      if (opponent) {
        io.to(`game:${session.id}`).except(socket.id).emit('game:draw-offered', {
          offeredBy: playerColor,
        });
      }
    }
  });

  // Draw response
  socket.on('game:draw-response', (data: { gameId: string; accept: boolean }) => {
    const session = gameService.getGame(data.gameId);
    if (!session) return;

    const playerColor = session.getPlayerColor(player.id);
    if (!playerColor) return;

    if (session.respondDraw(player.id, data.accept)) {
      if (!data.accept) {
        // Notify the offerer that draw was declined
        io.to(`game:${session.id}`).except(socket.id).emit('game:draw-declined');
      }
      // If accepted, game:over is emitted via the onGameEnd callback
    }
  });

  // Get game state (for reconnection)
  socket.on('game:get-state', (data: { gameId: string }) => {
    const session = gameService.getGame(data.gameId);
    if (!session) {
      socket.emit('game:error', { message: 'Game not found' });
      return;
    }

    const playerColor = session.getPlayerColor(player.id);
    if (!playerColor) {
      socket.emit('game:error', { message: 'You are not in this game' });
      return;
    }

    // Rejoin socket room
    socket.join(`game:${session.id}`);

    socket.emit('game:state', {
      ...session.getFullState(),
      yourColor: playerColor,
    });
  });

  // Leave game (disconnect handling)
  socket.on('disconnect', () => {
    const session = gameService.getGameByPlayer(player.id);
    if (session && session.isStarted() && !session.isOver()) {
      // Game was in progress - handle as disconnect
      // The GameSession.removePlayer will trigger game end
      session.removePlayer(player.id);
    } else if (session) {
      // Game wasn't started yet - just leave
      gameService.leaveGame(player.id);
      gameService.removeGame(session.id);
    }
  });
}
