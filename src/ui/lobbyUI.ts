import { setOnUsersUpdate, LobbyUser, getOnlineUsers } from '../multiplayer/lobby.js';
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
  OnlineGameState,
} from '../multiplayer/onlineGame.js';
import { getCurrentUser } from '../multiplayer/auth.js';
import { renderBoard, updateUI } from './render.js';
import * as state from '../game/state.js';
import { getTranslation, getCurrentLanguage } from '../i18n/translations.js';

let lobbyContainer: HTMLElement | null = null;
let gameCodeDisplay: HTMLElement | null = null;
let onlineIndicator: HTMLElement | null = null;
let timerDisplay: HTMLElement | null = null;

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
            <option value="bullet">Bullet (1 min)</option>
            <option value="blitz">Blitz (3+2)</option>
            <option value="standard" selected>Standard (7+5)</option>
          </select>
          <button id="createGameBtn" class="lobby-btn">Create Game</button>
        </div>
        <div class="join-game">
          <input type="text" id="gameCodeInput" placeholder="Game Code" maxlength="6">
          <button id="joinGameBtn" class="lobby-btn">Join</button>
        </div>
      </div>
      <div id="gameCodeDisplay" class="game-code-display hidden"></div>
      <div id="waitingMessage" class="waiting-message hidden"></div>
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

  gameCodeDisplay = document.getElementById('gameCodeDisplay');
}

function renderOnlineUsers(users: LobbyUser[]): void {
  const list = document.getElementById('onlineUsersList');
  const count = document.getElementById('onlineCount');
  const currentUser = getCurrentUser();

  if (count) count.textContent = String(users.length);

  if (list) {
    list.innerHTML = users
      .filter(u => u.id !== currentUser?.id)
      .map(user => `
        <li class="online-user ${user.status}">
          <span class="status-dot"></span>
          <span class="username">${user.username}</span>
          <span class="friend-code">#${user.friendCode}</span>
        </li>
      `)
      .join('') || '<li class="no-users">No other players online</li>';
  }
}

function handleCreateGame(): void {
  const select = document.getElementById('timeControlSelect') as HTMLSelectElement;
  const timeControl = (select?.value || 'standard') as TimeControl;
  createGame(timeControl);

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
      // Hide lobby panel during game
      if (lobbyContainer) {
        lobbyContainer.innerHTML = `
          <div class="game-info-panel">
            <div class="opponent-info">
              <span>vs ${gameState.opponent?.username || 'Unknown'}</span>
            </div>
            <div id="timerDisplay" class="timer-display">
              <div class="timer white ${gameState.currentTurn === 'white' ? 'active' : ''}">
                <span class="label">White</span>
                <span class="time">${formatTime(gameState.timer.white)}</span>
              </div>
              <div class="timer black ${gameState.currentTurn === 'black' ? 'active' : ''}">
                <span class="label">Black</span>
                <span class="time">${formatTime(gameState.timer.black)}</span>
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
    renderLobby();
    // Re-setup callbacks since we recreated the lobby
    setupGameCallbacksUI();
    setOnUsersUpdate(renderOnlineUsers);
  });
}

export function isOnlineGame(): boolean {
  return isOnline();
}

export function canMakeMove(): boolean {
  if (!isOnline()) return true;
  return isMyTurn();
}
