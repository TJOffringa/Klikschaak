/**
 * Engine Game Module
 * Handles playing against the Rust/Python engine.
 */
import type { Piece, MoveType, ValidMove } from './types.js';
import { getCombinedMoves, getPieceMoves } from './moves.js';
import * as state from './state.js';
import { buildFullFEN, fetchEngineEval } from '../analysis/engineCompare.js';
import { renderBoard, updateUI, showGameOver } from '../ui/render.js';

const ENGINE_DEPTH = 8;

interface EngineGameState {
  active: boolean;
  engineColor: 'white' | 'black';
  thinking: boolean;
}

const engineState: EngineGameState = {
  active: false,
  engineColor: 'black',
  thinking: false,
};

export function startEngineGame(playerColor: 'white' | 'black'): void {
  engineState.active = true;
  engineState.engineColor = playerColor === 'white' ? 'black' : 'white';
  engineState.thinking = false;

  // Remove any game over overlay
  const overlay = document.getElementById('gameOverOverlay');
  if (overlay) overlay.remove();

  // Reset board
  state.initializeBoard();
  state.setGameOver(false);
  renderBoard();
  updateUI();

  // If engine plays white, make first move
  if (engineState.engineColor === 'white') {
    requestEngineMove();
  }
}

export function isEngineGame(): boolean {
  return engineState.active;
}

export function isEngineTurn(): boolean {
  return engineState.active && state.getCurrentTurn() === engineState.engineColor;
}

export function isEngineThinking(): boolean {
  return engineState.thinking;
}

export function getEngineColor(): 'white' | 'black' {
  return engineState.engineColor;
}

export function stopEngineGame(): void {
  engineState.active = false;
  engineState.thinking = false;
}

export function resignEngineGame(): void {
  if (!engineState.active || state.isGameOver()) return;
  engineState.thinking = false;
  state.setGameOver(true);
  showGameOver('checkmate', engineState.engineColor);
}

/**
 * Offer a draw to the engine.
 * The engine accepts if its eval is 0 or worse (from its perspective).
 */
export async function offerDrawToEngine(): Promise<boolean> {
  if (!engineState.active || state.isGameOver()) return false;

  const fen = buildFullFEN();
  const result = await fetchEngineEval(fen, 6);

  if (result.error) return false;

  // Engine accepts if score is 0 or worse from its perspective
  // result.score is from white's perspective
  const engineScore = engineState.engineColor === 'white' ? result.score : -result.score;
  if (engineScore <= 0) {
    engineState.thinking = false;
    state.setGameOver(true);
    showGameOver('stalemate', null); // stalemate type shows "draw"
    return true;
  }
  return false;
}

/**
 * Convert algebraic notation (e.g. "e2") to webapp (row, col).
 * Webapp: row=0 is rank 8, col=0 is file a.
 */
function algebraicToCoords(alg: string): [number, number] {
  const col = alg.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(alg[1]);
  const row = 8 - rank;
  return [row, col];
}

/**
 * Parse a UCI move string into components.
 */
function parseUCIMove(uci: string): {
  fromRow: number; fromCol: number;
  toRow: number; toCol: number;
  promotion: string | null;
  suffix: string;
  unklikIndex: number | null;
} {
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const rest = uci.substring(4);
  const [fromRow, fromCol] = algebraicToCoords(from);
  const [toRow, toCol] = algebraicToCoords(to);

  let promotion: string | null = null;
  let suffix = '';
  let unklikIndex: number | null = null;

  if (rest) {
    // Unklik-klik: U0, U1
    if (rest.startsWith('U')) {
      unklikIndex = parseInt(rest[1]);
      suffix = 'unklik-klik';
    }
    // Unklik: u0, u1 (possibly with promotion before, e.g. "qu0")
    else if (rest.includes('u')) {
      const uIdx = rest.indexOf('u');
      if (uIdx > 0) {
        promotion = rest.substring(0, uIdx);
      }
      unklikIndex = parseInt(rest[uIdx + 1]);
      suffix = 'unklik';
    }
    // Klik: "k"
    else if (rest === 'k') {
      suffix = 'klik';
    }
    // Promotion: "q", "r", "b", "n"
    else if ('qrbn'.includes(rest)) {
      promotion = rest;
    }
  }

  return { fromRow, fromCol, toRow, toCol, promotion, suffix, unklikIndex };
}

export async function requestEngineMove(): Promise<void> {
  if (!engineState.active || state.isGameOver()) return;

  engineState.thinking = true;
  updateEnginePanel();

  try {
    const fen = buildFullFEN();
    console.log('[Engine] Requesting move for FEN:', fen);
    const result = await fetchEngineEval(fen, ENGINE_DEPTH);

    if (!engineState.active || state.isGameOver()) return;

    if (result.error || !result.bestMove) {
      console.error('[Engine] Error:', result.error);
      engineState.thinking = false;
      updateEnginePanel();
      return;
    }

    console.log('[Engine] Best move:', result.bestMove, 'depth:', result.depth, 'score:', result.score);
    const parsed = parseUCIMove(result.bestMove);

    // Use dynamic import to avoid circular dependency with actions.ts
    const actions = await import('./actions.js');
    executeEngineMove(parsed, actions);
  } catch (e) {
    console.error('[Engine] Request failed:', e);
  }

  engineState.thinking = false;
  updateEnginePanel();
}

function executeEngineMove(
  parsed: ReturnType<typeof parseUCIMove>,
  actions: { movePiece: typeof import('./actions.js').movePiece; executeCastling: typeof import('./actions.js').executeCastling }
): void {
  const { fromRow, fromCol, toRow, toCol, promotion, suffix, unklikIndex } = parsed;
  const board = state.getBoard();
  const fromSq = board[fromRow][fromCol];

  // Determine promotion piece
  let promotePiece: Piece | undefined;
  if (promotion) {
    const isWhite = engineState.engineColor === 'white';
    promotePiece = (isWhite ? promotion.toUpperCase() : promotion.toLowerCase()) as Piece;
  }

  // For unklik/unklik-klik moves
  if (unklikIndex !== null) {
    state.setSelectedSquare([fromRow, fromCol]);
    state.setSelectedUnklikPiece(unklikIndex);

    const piece = fromSq.pieces[unklikIndex];
    const singleMoves = getPieceMoves(board, fromRow, fromCol, piece, state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns());

    let matchedType: MoveType = suffix === 'unklik-klik' ? 'unklik-klik' : 'unklik';

    // Check en passant unklik
    for (const move of singleMoves) {
      if (move[0] === toRow && move[1] === toCol && move[2] === 'en-passant') {
        matchedType = 'en-passant-unklik';
        break;
      }
    }

    actions.movePiece(fromRow, fromCol, toRow, toCol, matchedType, promotePiece);
    return;
  }

  // Combined moves (normal/capture/klik/castle/en-passant)
  const combinedMoves = getCombinedMoves(
    board, fromRow, fromCol, fromSq.pieces,
    state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns(), null
  );

  const candidates = combinedMoves.filter(m => m.row === toRow && m.col === toCol);

  if (candidates.length === 0) {
    console.error('No matching move found for engine UCI:', parsed);
    return;
  }

  let matchedMove: ValidMove;
  if (suffix === 'klik') {
    matchedMove = candidates.find(m => m.type === 'klik') || candidates[0];
  } else {
    // Prefer non-klik move
    matchedMove = candidates.find(m => m.type !== 'klik') || candidates[0];
  }

  // Handle castling
  if (matchedMove.type.startsWith('castle-')) {
    actions.executeCastling(fromRow, fromCol, toRow, toCol, matchedMove.type);
    return;
  }

  // Normal/capture/en-passant/promotion
  actions.movePiece(fromRow, fromCol, toRow, toCol, matchedMove.type, promotePiece);
}

function updateEnginePanel(): void {
  const indicator = document.getElementById('engineThinking');
  if (indicator) {
    indicator.style.display = engineState.thinking ? 'flex' : 'none';
  }
}
