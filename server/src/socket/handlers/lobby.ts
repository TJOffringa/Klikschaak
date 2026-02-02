import { Server, Socket } from 'socket.io';
import { lobbyService } from '../../services/lobby.service.js';
import { gameService } from '../../services/game.service.js';
import { getColorStats, determineColors } from '../../services/auth.service.js';
import type { Player, PieceColor } from '../../game/types.js';
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

// Store pending rematches
const pendingRematches: Map<string, {
  requesterId: string;
  requesterName: string;
  opponentId: string;
  timeControl: TimeControl;
  customSettings?: TimeControlSettings;
  previousWhiteId: string; // Who was white in the previous game
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
  socket.on('lobby:challenge-accept', async (data: { challengeId: string }) => {
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

    // Get challenger info
    const challengerUser = lobbyService.getUser(challenge.challengerId);
    if (!challengerUser) {
      socket.emit('lobby:challenge-error', { message: 'Challenger went offline' });
      return;
    }

    // Determine colors based on game history
    const challengerStats = await getColorStats(challenge.challengerId);
    const accepterStats = await getColorStats(player.id);
    const colors = determineColors(challengerStats, accepterStats);

    const whitePlayerId = colors.player1Color === 'white' ? challenge.challengerId : player.id;
    const blackPlayerId = colors.player1Color === 'black' ? challenge.challengerId : player.id;
    const whiteUser = whitePlayerId === challenge.challengerId ? challengerUser : { username: player.username, friendCode: player.friendCode, socketId: socket.id };
    const blackUser = blackPlayerId === challenge.challengerId ? challengerUser : { username: player.username, friendCode: player.friendCode, socketId: socket.id };

    // Create game
    const session = gameService.createGame(challenge.timeControl, challenge.customSettings);

    // Add white player first
    const whitePlayer: Player = {
      id: whitePlayerId,
      username: whiteUser.username,
      friendCode: whiteUser.friendCode,
      socketId: whiteUser.socketId,
    };
    gameService.joinGame(session.id, whitePlayer);

    // Add black player
    const blackPlayer: Player = {
      id: blackPlayerId,
      username: blackUser.username,
      friendCode: blackUser.friendCode,
      socketId: blackUser.socketId,
    };
    gameService.joinGame(session.id, blackPlayer);

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
        io.to(`game:${session.id}`).emit('game:over', {
          ...result,
          whitePlayerId,
          blackPlayerId,
          timeControl: challenge.timeControl,
          customSettings: challenge.customSettings,
        });
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

    const challengerColor: PieceColor = whitePlayerId === challenge.challengerId ? 'white' : 'black';
    const accepterColor: PieceColor = challengerColor === 'white' ? 'black' : 'white';

    // Notify challenger
    io.to(challengerUser.socketId).emit('game:created', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: challengerColor,
      timeControl: challenge.timeControl,
    });
    io.to(challengerUser.socketId).emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: whiteUser.username },
      black: { username: blackUser.username },
    });

    // Notify accepter
    socket.emit('game:joined', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: accepterColor,
      opponent: { username: challengerUser.username },
    });
    socket.emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: whiteUser.username },
      black: { username: blackUser.username },
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

  // Handle rematch request
  socket.on('game:rematch-request', (data: {
    opponentId: string;
    timeControl: TimeControl;
    customSettings?: TimeControlSettings;
    previousWhiteId: string;
  }) => {
    const opponentUser = lobbyService.getUser(data.opponentId);

    if (!opponentUser) {
      socket.emit('game:rematch-error', { message: 'Opponent went offline' });
      return;
    }

    // Create rematch ID
    const rematchId = `rematch-${player.id}-${data.opponentId}-${Date.now()}`;

    // Store rematch (expires in 30 seconds)
    pendingRematches.set(rematchId, {
      requesterId: player.id,
      requesterName: player.username,
      opponentId: data.opponentId,
      timeControl: data.timeControl,
      customSettings: data.customSettings,
      previousWhiteId: data.previousWhiteId,
      expiresAt: Date.now() + 30000,
    });

    // Clean up after 30 seconds
    setTimeout(() => {
      if (pendingRematches.has(rematchId)) {
        pendingRematches.delete(rematchId);
        socket.emit('game:rematch-expired', { rematchId });
      }
    }, 30000);

    // Send rematch request to opponent
    io.to(opponentUser.socketId).emit('game:rematch-received', {
      rematchId,
      requesterId: player.id,
      requesterName: player.username,
      timeControl: data.timeControl,
      customSettings: data.customSettings,
    });

    socket.emit('game:rematch-sent', { rematchId });
  });

  // Handle rematch accept
  socket.on('game:rematch-accept', async (data: { rematchId: string }) => {
    const rematch = pendingRematches.get(data.rematchId);

    if (!rematch) {
      socket.emit('game:rematch-error', { message: 'Rematch request not found or expired' });
      return;
    }

    if (rematch.opponentId !== player.id) {
      socket.emit('game:rematch-error', { message: 'This rematch is not for you' });
      return;
    }

    // Check if either player is in a game
    const requesterGame = gameService.getGameByPlayer(rematch.requesterId);
    const opponentGame = gameService.getGameByPlayer(rematch.opponentId);

    if (requesterGame || opponentGame) {
      socket.emit('game:rematch-error', { message: 'One of the players is already in a game' });
      pendingRematches.delete(data.rematchId);
      return;
    }

    // Remove rematch request
    pendingRematches.delete(data.rematchId);

    // Get requester info
    const requesterUser = lobbyService.getUser(rematch.requesterId);
    if (!requesterUser) {
      socket.emit('game:rematch-error', { message: 'Opponent went offline' });
      return;
    }

    // Swap colors from previous game
    const newWhiteId = rematch.previousWhiteId === rematch.requesterId ? rematch.opponentId : rematch.requesterId;
    const newBlackId = newWhiteId === rematch.requesterId ? rematch.opponentId : rematch.requesterId;

    const whiteUser = newWhiteId === rematch.requesterId ? requesterUser : { username: player.username, friendCode: player.friendCode, socketId: socket.id };
    const blackUser = newBlackId === rematch.requesterId ? requesterUser : { username: player.username, friendCode: player.friendCode, socketId: socket.id };

    // Create game
    const session = gameService.createGame(rematch.timeControl, rematch.customSettings);

    // Add white player
    const whitePlayer: Player = {
      id: newWhiteId,
      username: whiteUser.username,
      friendCode: whiteUser.friendCode,
      socketId: whiteUser.socketId,
    };
    gameService.joinGame(session.id, whitePlayer);

    // Add black player
    const blackPlayer: Player = {
      id: newBlackId,
      username: blackUser.username,
      friendCode: blackUser.friendCode,
      socketId: blackUser.socketId,
    };
    gameService.joinGame(session.id, blackPlayer);

    // Join socket rooms
    const requesterSocket = io.sockets.sockets.get(requesterUser.socketId);
    requesterSocket?.join(`game:${session.id}`);
    socket.join(`game:${session.id}`);

    // Update lobby status
    lobbyService.updateUserStatus(rematch.requesterId, 'in-game');
    lobbyService.updateUserStatus(player.id, 'in-game');
    io.emit('lobby:user-status', { id: rematch.requesterId, status: 'in-game' });
    io.emit('lobby:user-status', { id: player.id, status: 'in-game' });

    // Set up game callbacks
    session.setCallbacks(
      (white, black) => {
        io.to(`game:${session.id}`).emit('game:timer-sync', { white, black });
      },
      async (result) => {
        io.to(`game:${session.id}`).emit('game:over', {
          ...result,
          whitePlayerId: newWhiteId,
          blackPlayerId: newBlackId,
          timeControl: rematch.timeControl,
          customSettings: rematch.customSettings,
        });
        await gameService.endGame(session.id, result);

        // Update lobby status
        lobbyService.updateUserStatus(rematch.requesterId, 'online');
        lobbyService.updateUserStatus(player.id, 'online');
        io.emit('lobby:user-status', { id: rematch.requesterId, status: 'online' });
        io.emit('lobby:user-status', { id: player.id, status: 'online' });
      }
    );

    // Start the game
    session.startGame();

    const requesterColor: PieceColor = newWhiteId === rematch.requesterId ? 'white' : 'black';
    const accepterColor: PieceColor = requesterColor === 'white' ? 'black' : 'white';

    // Notify requester
    io.to(requesterUser.socketId).emit('game:created', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: requesterColor,
      timeControl: rematch.timeControl,
    });
    io.to(requesterUser.socketId).emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: whiteUser.username },
      black: { username: blackUser.username },
    });

    // Notify accepter
    socket.emit('game:joined', {
      gameId: session.id,
      gameCode: session.gameCode,
      color: accepterColor,
      opponent: { username: requesterUser.username },
    });
    socket.emit('game:started', {
      gameId: session.id,
      board: session.getBoard(),
      currentTurn: session.getCurrentTurn(),
      timer: session.getTimerState(),
      white: { username: whiteUser.username },
      black: { username: blackUser.username },
    });
  });

  // Handle rematch decline
  socket.on('game:rematch-decline', (data: { rematchId: string }) => {
    const rematch = pendingRematches.get(data.rematchId);

    if (rematch && rematch.opponentId === player.id) {
      pendingRematches.delete(data.rematchId);

      // Notify requester
      const requesterUser = lobbyService.getUser(rematch.requesterId);
      if (requesterUser) {
        io.to(requesterUser.socketId).emit('game:rematch-declined', {
          rematchId: data.rematchId,
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

    // Cancel any pending rematches from/to this player
    for (const [rematchId, rematch] of pendingRematches.entries()) {
      if (rematch.requesterId === player.id || rematch.opponentId === player.id) {
        pendingRematches.delete(rematchId);
      }
    }

    lobbyService.removeUser(player.id);
    io.emit('lobby:user-left', {
      id: player.id,
      username: player.username,
    });
  });
}
