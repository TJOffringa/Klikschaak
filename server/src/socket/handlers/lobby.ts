import { Server, Socket } from 'socket.io';
import { lobbyService } from '../../services/lobby.service.js';
import { gameService } from '../../services/game.service.js';
import type { Player } from '../../game/types.js';
import type { TimeControl, TimeControlSettings } from '../../game/Timer.js';

// Store pending challenges
const pendingChallenges: Map<string, {
  challengerId: string;
  challengerName: string;
  targetId: string;
  timeControl: TimeControl;
  customSettings?: TimeControlSettings;
  expiresAt: number;
}> = new Map();

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

  // Handle challenge
  socket.on('lobby:challenge', (data: {
    targetId: string;
    timeControl: TimeControl;
    customSettings?: TimeControlSettings;
  }) => {
    const targetUser = lobbyService.getUser(data.targetId);

    if (!targetUser) {
      socket.emit('lobby:challenge-error', { message: 'User not found' });
      return;
    }

    if (targetUser.status === 'in-game') {
      socket.emit('lobby:challenge-error', { message: 'User is already in a game' });
      return;
    }

    // Check if challenger is in a game
    const existingGame = gameService.getGameByPlayer(player.id);
    if (existingGame) {
      socket.emit('lobby:challenge-error', { message: 'You are already in a game' });
      return;
    }

    // Create challenge ID
    const challengeId = `${player.id}-${data.targetId}-${Date.now()}`;

    // Store challenge (expires in 30 seconds)
    pendingChallenges.set(challengeId, {
      challengerId: player.id,
      challengerName: player.username,
      targetId: data.targetId,
      timeControl: data.timeControl,
      customSettings: data.customSettings,
      expiresAt: Date.now() + 30000,
    });

    // Clean up after 30 seconds
    setTimeout(() => {
      if (pendingChallenges.has(challengeId)) {
        pendingChallenges.delete(challengeId);
        socket.emit('lobby:challenge-expired', { challengeId });
      }
    }, 30000);

    // Send challenge to target
    io.to(targetUser.socketId).emit('lobby:challenge-received', {
      challengeId,
      challengerId: player.id,
      challengerName: player.username,
      timeControl: data.timeControl,
      customSettings: data.customSettings,
    });

    socket.emit('lobby:challenge-sent', {
      challengeId,
      targetId: data.targetId,
      targetName: targetUser.username,
    });
  });

  // Handle challenge accept
  socket.on('lobby:challenge-accept', (data: { challengeId: string }) => {
    const challenge = pendingChallenges.get(data.challengeId);

    if (!challenge) {
      socket.emit('lobby:challenge-error', { message: 'Challenge not found or expired' });
      return;
    }

    if (challenge.targetId !== player.id) {
      socket.emit('lobby:challenge-error', { message: 'This challenge is not for you' });
      return;
    }

    // Check if either player is now in a game
    const challengerGame = gameService.getGameByPlayer(challenge.challengerId);
    const targetGame = gameService.getGameByPlayer(challenge.targetId);

    if (challengerGame || targetGame) {
      socket.emit('lobby:challenge-error', { message: 'One of the players is already in a game' });
      pendingChallenges.delete(data.challengeId);
      return;
    }

    // Remove challenge
    pendingChallenges.delete(data.challengeId);

    // Create game
    const session = gameService.createGame(challenge.timeControl, challenge.customSettings);

    // Get challenger info
    const challengerUser = lobbyService.getUser(challenge.challengerId);
    if (!challengerUser) {
      socket.emit('lobby:challenge-error', { message: 'Challenger went offline' });
      return;
    }

    // Add challenger as white
    const challengerPlayer: Player = {
      id: challenge.challengerId,
      username: challengerUser.username,
      friendCode: challengerUser.friendCode,
      socketId: challengerUser.socketId,
    };
    gameService.joinGame(session.id, challengerPlayer);

    // Add accepter as black
    const accepterPlayer: Player = {
      id: player.id,
      username: player.username,
      friendCode: player.friendCode,
      socketId: socket.id,
    };
    gameService.joinGame(session.id, accepterPlayer);

    // Join socket rooms
    const challengerSocket = io.sockets.sockets.get(challengerUser.socketId);
    challengerSocket?.join(`game:${session.id}`);
    socket.join(`game:${session.id}`);

    // Update lobby status
    lobbyService.updateUserStatus(challenge.challengerId, 'in-game');
    lobbyService.updateUserStatus(player.id, 'in-game');
    io.emit('lobby:user-status', { id: challenge.challengerId, status: 'in-game' });
    io.emit('lobby:user-status', { id: player.id, status: 'in-game' });

    // Set up game callbacks
    session.setCallbacks(
      (white, black) => {
        io.to(`game:${session.id}`).emit('game:timer-sync', { white, black });
      },
      async (result) => {
        io.to(`game:${session.id}`).emit('game:over', result);
        await gameService.endGame(session.id, result);

        // Update lobby status for both players
        lobbyService.updateUserStatus(challenge.challengerId, 'online');
        lobbyService.updateUserStatus(player.id, 'online');
        io.emit('lobby:user-status', { id: challenge.challengerId, status: 'online' });
        io.emit('lobby:user-status', { id: player.id, status: 'online' });
      }
    );

    // Start the game
    session.startGame();

    // Notify challenger
    io.to(challengerUser.socketId).emit('game:created', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: 'white',
      timeControl: challenge.timeControl,
    });
    io.to(challengerUser.socketId).emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: challengerUser.username },
      black: { username: player.username },
    });

    // Notify accepter
    socket.emit('game:joined', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: 'black',
      opponent: { username: challengerUser.username },
    });
    socket.emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: challengerUser.username },
      black: { username: player.username },
    });
  });

  // Handle challenge decline
  socket.on('lobby:challenge-decline', (data: { challengeId: string }) => {
    const challenge = pendingChallenges.get(data.challengeId);

    if (challenge && challenge.targetId === player.id) {
      pendingChallenges.delete(data.challengeId);

      // Notify challenger
      const challengerUser = lobbyService.getUser(challenge.challengerId);
      if (challengerUser) {
        io.to(challengerUser.socketId).emit('lobby:challenge-declined', {
          challengeId: data.challengeId,
          declinedBy: player.username,
        });
      }
    }
  });

  // Handle challenge cancel
  socket.on('lobby:challenge-cancel', (data: { challengeId: string }) => {
    const challenge = pendingChallenges.get(data.challengeId);

    if (challenge && challenge.challengerId === player.id) {
      pendingChallenges.delete(data.challengeId);

      // Notify target
      const targetUser = lobbyService.getUser(challenge.targetId);
      if (targetUser) {
        io.to(targetUser.socketId).emit('lobby:challenge-cancelled', {
          challengeId: data.challengeId,
        });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Cancel any pending challenges from/to this player
    for (const [challengeId, challenge] of pendingChallenges.entries()) {
      if (challenge.challengerId === player.id || challenge.targetId === player.id) {
        pendingChallenges.delete(challengeId);
      }
    }

    lobbyService.removeUser(player.id);
    io.emit('lobby:user-left', {
      id: player.id,
      username: player.username,
    });
  });
}
