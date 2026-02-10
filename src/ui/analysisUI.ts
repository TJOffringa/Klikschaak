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
import type { ComparisonResult, EvalResult } from '../analysis/engineCompare.js';
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
  updateEngineComparison();
  updateEngineEval();
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

      <div class="engine-eval" id="engineEvalPanel">
        <div class="eval-header">
          <button id="engineToggleBtn" class="engine-toggle-btn active" title="Toggle engine">&#9881; Engine</button>
        </div>
        <div class="eval-content" id="evalContent">
          <div class="eval-bar-container">
            <div class="eval-bar" id="evalBar">
              <div class="eval-fill" id="evalFill"></div>
            </div>
            <span class="eval-score" id="evalScore">...</span>
          </div>
          <div class="eval-info" id="evalInfo"></div>
        </div>
      </div>

      <div class="engine-compare" id="engineComparePanel">
        <div class="compare-header">
          <span class="compare-status" id="engineStatus">Loading...</span>
        </div>
        <div class="compare-counts" id="compareCounts"></div>
        <div class="compare-diff hidden" id="compareDiff"></div>
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
  // Engine toggle
  document.getElementById('engineToggleBtn')?.addEventListener('click', () => {
    engineEnabled = !engineEnabled;
    const btn = document.getElementById('engineToggleBtn');
    const content = document.getElementById('evalContent');
    if (btn) {
      btn.classList.toggle('active', engineEnabled);
    }
    if (content) {
      content.classList.toggle('hidden', !engineEnabled);
    }
    if (engineEnabled) {
      updateEngineEval();
    } else if (evalAbortController) {
      evalAbortController.abort();
    }
  });

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
    updateEngineComparison();
  });

  // Standard position
  document.getElementById('standardPosBtn')?.addEventListener('click', () => {
    setupStandardPosition();
    renderBoard();
    updateFENInput();
    updateEngineComparison();
  });

  // Load FEN
  document.getElementById('loadFENBtn')?.addEventListener('click', () => {
    const input = document.getElementById('fenInput') as HTMLInputElement;
    if (input?.value) {
      const success = setBoardFromFEN(input.value);
      if (success) {
        renderBoard();
        updateEngineComparison();
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

export function updateAnalysisUI(): void {
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

  // Update engine comparison and eval
  updateEngineComparison();
  updateEngineEval();
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

function updateEngineComparison(): void {
  const statusEl = document.getElementById('engineStatus');
  const countsEl = document.getElementById('compareCounts');
  const diffEl = document.getElementById('compareDiff');

  if (!statusEl || !countsEl) return;

  statusEl.textContent = 'Comparing...';
  countsEl.innerHTML = '';
  if (diffEl) {
    diffEl.innerHTML = '';
    diffEl.classList.add('hidden');
  }

  // Dynamic import to avoid adding engineCompare to the initial module load chain
  import('../analysis/engineCompare.js').then(({ comparePositionMoves }) =>
    comparePositionMoves()
  ).then((result: ComparisonResult) => {
    // Check elements still exist (user may have navigated away)
    const status = document.getElementById('engineStatus');
    const counts = document.getElementById('compareCounts');
    const diff = document.getElementById('compareDiff');
    if (!status || !counts) return;

    if (!result.engineOnline) {
      status.textContent = 'Engine offline';
      status.className = 'compare-status offline';
      counts.innerHTML = `<span class="webapp-count">Webapp: ${result.webappCount} moves</span>`;
      return;
    }

    if (result.hasMismatch) {
      status.textContent = 'MISMATCH';
      status.className = 'compare-status mismatch';
      counts.innerHTML = `
        <span class="webapp-count">Webapp: <strong>${result.webappCount}</strong></span>
        <span class="separator">|</span>
        <span class="engine-count">Engine: <strong>${result.engineCount}</strong></span>
        <button id="toggleDiffBtn" class="diff-toggle-btn">
          Show diff (${result.webappOnly.length + result.engineOnly.length} different)
        </button>
      `;

      if (diff) {
        let diffHtml = '<div class="diff-content">';

        if (result.webappOnly.length > 0) {
          diffHtml += '<div class="diff-section webapp-only">';
          diffHtml += `<h5>Only in Webapp (${result.webappOnly.length}):</h5>`;
          diffHtml += '<div class="move-chips">';
          for (const uci of result.webappOnly) {
            diffHtml += `<span class="move-chip webapp">${uci}</span>`;
          }
          diffHtml += '</div></div>';
        }

        if (result.engineOnly.length > 0) {
          diffHtml += '<div class="diff-section engine-only">';
          diffHtml += `<h5>Only in Engine (${result.engineOnly.length}):</h5>`;
          diffHtml += '<div class="move-chips">';
          for (const uci of result.engineOnly) {
            diffHtml += `<span class="move-chip engine">${uci}</span>`;
          }
          diffHtml += '</div></div>';
        }

        diffHtml += `<div class="diff-section matching">`;
        diffHtml += `<h5>Matching (${result.matching.length}):</h5>`;
        diffHtml += '<div class="move-chips">';
        for (const uci of result.matching) {
          diffHtml += `<span class="move-chip match">${uci}</span>`;
        }
        diffHtml += '</div></div>';

        diffHtml += '</div>';
        diff.innerHTML = diffHtml;
      }

      // Toggle diff visibility
      document.getElementById('toggleDiffBtn')?.addEventListener('click', () => {
        if (diff) {
          diff.classList.toggle('hidden');
          const btn = document.getElementById('toggleDiffBtn');
          if (btn) {
            btn.textContent = diff.classList.contains('hidden')
              ? `Show diff (${result.webappOnly.length + result.engineOnly.length} different)`
              : 'Hide diff';
          }
        }
      });
    } else {
      status.textContent = 'MATCH';
      status.className = 'compare-status match';
      counts.innerHTML = `
        <span class="webapp-count">Webapp: <strong>${result.webappCount}</strong></span>
        <span class="separator">|</span>
        <span class="engine-count">Engine: <strong>${result.engineCount}</strong></span>
      `;
    }
  });
}

function formatNodes(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// Engine toggle state
let engineEnabled = true;

// Abort controller for cancelling in-flight eval requests
let evalAbortController: AbortController | null = null;

function updateEngineEval(): void {
  if (!engineEnabled) return;
  const scoreEl = document.getElementById('evalScore');
  if (!scoreEl) return;

  // Cancel any previous eval chain
  if (evalAbortController) {
    evalAbortController.abort();
  }
  evalAbortController = new AbortController();
  const signal = evalAbortController.signal;

  scoreEl.textContent = '...';

  // Iterative deepening: request depth 1, 2, ... 10, updating UI at each level
  import('../analysis/engineCompare.js').then(async ({ fetchEngineEval, buildFullFEN }) => {
    const fen = buildFullFEN();
    const maxDepth = 10;

    for (let d = 1; d <= maxDepth; d++) {
      if (signal.aborted) return;

      const result = await fetchEngineEval(fen, d);

      if (signal.aborted) return;
      if (result.error) {
        // Only show offline if we have no results yet (depth 1 failed)
        if (d === 1) {
          const score = document.getElementById('evalScore');
          const fill = document.getElementById('evalFill');
          const info = document.getElementById('evalInfo');
          if (score) score.textContent = '--';
          if (fill) fill.style.width = '50%';
          if (info) info.innerHTML = '<span style="color:#64748b">Engine offline</span>';
        }
        return;
      }

      updateEvalDisplay(result);
    }
  });
}

function updateEvalDisplay(result: EvalResult): void {
  const score = document.getElementById('evalScore');
  const fill = document.getElementById('evalFill');
  const info = document.getElementById('evalInfo');
  if (!score) return;

  // Score display
  if (result.scoreType === 'mate') {
    const prefix = result.score > 0 ? '+' : '';
    score.textContent = `M${prefix}${result.score}`;
  } else {
    const cp = result.score / 100;
    const prefix = cp > 0 ? '+' : '';
    score.textContent = `${prefix}${cp.toFixed(1)}`;
  }

  // Eval bar fill (sigmoid)
  if (fill) {
    let pct: number;
    if (result.scoreType === 'mate') {
      pct = result.score > 0 ? 95 : 5;
    } else {
      pct = 50 + 50 * (2 / (1 + Math.exp(-result.score / 400)) - 1);
    }
    fill.style.width = `${Math.max(2, Math.min(98, pct))}%`;
  }

  // Info line
  if (info) {
    let html = '';
    if (result.bestMove) {
      html += `<span class="eval-bestmove">Best: ${result.bestMove}</span>`;
    }
    if (result.pv.length > 1) {
      html += `<div class="eval-pv">${result.pv.slice(0, 5).join(' ')}</div>`;
    }
    html += `<div class="eval-stats">depth ${result.depth} | ${formatNodes(result.nodes)} nodes | ${formatNodes(result.nps)} nps | ${result.time_ms}ms</div>`;
    info.innerHTML = html;
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
