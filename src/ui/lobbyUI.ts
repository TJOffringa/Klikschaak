import { setOnUsersUpdate, LobbyUser } from '../multiplayer/lobby.js';
import {
  createGame,
  joinGame,
  setGameCallbacks,
  getOnlineGameState,
  isOnline,
  isMyTurn,
  resign,
  leaveOnlineGame,
  TimeControl,
  TimeControlSettings,
  OnlineGameState,
} from '../multiplayer/onlineGame.js';
import { getSocket } from '../multiplayer/socket.js';
import { getCurrentUser } from '../multiplayer/auth.js';
import { renderBoard, updateUI, setBoardFlipped } from './render.js';
import * as state from '../game/state.js';

let lobbyContainer: HTMLElement | null = null;
let gameCodeDisplay: HTMLElement | null = null;
let timerDisplay: HTMLElement | null = null;
let pendingChallengeId: string | null = null;

export function showLobbyUI(): void {
  // Create lobby container
  lobbyContainer = document.getElementById('lobbyContainer');
  if (!lobbyContainer) {
    lobbyContainer = document.createElement('div');
    lobbyContainer.id = 'lobbyContainer';
    document.body.appendChild(lobbyContainer);
  }

  renderLobby();
  setupGameCallbacksUI();

  // Listen for online users updates
  setOnUsersUpdate(renderOnlineUsers);
}

export function hideLobbyUI(): void {
  if (lobbyContainer) {
    lobbyContainer.innerHTML = '';
  }
}

function renderLobby(): void {
  if (!lobbyContainer) return;

  lobbyContainer.innerHTML = `
    <div class="lobby-panel">
      <h3>Online Play</h3>
      <div class="lobby-actions">
        <div class="create-game">
          <select id="timeControlSelect">
            <option value="bullet">1+0</option>
            <option value="blitz-3">3+0</option>
            <option value="blitz-5">5+0</option>
            <option value="rapid-7">7+0</option>
            <option value="standard" selected>7+5</option>
            <option value="custom">Custom</option>
          </select>
          <button id="createGameBtn" class="lobby-btn">Create</button>
        </div>
        <div class="custom-time hidden" id="customTimeInputs">
          <div class="custom-time-row">
            <input type="number" id="customMinutes" placeholder="Min" min="1" max="60" value="10">
            <span>+</span>
            <input type="number" id="customIncrement" placeholder="Sec" min="0" max="60" value="0">
          </div>
        </div>
        <div class="join-game">
          <input type="text" id="gameCodeInput" placeholder="Game Code" maxlength="6">
          <button id="joinGameBtn" class="lobby-btn">Join</button>
        </div>
      </div>
      <div id="gameCodeDisplay" class="game-code-display hidden"></div>
      <div id="waitingMessage" class="waiting-message hidden"></div>
      <div id="challengeNotification" class="challenge-notification hidden"></div>
      <div class="online-users">
        <h4>Online (<span id="onlineCount">0</span>)</h4>
        <ul id="onlineUsersList"></ul>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('createGameBtn')?.addEventListener('click', handleCreateGame);
  document.getElementById('joinGameBtn')?.addEventListener('click', handleJoinGame);
  document.getElementById('gameCodeInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleJoinGame();
  });

  // Show/hide custom time inputs
  const timeControlSelect = document.getElementById('timeControlSelect') as HTMLSelectElement;
  timeControlSelect?.addEventListener('change', () => {
    const customInputs = document.getElementById('customTimeInputs');
    if (customInputs) {
      customInputs.classList.toggle('hidden', timeControlSelect.value !== 'custom');
    }
  });

  gameCodeDisplay = document.getElementById('gameCodeDisplay');

  // Setup challenge listeners
  setupChallengeListeners();
}

function renderOnlineUsers(users: LobbyUser[]): void {
  const list = document.getElementById('onlineUsersList');
  const count = document.getElementById('onlineCount');
  const currentUser = getCurrentUser();

  if (count) count.textContent = String(users.length);

  if (list) {
    const otherUsers = users.filter(u => u.id !== currentUser?.id);
    list.innerHTML = otherUsers
      .map(user => `
        <li class="online-user ${user.status} ${user.status === 'online' ? 'challengeable' : ''}"
            data-user-id="${user.id}"
            data-username="${user.username}"
            title="${user.status === 'online' ? 'Click to challenge' : (user.status === 'in-game' ? 'In a game' : 'Away')}">
          <span class="status-dot"></span>
          <span class="username">${user.username}</span>
          <span class="friend-code">#${user.friendCode}</span>
          ${user.status === 'online' ? '<span class="challenge-icon">⚔️</span>' : ''}
        </li>
      `)
      .join('') || '<li class="no-users">No other players online</li>';

    // Add click listeners for challengeable users
    list.querySelectorAll('.online-user.challengeable').forEach(el => {
      el.addEventListener('click', () => {
        const userId = el.getAttribute('data-user-id');
        const username = el.getAttribute('data-username');
        if (userId && username) {
          showChallengeConfirm(userId, username);
        }
      });
    });
  }
}

function handleCreateGame(): void {
  const select = document.getElementById('timeControlSelect') as HTMLSelectElement;
  const timeControl = (select?.value || 'standard') as TimeControl;

  let customSettings: TimeControlSettings | undefined;
  if (timeControl === 'custom') {
    const minutes = parseInt((document.getElementById('customMinutes') as HTMLInputElement)?.value || '10');
    const increment = parseInt((document.getElementById('customIncrement') as HTMLInputElement)?.value || '0');
    customSettings = {
      initialTime: minutes * 60 * 1000,
      increment: increment * 1000,
    };
  }

  createGame(timeControl, customSettings);

  // Show waiting message
  const waitingMsg = document.getElementById('waitingMessage');
  if (waitingMsg) {
    waitingMsg.classList.remove('hidden');
    waitingMsg.textContent = 'Creating game...';
  }
}

function handleJoinGame(): void {
  const input = document.getElementById('gameCodeInput') as HTMLInputElement;
  const code = input?.value?.trim();

  if (code && code.length >= 4) {
    joinGame(code);
    input.value = '';
  }
}

function setupGameCallbacksUI(): void {
  setGameCallbacks({
    onGameCreated: (gameCode) => {
      if (gameCodeDisplay) {
        gameCodeDisplay.classList.remove('hidden');
        gameCodeDisplay.innerHTML = `
          <div class="game-code">
            <span>Share code:</span>
            <strong>${gameCode}</strong>
            <button id="copyCodeBtn" class="copy-btn" title="Copy">📋</button>
          </div>
          <p>Waiting for opponent...</p>
        `;
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
          navigator.clipboard.writeText(gameCode);
        });
      }
    },

    onGameJoined: (gameState) => {
      console.log('Joined game:', gameState.gameCode);
    },

    onGameStarted: (gameState) => {
      // Flip board for black player
      const isBlack = gameState.myColor === 'black';
      setBoardFlipped(isBlack);

      // Hide lobby panel during game - show timers in correct order based on perspective
      if (lobbyContainer) {
        const topTimer = isBlack ? 'white' : 'black';
        const bottomTimer = isBlack ? 'black' : 'white';
        const topLabel = isBlack ? 'White' : 'Black';
        const bottomLabel = isBlack ? 'Black' : 'White';
        const topTime = isBlack ? gameState.timer.white : gameState.timer.black;
        const bottomTime = isBlack ? gameState.timer.black : gameState.timer.white;

        lobbyContainer.innerHTML = `
          <div class="game-info-panel">
            <div class="opponent-info">
              <span>vs ${gameState.opponent?.username || 'Unknown'}</span>
            </div>
            <div id="timerDisplay" class="timer-display">
              <div class="timer ${topTimer} ${gameState.currentTurn === topTimer ? 'active' : ''}">
                <span class="label">${topLabel}</span>
                <span class="time">${formatTime(topTime)}</span>
              </div>
              <div class="timer ${bottomTimer} ${gameState.currentTurn === bottomTimer ? 'active' : ''}">
                <span class="label">${bottomLabel}</span>
                <span class="time">${formatTime(bottomTime)}</span>
              </div>
            </div>
            <div class="game-actions">
              <button id="resignBtn" class="game-btn danger">Resign</button>
            </div>
          </div>
        `;
        timerDisplay = document.getElementById('timerDisplay');
        document.getElementById('resignBtn')?.addEventListener('click', () => {
          if (confirm('Are you sure you want to resign?')) {
            resign();
          }
        });
      }

      // Update board with game state
      syncBoardFromOnline(gameState);
      renderBoard();
      updateUI();
      updateOnlineIndicator();
    },

    onMoveMade: (gameState) => {
      syncBoardFromOnline(gameState);
      renderBoard();
      updateUI();
      updateTimerDisplay(gameState.timer.white, gameState.timer.black, gameState.currentTurn);
      updateOnlineIndicator();
    },

    onTimerUpdate: (white, black) => {
      const gameState = getOnlineGameState();
      if (gameState) {
        updateTimerDisplay(white, black, gameState.currentTurn);
      }
    },

    onGameOver: (result) => {
      if (!result) return;

      const gameState = getOnlineGameState();
      let message = '';

      if (result.type === 'checkmate') {
        message = result.winner === gameState?.myColor
          ? 'You won by checkmate!'
          : 'You lost by checkmate.';
      } else if (result.type === 'stalemate') {
        message = 'Draw by stalemate.';
      } else if (result.type === 'timeout') {
        message = result.winner === gameState?.myColor
          ? 'You won on time!'
          : 'You lost on time.';
      } else if (result.type === 'resignation') {
        message = result.winner === gameState?.myColor
          ? 'Opponent resigned. You won!'
          : 'You resigned.';
      } else if (result.type === 'disconnect') {
        message = result.winner === gameState?.myColor
          ? 'Opponent disconnected. You won!'
          : 'Game ended due to disconnection.';
      }

      // Show game over modal
      showGameOverModal(message);
    },

    onError: (message) => {
      alert(`Error: ${message}`);
    },
  });
}

function syncBoardFromOnline(gameState: OnlineGameState): void {
  // Reset local state and apply online state
  state.initializeBoard();

  // Copy board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.setBoardSquare(r, c, [...gameState.board[r][c].pieces]);
    }
  }

  // Set turn
  while (state.getCurrentTurn() !== gameState.currentTurn) {
    state.switchTurn();
  }

  // Set en passant
  state.setEnPassantTarget(gameState.enPassantTarget);

  // Clear and rebuild moved pawns
  for (const pawn of gameState.movedPawns) {
    state.addMovedPawn(pawn);
  }

  // Move history
  for (const entry of gameState.moveHistory) {
    if (!state.getMoveHistory().find(e => e.notation === entry.notation)) {
      state.addMoveToHistory(entry);
    }
  }

  state.clearSelection();
}

function updateTimerDisplay(white: number, black: number, currentTurn: string): void {
  if (!timerDisplay) return;

  const whiteTimer = timerDisplay.querySelector('.timer.white');
  const blackTimer = timerDisplay.querySelector('.timer.black');

  if (whiteTimer) {
    whiteTimer.classList.toggle('active', currentTurn === 'white');
    const timeSpan = whiteTimer.querySelector('.time');
    if (timeSpan) timeSpan.textContent = formatTime(white);
  }

  if (blackTimer) {
    blackTimer.classList.toggle('active', currentTurn === 'black');
    const timeSpan = blackTimer.querySelector('.time');
    if (timeSpan) timeSpan.textContent = formatTime(black);
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateOnlineIndicator(): void {
  // Update turn indicator to show if it's your turn
  const turnIndicator = document.getElementById('currentTurnIndicator');
  if (turnIndicator && isOnline()) {
    const myTurn = isMyTurn();
    turnIndicator.classList.toggle('my-turn', myTurn);
  }
}

function showGameOverModal(message: string): void {
  const modal = document.createElement('div');
  modal.className = 'game-over-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Game Over</h2>
      <p>${message}</p>
      <button id="closeGameOverBtn" class="modal-btn">OK</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeGameOverBtn')?.addEventListener('click', () => {
    modal.remove();
    leaveOnlineGame();
    setBoardFlipped(false); // Reset board orientation
    renderLobby();
    // Re-setup callbacks since we recreated the lobby
    setupGameCallbacksUI();
    setOnUsersUpdate(renderOnlineUsers);
  });
}

function showChallengeConfirm(userId: string, username: string): void {
  const notification = document.getElementById('challengeNotification');
  if (!notification) return;

  const select = document.getElementById('timeControlSelect') as HTMLSelectElement;
  const timeControl = (select?.value || 'standard') as TimeControl;

  let timeLabel = getTimeControlLabel(timeControl);
  if (timeControl === 'custom') {
    const minutes = (document.getElementById('customMinutes') as HTMLInputElement)?.value || '10';
    const increment = (document.getElementById('customIncrement') as HTMLInputElement)?.value || '0';
    timeLabel = `${minutes}+${increment}`;
  }

  notification.classList.remove('hidden');
  notification.innerHTML = `
    <div class="challenge-confirm">
      <p>Challenge <strong>${username}</strong> to a ${timeLabel} game?</p>
      <div class="challenge-buttons">
        <button id="confirmChallengeBtn" class="lobby-btn primary">Challenge</button>
        <button id="cancelChallengeBtn" class="lobby-btn">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('confirmChallengeBtn')?.addEventListener('click', () => {
    sendChallenge(userId, timeControl);
    notification.innerHTML = `
      <div class="challenge-pending">
        <p>Waiting for ${username} to accept...</p>
        <button id="cancelPendingChallengeBtn" class="lobby-btn small">Cancel</button>
      </div>
    `;
    document.getElementById('cancelPendingChallengeBtn')?.addEventListener('click', () => {
      if (pendingChallengeId) {
        const socket = getSocket();
        socket?.emit('lobby:challenge-cancel', { challengeId: pendingChallengeId });
        pendingChallengeId = null;
      }
      notification.classList.add('hidden');
    });
  });

  document.getElementById('cancelChallengeBtn')?.addEventListener('click', () => {
    notification.classList.add('hidden');
  });
}

function sendChallenge(targetId: string, timeControl: TimeControl): void {
  const socket = getSocket();
  if (!socket) return;

  let customSettings: TimeControlSettings | undefined;
  if (timeControl === 'custom') {
    const minutes = parseInt((document.getElementById('customMinutes') as HTMLInputElement)?.value || '10');
    const increment = parseInt((document.getElementById('customIncrement') as HTMLInputElement)?.value || '0');
    customSettings = {
      initialTime: minutes * 60 * 1000,
      increment: increment * 1000,
    };
  }

  socket.emit('lobby:challenge', { targetId, timeControl, customSettings });
}

function setupChallengeListeners(): void {
  const socket = getSocket();
  if (!socket) return;

  // Remove existing listeners to avoid duplicates
  socket.off('lobby:challenge-received');
  socket.off('lobby:challenge-sent');
  socket.off('lobby:challenge-declined');
  socket.off('lobby:challenge-cancelled');
  socket.off('lobby:challenge-expired');
  socket.off('lobby:challenge-error');

  // Received a challenge
  socket.on('lobby:challenge-received', (data: {
    challengeId: string;
    challengerId: string;
    challengerName: string;
    timeControl: TimeControl;
    customSettings?: TimeControlSettings;
  }) => {
    const notification = document.getElementById('challengeNotification');
    if (!notification) return;

    let timeLabel = getTimeControlLabel(data.timeControl);
    if (data.timeControl === 'custom' && data.customSettings) {
      const minutes = Math.floor(data.customSettings.initialTime / 60000);
      const increment = Math.floor(data.customSettings.increment / 1000);
      timeLabel = `${minutes}+${increment}`;
    }

    notification.classList.remove('hidden');
    notification.innerHTML = `
      <div class="challenge-received">
        <p><strong>${data.challengerName}</strong> challenges you to a ${timeLabel} game!</p>
        <div class="challenge-buttons">
          <button id="acceptChallengeBtn" class="lobby-btn primary">Accept</button>
          <button id="declineChallengeBtn" class="lobby-btn">Decline</button>
        </div>
      </div>
    `;

    document.getElementById('acceptChallengeBtn')?.addEventListener('click', () => {
      socket.emit('lobby:challenge-accept', { challengeId: data.challengeId });
      notification.innerHTML = '<p>Starting game...</p>';
    });

    document.getElementById('declineChallengeBtn')?.addEventListener('click', () => {
      socket.emit('lobby:challenge-decline', { challengeId: data.challengeId });
      notification.classList.add('hidden');
    });
  });

  // Challenge was sent successfully
  socket.on('lobby:challenge-sent', (data: { challengeId: string }) => {
    pendingChallengeId = data.challengeId;
  });

  // Challenge was declined
  socket.on('lobby:challenge-declined', (data: { declinedBy: string }) => {
    pendingChallengeId = null;
    const notification = document.getElementById('challengeNotification');
    if (notification) {
      notification.innerHTML = `<p>${data.declinedBy} declined the challenge.</p>`;
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  });

  // Challenge was cancelled by challenger
  socket.on('lobby:challenge-cancelled', () => {
    const notification = document.getElementById('challengeNotification');
    if (notification) {
      notification.innerHTML = '<p>Challenge was cancelled.</p>';
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  });

  // Challenge expired
  socket.on('lobby:challenge-expired', () => {
    pendingChallengeId = null;
    const notification = document.getElementById('challengeNotification');
    if (notification) {
      notification.innerHTML = '<p>Challenge expired.</p>';
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  });

  // Challenge error
  socket.on('lobby:challenge-error', (data: { message: string }) => {
    pendingChallengeId = null;
    const notification = document.getElementById('challengeNotification');
    if (notification) {
      notification.innerHTML = `<p class="error">${data.message}</p>`;
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
  });
}

function getTimeControlLabel(timeControl: TimeControl): string {
  switch (timeControl) {
    case 'bullet': return '1+0';
    case 'blitz-3': return '3+0';
    case 'blitz-5': return '5+0';
    case 'rapid-7': return '7+0';
    case 'standard': return '7+5';
    case 'custom': return 'Custom';
    default: return '7+5';
  }
}

export function isOnlineGame(): boolean {
  return isOnline();
}

export function canMakeMove(): boolean {
  if (!isOnline()) return true;
  return isMyTurn();
}
