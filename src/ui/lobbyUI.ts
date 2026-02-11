import { setOnUsersUpdate, LobbyUser } from '../multiplayer/lobby.js';
import {
  createGame,
  joinGame,
  setGameCallbacks,
  getOnlineGameState,
  isOnline,
  isMyTurn,
  resign,
  offerDraw,
  respondDraw,
  leaveOnlineGame,
  TimeControl,
  TimeControlSettings,
  OnlineGameState,
  getLastGameInfo,
  requestRematch,
  clearLastGameInfo,
} from '../multiplayer/onlineGame.js';
import { getSocket } from '../multiplayer/socket.js';
import { getCurrentUser } from '../multiplayer/auth.js';
import { renderBoard, updateUI, setBoardFlipped } from './render.js';
import { openAnalysisFromGame, showAnalysisUI } from './analysisUI.js';
import { tryExecutePremove } from '../game/actions.js';
import { clearPremove } from '../multiplayer/premove.js';
import * as state from '../game/state.js';
import { startEngineGame, stopEngineGame, isEngineGame, isEngineThinking, getEngineColor, resignEngineGame, offerDrawToEngine } from '../game/engineGame.js';
import { checkEngineHealth, waitForWasm } from '../analysis/engineCompare.js';
import { saveGame } from '../game/gameStorage.js';

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

  // Check if we're in an engine game
  if (isEngineGame()) {
    renderEngineGamePanel();
    return;
  }

  lobbyContainer.innerHTML = `
    <div class="lobby-panel">
      <div class="lobby-header">
        <h3>Klikschaak</h3>
        <button id="lobbyToggleBtn" class="lobby-toggle" title="Minimize">\u2212</button>
      </div>
      <div id="lobbyBody" class="lobby-body">
        <div class="lobby-section">
          <h4 class="section-title">Play vs Engine</h4>
          <div class="engine-play">
            <select id="engineColorSelect">
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="random">Random</option>
            </select>
            <button id="enginePlayBtn" class="lobby-btn engine">Play</button>
          </div>
          <div id="engineStatus" class="engine-status"></div>
        </div>
        <div class="lobby-section">
          <h4 class="section-title">Online Play</h4>
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
        <div class="lobby-section">
          <button id="lobbyAnalysisBtn" class="lobby-btn analysis">Analyse</button>
        </div>
      </div>
    </div>
  `;

  // Start collapsed on mobile
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    const body = document.getElementById('lobbyBody');
    const btn = document.getElementById('lobbyToggleBtn');
    if (body && btn) {
      body.classList.add('collapsed');
      btn.textContent = '+';
      btn.title = 'Expand';
    }
  }

  // Toggle lobby body
  document.getElementById('lobbyToggleBtn')?.addEventListener('click', () => {
    const body = document.getElementById('lobbyBody');
    const btn = document.getElementById('lobbyToggleBtn');
    if (body && btn) {
      const collapsed = body.classList.toggle('collapsed');
      btn.textContent = collapsed ? '+' : '\u2212';
      btn.title = collapsed ? 'Expand' : 'Minimize';
    }
  });

  // Event listeners
  document.getElementById('createGameBtn')?.addEventListener('click', handleCreateGame);
  document.getElementById('joinGameBtn')?.addEventListener('click', handleJoinGame);
  document.getElementById('gameCodeInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleJoinGame();
  });

  document.getElementById('lobbyAnalysisBtn')?.addEventListener('click', () => {
    hideLobbyUI();
    showAnalysisUI();
  });

  // Engine play button
  document.getElementById('enginePlayBtn')?.addEventListener('click', handleStartEngineGame);

  // Check engine health (wait for WASM to load first)
  const statusEl = document.getElementById('engineStatus');
  if (statusEl) {
    statusEl.textContent = 'Loading engine...';
    statusEl.className = 'engine-status';
  }
  waitForWasm(10000).then(async (wasmOk) => {
    const online = wasmOk || await checkEngineHealth();
    const el = document.getElementById('engineStatus');
    if (el) {
      if (online) {
        el.textContent = wasmOk ? 'Engine ready (WASM)' : 'Engine online';
        el.className = 'engine-status online';
      } else {
        el.textContent = 'Engine offline';
        el.className = 'engine-status offline';
      }
    }
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

function handleStartEngineGame(): void {
  const select = document.getElementById('engineColorSelect') as HTMLSelectElement;
  let color = select?.value || 'white';
  if (color === 'random') {
    color = Math.random() < 0.5 ? 'white' : 'black';
  }

  // Flip board if playing black
  setBoardFlipped(color === 'black');

  startEngineGame(color as 'white' | 'black');
  renderEngineGamePanel();
}

function renderEngineGamePanel(): void {
  if (!lobbyContainer) return;

  const engineColor = getEngineColor();
  const playerColor = engineColor === 'white' ? 'Black' : 'White';

  const gameOver = state.isGameOver();
  lobbyContainer.innerHTML = `
    <div class="lobby-panel engine-game-panel">
      <div class="lobby-header">
        <h3>vs Engine</h3>
        <span class="engine-game-info">You: ${playerColor}</span>
      </div>
      <div class="engine-game-body">
        <div id="engineThinking" class="engine-thinking" style="display: ${isEngineThinking() ? 'flex' : 'none'}">
          <span class="thinking-dots"></span>
          <span>Engine thinking...</span>
        </div>
        <div class="engine-game-actions">
          ${gameOver ? `
            <button id="engineAnalyzeBtn" class="lobby-btn analysis">Analyze</button>
          ` : `
            <button id="engineResignBtn" class="lobby-btn danger" title="Resign">Resign</button>
            <button id="engineDrawBtn" class="lobby-btn draw" title="Offer Draw">&frac12; Draw</button>
          `}
          <button id="engineNewGameBtn" class="lobby-btn engine">New Game</button>
          <button id="engineStopBtn" class="lobby-btn secondary">Lobby</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('engineAnalyzeBtn')?.addEventListener('click', () => {
    const moves = state.getMoveHistory();
    const whiteName = engineColor === 'white' ? 'Engine' : 'You';
    const blackName = engineColor === 'black' ? 'Engine' : 'You';
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.remove();
    stopEngineGame();
    openAnalysisFromGame(moves, whiteName, blackName);
  });

  document.getElementById('engineResignBtn')?.addEventListener('click', () => {
    resignEngineGame();
    renderEngineGamePanel();
  });

  document.getElementById('engineDrawBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('engineDrawBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '...';
    const accepted = await offerDrawToEngine();
    if (!accepted) {
      btn.textContent = 'Declined!';
      setTimeout(() => {
        btn.textContent = '\u00BD Draw';
        btn.disabled = false;
      }, 2000);
    } else {
      renderEngineGamePanel();
    }
  });

  document.getElementById('engineNewGameBtn')?.addEventListener('click', () => {
    stopEngineGame();
    renderLobby();
  });

  document.getElementById('engineStopBtn')?.addEventListener('click', () => {
    stopEngineGame();
    setBoardFlipped(false);
    state.initializeBoard();
    state.setGameOver(false);
    // Remove any game over overlay
    const overlay = document.getElementById('gameOverOverlay');
    if (overlay) overlay.remove();
    renderBoard();
    updateUI();
    renderLobby();
    setupGameCallbacksUI();
    setOnUsersUpdate(renderOnlineUsers);
  });
}

export function showEngineGamePanel(): void {
  renderEngineGamePanel();
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
              <button id="drawBtn" class="game-btn">Draw</button>
              <button id="resignBtn" class="game-btn danger">Resign</button>
            </div>
            <div id="drawNotification" class="draw-notification hidden"></div>
          </div>
        `;
        timerDisplay = document.getElementById('timerDisplay');
        document.getElementById('resignBtn')?.addEventListener('click', () => {
          if (confirm('Are you sure you want to resign?')) {
            resign();
          }
        });
        document.getElementById('drawBtn')?.addEventListener('click', () => {
          offerDraw();
          const drawBtn = document.getElementById('drawBtn') as HTMLButtonElement;
          if (drawBtn) {
            drawBtn.textContent = 'Offered';
            drawBtn.disabled = true;
          }
        });

        // Listen for draw events
        setupDrawListeners();
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

      // If it's now our turn, try to execute any pending premove
      if (gameState.currentTurn === gameState.myColor) {
        // Small delay to ensure board is rendered before premove
        setTimeout(() => {
          tryExecutePremove();
        }, 50);
      }
    },

    onTimerUpdate: (white, black) => {
      const gameState = getOnlineGameState();
      if (gameState) {
        updateTimerDisplay(white, black, gameState.currentTurn);
      }
    },

    onGameOver: (result) => {
      if (!result) return;

      // Clear any pending premove
      clearPremove();

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
      } else if (result.type === 'draw') {
        message = 'Game drawn by agreement.';
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
  modal.id = 'gameOverModal';

  const lastGame = getLastGameInfo();
  const showRematch = lastGame !== null;
  const gameState = getOnlineGameState();

  // Save online game to IndexedDB
  if (gameState) {
    const whiteName = gameState.myColor === 'white'
      ? (getCurrentUser()?.username || 'You')
      : (gameState.opponent?.username || 'Opponent');
    const blackName = gameState.myColor === 'black'
      ? (getCurrentUser()?.username || 'You')
      : (gameState.opponent?.username || 'Opponent');
    saveGame({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'online',
      white: whiteName,
      black: blackName,
      result: message,
      moves: gameState.moveHistory || state.getMoveHistory(),
      moveCount: Math.ceil((gameState.moveHistory || state.getMoveHistory()).length / 2),
    }).catch(e => console.error('[GameStorage] Failed to save online game:', e));
  }

  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="modalCloseBtn">\u00d7</button>
      <h2>Game Over</h2>
      <p>${message}</p>
      <div class="modal-buttons">
        ${showRematch ? '<button id="rematchBtn" class="modal-btn primary">Rematch</button>' : ''}
        <button id="analyzeGameBtn" class="modal-btn">Analysis</button>
        <button id="closeGameOverBtn" class="modal-btn">Back to Lobby</button>
      </div>
      <div id="rematchStatus" class="rematch-status hidden"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on X or click outside
  document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
    closeGameOverAndReturnToLobby(modal);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeGameOverAndReturnToLobby(modal);
  });

  // Analysis button handler
  document.getElementById('analyzeGameBtn')?.addEventListener('click', () => {
    modal.remove();
    // Get move history and player names
    const moves = gameState?.moveHistory || state.getMoveHistory();
    const white = gameState?.myColor === 'white'
      ? getCurrentUser()?.username
      : gameState?.opponent?.username;
    const black = gameState?.myColor === 'black'
      ? getCurrentUser()?.username
      : gameState?.opponent?.username;

    // Leave the online game state
    leaveOnlineGame();
    clearLastGameInfo();
    setBoardFlipped(false);

    // Open analysis mode with the game moves
    openAnalysisFromGame(moves, white, black);
  });

  // Setup rematch listeners
  setupRematchListeners(modal);

  document.getElementById('rematchBtn')?.addEventListener('click', () => {
    requestRematch();
    const rematchStatus = document.getElementById('rematchStatus');
    if (rematchStatus) {
      rematchStatus.classList.remove('hidden');
      rematchStatus.textContent = 'Waiting for opponent...';
    }
    const rematchBtn = document.getElementById('rematchBtn');
    if (rematchBtn) {
      rematchBtn.textContent = 'Waiting...';
      (rematchBtn as HTMLButtonElement).disabled = true;
    }
  });

  document.getElementById('closeGameOverBtn')?.addEventListener('click', () => {
    closeGameOverAndReturnToLobby(modal);
  });
}

function closeGameOverAndReturnToLobby(modal: HTMLElement): void {
  modal.remove();
  leaveOnlineGame();
  clearLastGameInfo();
  clearPremove(); // Clear any pending premove
  setBoardFlipped(false); // Reset board orientation
  renderLobby();
  // Re-setup callbacks since we recreated the lobby
  setupGameCallbacksUI();
  setOnUsersUpdate(renderOnlineUsers);
}

function setupRematchListeners(modal: HTMLElement): void {
  const socket = getSocket();
  if (!socket) return;

  // Remove existing listeners to avoid duplicates
  socket.off('game:rematch-received');
  socket.off('game:rematch-sent');
  socket.off('game:rematch-declined');
  socket.off('game:rematch-expired');
  socket.off('game:rematch-error');

  // Received rematch request
  socket.on('game:rematch-received', (data: { rematchId: string; requesterName: string }) => {
    const rematchStatus = document.getElementById('rematchStatus');
    if (rematchStatus) {
      rematchStatus.classList.remove('hidden');
      rematchStatus.innerHTML = `
        <p><strong>${data.requesterName}</strong> wants a rematch!</p>
        <div class="rematch-buttons">
          <button id="acceptRematchBtn" class="lobby-btn primary">Accept</button>
          <button id="declineRematchBtn" class="lobby-btn">Decline</button>
        </div>
      `;

      document.getElementById('acceptRematchBtn')?.addEventListener('click', () => {
        socket.emit('game:rematch-accept', { rematchId: data.rematchId });
        rematchStatus.textContent = 'Starting game...';
      });

      document.getElementById('declineRematchBtn')?.addEventListener('click', () => {
        socket.emit('game:rematch-decline', { rematchId: data.rematchId });
        rematchStatus.classList.add('hidden');
      });
    }
  });

  // Rematch was declined
  socket.on('game:rematch-declined', () => {
    const rematchStatus = document.getElementById('rematchStatus');
    if (rematchStatus) {
      rematchStatus.textContent = 'Rematch declined.';
    }
    const rematchBtn = document.getElementById('rematchBtn');
    if (rematchBtn) {
      rematchBtn.textContent = 'Rematch';
      (rematchBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Rematch expired
  socket.on('game:rematch-expired', () => {
    const rematchStatus = document.getElementById('rematchStatus');
    if (rematchStatus) {
      rematchStatus.textContent = 'Rematch request expired.';
    }
    const rematchBtn = document.getElementById('rematchBtn');
    if (rematchBtn) {
      rematchBtn.textContent = 'Rematch';
      (rematchBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Rematch error
  socket.on('game:rematch-error', (data: { message: string }) => {
    const rematchStatus = document.getElementById('rematchStatus');
    if (rematchStatus) {
      rematchStatus.textContent = data.message;
    }
    const rematchBtn = document.getElementById('rematchBtn');
    if (rematchBtn) {
      rematchBtn.textContent = 'Rematch';
      (rematchBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Game started (rematch accepted) - close modal
  socket.on('game:started', () => {
    modal.remove();
  });
}

function setupDrawListeners(): void {
  const socket = getSocket();
  if (!socket) return;

  socket.off('game:draw-offered');
  socket.off('game:draw-declined');

  socket.on('game:draw-offered', () => {
    const notification = document.getElementById('drawNotification');
    if (notification) {
      notification.classList.remove('hidden');
      notification.innerHTML = `
        <p>Opponent offers a draw</p>
        <div class="draw-buttons">
          <button id="acceptDrawBtn" class="game-btn primary-sm">Accept</button>
          <button id="declineDrawBtn" class="game-btn">Decline</button>
        </div>
      `;
      document.getElementById('acceptDrawBtn')?.addEventListener('click', () => {
        respondDraw(true);
        notification.classList.add('hidden');
      });
      document.getElementById('declineDrawBtn')?.addEventListener('click', () => {
        respondDraw(false);
        notification.classList.add('hidden');
      });
    }
  });

  socket.on('game:draw-declined', () => {
    const notification = document.getElementById('drawNotification');
    if (notification) {
      notification.classList.remove('hidden');
      notification.innerHTML = '<p>Draw declined</p>';
      setTimeout(() => notification.classList.add('hidden'), 3000);
    }
    const drawBtn = document.getElementById('drawBtn') as HTMLButtonElement;
    if (drawBtn) {
      drawBtn.textContent = 'Draw';
      drawBtn.disabled = false;
    }
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
