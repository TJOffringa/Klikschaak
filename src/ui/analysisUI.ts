import {
  startAnalysis,
  startFreshAnalysis,
  exitAnalysis,
  goToStart,
  goToEnd,
  goBack,
  goForward,
  goToMove,
  getMoveIndex,
  getTotalMoves,
  getSavedMoves,
} from '../analysis/analysisMode.js';
import {
  isEditorMode,
  startEditor,
  exitEditor,
  selectEditorPiece,
  getSelectedEditorPiece,
  placePiece,
  removePiece,
  clearBoard,
  setupStandardPosition,
  setTurnToMove,
  getTurnToMove,
  validatePosition,
  getBoardAsFEN,
  setBoardFromFEN,
  EDITOR_PIECES,
} from '../analysis/boardEditor.js';
import {
  exportToPGN,
  parsePGN,
  downloadPGN,
  copyPGNToClipboard,
  loadPGNFromFile,
} from '../analysis/pgn.js';
import { PIECE_SYMBOLS } from '../game/constants.js';
import { renderBoard, updateUI } from './render.js';
import { initGame } from '../game/actions.js';
import * as state from '../game/state.js';
import { t } from '../i18n/translations.js';
import type { Piece, MoveHistoryEntry } from '../game/types.js';

let analysisContainer: HTMLElement | null = null;

export function showAnalysisUI(moves?: MoveHistoryEntry[], white?: string, black?: string): void {
  // Create analysis container if it doesn't exist
  analysisContainer = document.getElementById('analysisContainer');
  if (!analysisContainer) {
    analysisContainer = document.createElement('div');
    analysisContainer.id = 'analysisContainer';
    document.body.appendChild(analysisContainer);
  }

  if (moves && moves.length > 0) {
    startAnalysis(moves);
  } else {
    startFreshAnalysis(true);
  }

  renderAnalysisPanel(white, black);
  renderBoard();
  updateUI();
}

export function hideAnalysisUI(): void {
  if (analysisContainer) {
    analysisContainer.innerHTML = '';
  }
  exitAnalysis();
  exitEditor();
}

function renderAnalysisPanel(white?: string, black?: string): void {
  if (!analysisContainer) return;

  const moves = getSavedMoves();
  const moveIndex = getMoveIndex();

  analysisContainer.innerHTML = `
    <div class="analysis-panel">
      <div class="analysis-header">
        <h3>${t('analysisMode')}</h3>
        <button id="closeAnalysisBtn" class="analysis-close-btn">&times;</button>
      </div>

      <div class="analysis-players">
        ${white ? `<span class="player-white">⬜ ${white}</span>` : ''}
        ${black ? `<span class="player-black">⬛ ${black}</span>` : ''}
      </div>

      <div class="analysis-controls">
        <button id="goStartBtn" class="nav-btn" title="Go to start">⏮</button>
        <button id="goBackBtn" class="nav-btn" title="Previous move">◀</button>
        <span class="move-counter">${moveIndex + 1} / ${moves.length}</span>
        <button id="goForwardBtn" class="nav-btn" title="Next move">▶</button>
        <button id="goEndBtn" class="nav-btn" title="Go to end">⏭</button>
      </div>

      <div class="analysis-moves" id="analysisMoveList">
        ${renderMoveList(moves, moveIndex)}
      </div>

      <div class="analysis-actions">
        <button id="toggleEditorBtn" class="analysis-btn">
          ${isEditorMode() ? t('exitEditor') : t('boardEditor')}
        </button>
        <button id="exportPGNBtn" class="analysis-btn">${t('exportPGN')}</button>
        <button id="importPGNBtn" class="analysis-btn">${t('importPGN')}</button>
      </div>

      <div id="editorPanel" class="editor-panel ${isEditorMode() ? '' : 'hidden'}">
        ${renderEditorPanel()}
      </div>

      <div class="analysis-footer">
        <button id="newGameFromHereBtn" class="analysis-btn primary">${t('playFromHere')}</button>
        <button id="exitAnalysisBtn" class="analysis-btn">${t('backToGame')}</button>
      </div>
    </div>
  `;

  setupAnalysisListeners();
}

function renderMoveList(moves: MoveHistoryEntry[], currentIndex: number): string {
  if (moves.length === 0) {
    return '<p class="no-moves">No moves yet</p>';
  }

  const pairs: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = moves[i];
    const blackMove = moves[i + 1];

    const whiteClass = i === currentIndex ? 'active' : '';
    const blackClass = i + 1 === currentIndex ? 'active' : '';

    pairs.push(`
      <div class="move-pair">
        <span class="move-number">${moveNum}.</span>
        <span class="move-notation ${whiteClass}" data-index="${i}">${whiteMove?.notation || ''}</span>
        <span class="move-notation ${blackClass}" data-index="${i + 1}">${blackMove?.notation || ''}</span>
      </div>
    `);
  }

  return pairs.join('');
}

function renderEditorPanel(): string {
  const selected = getSelectedEditorPiece();
  const turn = getTurnToMove();

  return `
    <div class="editor-section">
      <h4>${t('pieces')}</h4>
      <div class="piece-palette">
        <div class="palette-row">
          ${EDITOR_PIECES.white.map(p => `
            <button class="palette-piece ${selected === p ? 'selected' : ''}" data-piece="${p}">
              <span class="piece piece-white">${PIECE_SYMBOLS[p[0] as keyof typeof PIECE_SYMBOLS] || PIECE_SYMBOLS[p as keyof typeof PIECE_SYMBOLS]}</span>
            </button>
          `).join('')}
        </div>
        <div class="palette-row">
          ${EDITOR_PIECES.black.map(p => `
            <button class="palette-piece ${selected === p ? 'selected' : ''}" data-piece="${p}">
              <span class="piece piece-black">${PIECE_SYMBOLS[p[0] as keyof typeof PIECE_SYMBOLS] || PIECE_SYMBOLS[p as keyof typeof PIECE_SYMBOLS]}</span>
            </button>
          `).join('')}
        </div>
        <button class="palette-piece erase ${selected === null ? 'selected' : ''}" data-piece="erase">
          🗑️
        </button>
      </div>
    </div>

    <div class="editor-section">
      <h4>${t('turnToMove')}</h4>
      <div class="turn-selector">
        <button class="turn-btn ${turn === 'white' ? 'active' : ''}" data-turn="white">${t('white')}</button>
        <button class="turn-btn ${turn === 'black' ? 'active' : ''}" data-turn="black">${t('black')}</button>
      </div>
    </div>

    <div class="editor-section">
      <h4>Quick actions</h4>
      <div class="editor-actions">
        <button id="clearBoardBtn" class="editor-action-btn">${t('clearBoard')}</button>
        <button id="standardPosBtn" class="editor-action-btn">${t('standardPosition')}</button>
      </div>
    </div>

    <div class="editor-section">
      <h4>FEN</h4>
      <div class="fen-input-group">
        <input type="text" id="fenInput" class="fen-input" placeholder="${t('pasteHere')}" value="${getBoardAsFEN()}">
        <button id="loadFENBtn" class="fen-btn">${t('loadFEN')}</button>
        <button id="copyFENBtn" class="fen-btn">${t('copyFEN')}</button>
      </div>
    </div>
  `;
}

function setupAnalysisListeners(): void {
  // Close button
  document.getElementById('closeAnalysisBtn')?.addEventListener('click', () => {
    hideAnalysisUI();
    initGame();
    renderBoard();
    updateUI();
  });

  // Navigation
  document.getElementById('goStartBtn')?.addEventListener('click', () => {
    goToStart();
    updateAnalysisUI();
  });

  document.getElementById('goBackBtn')?.addEventListener('click', () => {
    goBack();
    updateAnalysisUI();
  });

  document.getElementById('goForwardBtn')?.addEventListener('click', () => {
    goForward();
    updateAnalysisUI();
  });

  document.getElementById('goEndBtn')?.addEventListener('click', () => {
    goToEnd();
    updateAnalysisUI();
  });

  // Click on move to jump to it
  document.getElementById('analysisMoveList')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('move-notation')) {
      const index = parseInt(target.dataset.index || '-1');
      if (index >= 0) {
        goToMove(index);
        updateAnalysisUI();
      }
    }
  });

  // Toggle editor
  document.getElementById('toggleEditorBtn')?.addEventListener('click', () => {
    if (isEditorMode()) {
      exitEditor();
    } else {
      startEditor();
    }
    renderAnalysisPanel();
    renderBoard();
  });

  // Export PGN
  document.getElementById('exportPGNBtn')?.addEventListener('click', () => {
    showExportDialog();
  });

  // Import PGN
  document.getElementById('importPGNBtn')?.addEventListener('click', () => {
    showImportDialog();
  });

  // New game from position
  document.getElementById('newGameFromHereBtn')?.addEventListener('click', () => {
    if (isEditorMode()) {
      const validation = validatePosition();
      if (!validation.valid) {
        alert(t('invalidPosition') + ':\n' + validation.errors.join('\n'));
        return;
      }
      exitEditor();
    }
    hideAnalysisUI();
    // Keep the current board state but start a new game
    state.clearSelection();
    renderBoard();
    updateUI();
  });

  // Exit analysis
  document.getElementById('exitAnalysisBtn')?.addEventListener('click', () => {
    hideAnalysisUI();
    initGame();
    renderBoard();
    updateUI();
  });

  // Editor-specific listeners
  setupEditorListeners();
}

function setupEditorListeners(): void {
  // Piece palette
  document.querySelectorAll('.palette-piece').forEach(btn => {
    btn.addEventListener('click', () => {
      const piece = (btn as HTMLElement).dataset.piece;
      if (piece === 'erase') {
        selectEditorPiece(null);
      } else {
        selectEditorPiece(piece as Piece);
      }
      updateEditorPanel();
    });
  });

  // Turn selector
  document.querySelectorAll('.turn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const turn = (btn as HTMLElement).dataset.turn as 'white' | 'black';
      setTurnToMove(turn);
      updateEditorPanel();
    });
  });

  // Clear board
  document.getElementById('clearBoardBtn')?.addEventListener('click', () => {
    clearBoard();
    renderBoard();
    updateFENInput();
  });

  // Standard position
  document.getElementById('standardPosBtn')?.addEventListener('click', () => {
    setupStandardPosition();
    renderBoard();
    updateFENInput();
  });

  // Load FEN
  document.getElementById('loadFENBtn')?.addEventListener('click', () => {
    const input = document.getElementById('fenInput') as HTMLInputElement;
    if (input?.value) {
      const success = setBoardFromFEN(input.value);
      if (success) {
        renderBoard();
      } else {
        alert(t('invalidFEN'));
      }
    }
  });

  // Copy FEN
  document.getElementById('copyFENBtn')?.addEventListener('click', async () => {
    const fen = getBoardAsFEN();
    try {
      await navigator.clipboard.writeText(fen);
      const btn = document.getElementById('copyFENBtn');
      if (btn) {
        btn.textContent = t('copied');
        setTimeout(() => { btn.textContent = t('copyFEN'); }, 2000);
      }
    } catch {
      alert(t('invalidFEN'));
    }
  });
}

function updateAnalysisUI(): void {
  renderBoard();
  updateUI();

  // Update move list highlighting
  const moveList = document.getElementById('analysisMoveList');
  if (moveList) {
    moveList.innerHTML = renderMoveList(getSavedMoves(), getMoveIndex());

    // Re-add click listeners
    moveList.querySelectorAll('.move-notation').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '-1');
        if (index >= 0) {
          goToMove(index);
          updateAnalysisUI();
        }
      });
    });
  }

  // Update counter
  const counter = document.querySelector('.move-counter');
  if (counter) {
    counter.textContent = `${getMoveIndex() + 1} / ${getTotalMoves()}`;
  }
}

function updateEditorPanel(): void {
  const editorPanel = document.getElementById('editorPanel');
  if (editorPanel) {
    editorPanel.innerHTML = renderEditorPanel();
    setupEditorListeners();
  }
}

function updateFENInput(): void {
  const input = document.getElementById('fenInput') as HTMLInputElement;
  if (input) {
    input.value = getBoardAsFEN();
  }
}

function showExportDialog(): void {
  const moves = getSavedMoves();
  const pgn = exportToPGN({ moves });

  const overlay = document.createElement('div');
  overlay.className = 'analysis-overlay';
  overlay.id = 'exportOverlay';
  overlay.innerHTML = `
    <div class="analysis-dialog">
      <h3>${t('exportPGN')}</h3>
      <textarea id="pgnOutput" class="pgn-textarea" readonly>${pgn}</textarea>
      <div class="dialog-buttons">
        <button id="copyPGNBtn" class="analysis-btn primary">${t('copyToClipboard')}</button>
        <button id="downloadPGNBtn" class="analysis-btn">${t('downloadFile')}</button>
        <button id="closeExportBtn" class="analysis-btn">${t('close')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('copyPGNBtn')?.addEventListener('click', async () => {
    const success = await copyPGNToClipboard(pgn);
    const btn = document.getElementById('copyPGNBtn');
    if (btn) {
      btn.textContent = success ? t('copied') : 'Failed';
      setTimeout(() => { btn.textContent = t('copyToClipboard'); }, 2000);
    }
  });

  document.getElementById('downloadPGNBtn')?.addEventListener('click', () => {
    const filename = `klikschaak_${new Date().toISOString().split('T')[0]}.pgn`;
    downloadPGN(pgn, filename);
  });

  document.getElementById('closeExportBtn')?.addEventListener('click', () => {
    overlay.remove();
  });
}

function showImportDialog(): void {
  const overlay = document.createElement('div');
  overlay.className = 'analysis-overlay';
  overlay.id = 'importOverlay';
  overlay.innerHTML = `
    <div class="analysis-dialog">
      <h3>${t('importPGN')}</h3>
      <textarea id="pgnInput" class="pgn-textarea" placeholder="${t('pasteHere')}"></textarea>
      <div class="file-input-wrapper">
        <input type="file" id="pgnFileInput" accept=".pgn,.txt">
        <label for="pgnFileInput" class="analysis-btn">${t('chooseFile')}</label>
      </div>
      <div class="dialog-buttons">
        <button id="loadPGNBtn" class="analysis-btn primary">${t('loadPGN')}</button>
        <button id="closeImportBtn" class="analysis-btn">${t('cancel')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // File input handler
  document.getElementById('pgnFileInput')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      try {
        const content = await loadPGNFromFile(input.files[0]);
        const textarea = document.getElementById('pgnInput') as HTMLTextAreaElement;
        if (textarea) textarea.value = content;
      } catch {
        alert('Failed to read file');
      }
    }
  });

  document.getElementById('loadPGNBtn')?.addEventListener('click', () => {
    const textarea = document.getElementById('pgnInput') as HTMLTextAreaElement;
    if (textarea?.value) {
      const pgnData = parsePGN(textarea.value);
      if (pgnData) {
        // Load the FEN if provided
        if (pgnData.fen) {
          setBoardFromFEN(pgnData.fen);
        } else {
          setupStandardPosition();
        }

        // Start analysis with the moves
        startAnalysis(pgnData.moves);
        overlay.remove();
        renderAnalysisPanel(pgnData.white, pgnData.black);
        goToEnd();
        updateAnalysisUI();
      } else {
        alert('Failed to parse PGN');
      }
    }
  });

  document.getElementById('closeImportBtn')?.addEventListener('click', () => {
    overlay.remove();
  });
}

// Handle editor click on board
export function handleEditorBoardClick(row: number, col: number): void {
  if (!isEditorMode()) return;

  const selected = getSelectedEditorPiece();
  if (selected === null) {
    // Erase mode
    removePiece(row, col);
  } else {
    placePiece(row, col);
  }

  renderBoard();
  updateFENInput();
}

// Check if we should use editor click handling
export function shouldUseEditorClick(): boolean {
  return isEditorMode();
}

// For use in the game over modal
export function openAnalysisFromGame(moves: MoveHistoryEntry[], white?: string, black?: string): void {
  showAnalysisUI(moves, white, black);
}

// Initialize the analysis button in the main UI
export function initAnalysisButton(): void {
  // Create a floating analysis button
  const existingBtn = document.getElementById('analysisBtn');
  if (existingBtn) return;

  const btn = document.createElement('button');
  btn.id = 'analysisBtn';
  btn.className = 'analysis-mode-btn';
  btn.textContent = t('analysis');
  btn.title = t('analysisMode');

  btn.addEventListener('click', () => {
    // Start fresh analysis with current board state
    showAnalysisUI();
  });

  document.body.appendChild(btn);
}
