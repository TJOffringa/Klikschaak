/**
 * Engine Comparison Module
 * Bridges the webapp's JS move generation with the Rust engine (WASM or HTTP API)
 * to compare legal move counts and identify discrepancies.
 */
import type { Piece } from '../game/types.js';
import { getCombinedMoves, getPieceMoves, wouldBeInCheck } from '../game/moves.js';
import { isWhitePiece, isPawn, getPieceType } from '../game/constants.js';
import * as state from '../game/state.js';

const ENGINE_URL = 'http://localhost:5005';

// --- WASM engine management ---
// Strategy: try Web Worker first (off main thread), fall back to direct WASM (main thread)
type WasmMode = 'loading' | 'worker' | 'direct' | 'failed';
let wasmMode: WasmMode = 'loading';
let wasmWorker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

// Direct WASM module (fallback when Worker doesn't work)
let wasmEvalDirect: ((fen: string, depth: number) => string) | null = null;
let wasmMovesDirect: ((fen: string) => string) | null = null;

function initWasmWorker(): void {
  try {
    wasmWorker = new Worker(
      new URL('./engineWorker.ts', import.meta.url),
      { type: 'module' }
    );

    // If worker doesn't report ready within 5s, fall back to direct
    const workerTimeout = setTimeout(() => {
      if (wasmMode === 'loading') {
        console.warn('[Engine] Worker timeout, trying direct WASM');
        wasmWorker?.terminate();
        wasmWorker = null;
        initWasmDirect();
      }
    }, 5000);

    wasmWorker.onmessage = (e: MessageEvent) => {
      const { id, result, error, type } = e.data;
      if (type === 'ready') {
        clearTimeout(workerTimeout);
        wasmMode = 'worker';
        console.log('[Engine] WASM worker ready');
        return;
      }
      if (type === 'error') {
        clearTimeout(workerTimeout);
        console.warn('[Engine] Worker init failed:', error, '- trying direct WASM');
        wasmWorker = null;
        initWasmDirect();
        return;
      }
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        if (error) pending.reject(new Error(error));
        else pending.resolve(result);
      }
    };
    wasmWorker.onerror = (ev) => {
      clearTimeout(workerTimeout);
      console.warn('[Engine] Worker error:', ev, '- trying direct WASM');
      wasmWorker = null;
      for (const [, p] of pendingRequests) p.reject(new Error('Worker error'));
      pendingRequests.clear();
      initWasmDirect();
    };
  } catch (e) {
    console.warn('[Engine] Worker creation failed:', e, '- trying direct WASM');
    initWasmDirect();
  }
}

async function initWasmDirect(): Promise<void> {
  if (wasmMode === 'direct' || wasmMode === 'worker') return;
  try {
    const wasm = await import('../wasm/engine/klikschaak_engine.js');
    await wasm.default();
    wasmEvalDirect = wasm.wasm_eval;
    wasmMovesDirect = wasm.wasm_get_moves;
    wasmMode = 'direct';
    console.log('[Engine] WASM direct (main thread) ready');
  } catch (e) {
    console.error('[Engine] WASM direct load failed:', e);
    wasmMode = 'failed';
  }
}

// Start loading immediately
initWasmWorker();

function wasmRequest(type: string, fen: string, depth?: number): Promise<any> {
  // Worker mode: send message
  if (wasmMode === 'worker' && wasmWorker) {
    return new Promise((resolve, reject) => {
      const id = nextRequestId++;
      pendingRequests.set(id, { resolve, reject });
      wasmWorker!.postMessage({ id, type, fen, depth });
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('WASM timeout'));
        }
      }, 60000);
    });
  }

  // Direct mode: call on main thread
  if (wasmMode === 'direct') {
    return new Promise((resolve, reject) => {
      try {
        // Use setTimeout(0) to not block the current call stack
        setTimeout(() => {
          try {
            let resultStr: string;
            if (type === 'eval') {
              resultStr = wasmEvalDirect!(fen, depth ?? 4);
            } else if (type === 'moves') {
              resultStr = wasmMovesDirect!(fen);
            } else {
              reject(new Error(`Unknown type: ${type}`));
              return;
            }
            resolve(JSON.parse(resultStr));
          } catch (e) {
            reject(e);
          }
        }, 0);
      } catch (e) {
        reject(e);
      }
    });
  }

  return Promise.reject(new Error('WASM not available'));
}

function isWasmAvailable(): boolean {
  return wasmMode === 'worker' || wasmMode === 'direct';
}

/**
 * Wait for WASM to be ready (up to timeoutMs).
 */
export function waitForWasm(timeoutMs: number = 8000): Promise<boolean> {
  if (isWasmAvailable()) return Promise.resolve(true);
  if (wasmMode === 'failed') return Promise.resolve(false);

  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (isWasmAvailable()) { resolve(true); return; }
      if (wasmMode === 'failed' || Date.now() - start > timeoutMs) { resolve(false); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

export interface MoveInfo {
  uci: string;
  type: string;
}

export interface ComparisonResult {
  webappCount: number;
  engineCount: number;
  webappMoves: MoveInfo[];
  engineMoves: MoveInfo[];
  matching: string[];
  webappOnly: string[];
  engineOnly: string[];
  hasMismatch: boolean;
  engineOnline: boolean;
  error: string | null;
}

/**
 * Convert webapp (row, col) to algebraic notation.
 * Webapp: row=0 is rank 8, col=0 is file a.
 */
function squareToAlgebraic(row: number, col: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = String(8 - row);
  return file + rank;
}

/**
 * Get the FEN character for a piece.
 */
function pieceFENChar(piece: Piece): string {
  return piece[0]; // 'K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'
}

/**
 * Build a full FEN string from the current webapp game state.
 * Includes board, turn, castling rights, en passant, and clocks.
 */
export function buildFullFEN(): string {
  const board = state.getBoard();
  const turn = state.getCurrentTurn();
  const castlingRights = state.getCastlingRights();
  const ep = state.getEnPassantTarget();

  // Board
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let emptyCount = 0;

    for (let c = 0; c < 8; c++) {
      const pieces = board[r][c].pieces;
      if (pieces.length === 0) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        if (pieces.length === 1) {
          rowStr += pieceFENChar(pieces[0]);
        } else {
          rowStr += '(' + pieces.map(pieceFENChar).join('') + ')';
        }
      }
    }

    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  // Turn
  const turnStr = turn === 'white' ? 'w' : 'b';

  // Castling
  let castlingStr = '';
  if (castlingRights.white.kingSide) castlingStr += 'K';
  if (castlingRights.white.queenSide) castlingStr += 'Q';
  if (castlingRights.black.kingSide) castlingStr += 'k';
  if (castlingRights.black.queenSide) castlingStr += 'q';
  if (!castlingStr) castlingStr = '-';

  // En passant
  let epStr = '-';
  if (ep) {
    epStr = squareToAlgebraic(ep.row, ep.col);
  }

  return `${rows.join('/')} ${turnStr} ${castlingStr} ${epStr} 0 1`;
}

/**
 * Count all legal moves using the webapp's JS move generator.
 * Based on hasLegalMoves() logic but counts all moves instead of early-returning.
 */
export function countAllWebappMoves(): { count: number; moves: MoveInfo[] } {
  const board = state.getBoard();
  const turn = state.getCurrentTurn();
  const castlingRights = state.getCastlingRights();
  const ep = state.getEnPassantTarget();
  const movedPawns = state.getMovedPawns();
  const isWhite = turn === 'white';
  const allMoves: MoveInfo[] = [];
  const seenUci = new Set<string>();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const pieces = board[r][c].pieces;
      if (pieces.length === 0) continue;
      if (isWhitePiece(pieces[0]) !== isWhite) continue;

      const fromAlg = squareToAlgebraic(r, c);

      // Combined moves (whole stack or single piece moves)
      const combinedMoves = getCombinedMoves(
        board, r, c, pieces, castlingRights, ep, movedPawns, null
      );
      for (const move of combinedMoves) {
        const toAlg = squareToAlgebraic(move.row, move.col);
        let uci = fromAlg + toAlg;

        // Add suffix for move type
        if (move.type === 'klik') {
          uci += 'k';
        } else if (move.type?.startsWith('castle-')) {
          // Castling: just from-to (king move) is enough for UCI
          // Add type suffix for clarity
          uci += ':' + move.type;
        }

        // For promotion moves, add all 4 options
        const isPromotionRank = (isWhite && move.row === 0) || (!isWhite && move.row === 7);
        const hasPawn = pieces.some(p => isPawn(p));

        if (isPromotionRank && hasPawn && move.type !== 'klik' && !move.type?.startsWith('castle-')) {
          for (const promo of ['q', 'r', 'b', 'n']) {
            const promoUci = fromAlg + toAlg + promo;
            if (!seenUci.has(promoUci)) {
              seenUci.add(promoUci);
              allMoves.push({ uci: promoUci, type: move.type || 'promotion' });
            }
          }
          continue;
        }

        if (!seenUci.has(uci)) {
          seenUci.add(uci);
          allMoves.push({ uci, type: move.type || 'normal' });
        }
      }

      // Unklik moves for stacked pieces
      if (pieces.length === 2) {
        for (let i = 0; i < 2; i++) {
          const piece = pieces[i];
          const singleMoves = getPieceMoves(board, r, c, piece, castlingRights, ep, movedPawns);

          for (const move of singleMoves) {
            const [mr, mc] = move;
            const toAlg = squareToAlgebraic(mr, mc);
            const targetSq = board[mr][mc];

            // Unklik: piece leaves stack to empty/enemy square
            if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
              if (!wouldBeInCheck(board, r, c, mr, mc, pieces, 'unklik', i)) {
                let uci = fromAlg + toAlg + `u${i}`;

                // Unklik promotion
                const isPromotionRank = (isWhite && mr === 0) || (!isWhite && mr === 7);
                if (isPromotionRank && isPawn(piece)) {
                  for (const promo of ['q', 'r', 'b', 'n']) {
                    const promoUci = fromAlg + toAlg + promo + `u${i}`;
                    if (!seenUci.has(promoUci)) {
                      seenUci.add(promoUci);
                      allMoves.push({ uci: promoUci, type: 'unklik-promotion' });
                    }
                  }
                  continue;
                }

                if (!seenUci.has(uci)) {
                  seenUci.add(uci);
                  allMoves.push({ uci, type: 'unklik' });
                }
              }
            }

            // Unklik-klik: piece leaves stack to friendly square (stacking onto target)
            if (targetSq.pieces.length > 0 && targetSq.pieces.length < 2 &&
                isWhitePiece(targetSq.pieces[0]) === isWhite &&
                !targetSq.pieces.some(p => getPieceType(p) === 'k') &&
                getPieceType(piece) !== 'k') {
              if (!wouldBeInCheck(board, r, c, mr, mc, pieces, 'unklik-klik', i)) {
                const uci = fromAlg + toAlg + `U${i}`;
                if (!seenUci.has(uci)) {
                  seenUci.add(uci);
                  allMoves.push({ uci, type: 'unklik-klik' });
                }
              }
            }
          }
        }
      }
    }
  }

  return { count: allMoves.length, moves: allMoves };
}

/**
 * Fetch legal moves from the engine (WASM first, HTTP fallback).
 */
export async function fetchEngineMoves(fen: string): Promise<{ count: number; moves: MoveInfo[]; error: string | null }> {
  // Wait for WASM if it's still loading
  if (!isWasmAvailable() && wasmMode === 'loading') {
    await waitForWasm(3000);
  }
  // Try WASM first
  if (isWasmAvailable()) {
    try {
      const data = await wasmRequest('moves', fen);
      if (data.error) {
        return { count: 0, moves: [], error: data.error };
      }
      return {
        count: data.count,
        moves: data.moves.map((m: { uci: string; type: string }) => ({ uci: m.uci, type: m.type })),
        error: null,
      };
    } catch {
      // Fall through to HTTP
    }
  }

  // HTTP fallback
  try {
    const response = await fetch(`${ENGINE_URL}/moves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    if (data.error) {
      return { count: 0, moves: [], error: data.error };
    }

    return {
      count: data.count,
      moves: data.moves.map((m: { uci: string; type: string }) => ({ uci: m.uci, type: m.type })),
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed') || msg.includes('timeout') || msg.includes('abort')) {
      return { count: 0, moves: [], error: 'Engine offline' };
    }
    return { count: 0, moves: [], error: msg };
  }
}

/**
 * Check if the engine is available (WASM or HTTP).
 */
export async function checkEngineHealth(): Promise<boolean> {
  if (isWasmAvailable()) return true;

  try {
    const response = await fetch(`${ENGINE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export interface EvalResult {
  score: number;
  scoreType: 'cp' | 'mate';
  bestMove: string | null;
  pv: string[];
  depth: number;
  nodes: number;
  nps: number;
  time_ms: number;
  error: string | null;
}

/**
 * Fetch position evaluation from the engine (WASM first, HTTP fallback).
 */
export async function fetchEngineEval(fen: string, depth: number = 4): Promise<EvalResult> {
  const emptyResult: EvalResult = { score: 0, scoreType: 'cp', bestMove: null, pv: [], depth: 0, nodes: 0, nps: 0, time_ms: 0, error: null };

  // Wait for WASM if it's still loading
  if (!isWasmAvailable() && wasmMode === 'loading') {
    await waitForWasm(3000);
  }
  // Try WASM first
  if (isWasmAvailable()) {
    try {
      const data = await wasmRequest('eval', fen, depth);
      if (data.error) {
        return { ...emptyResult, error: data.error };
      }
      return {
        score: data.score,
        scoreType: data.scoreType,
        bestMove: data.bestMove,
        pv: data.pv,
        depth: data.depth,
        nodes: data.nodes,
        nps: data.nps,
        time_ms: data.time_ms,
        error: null,
      };
    } catch {
      // Fall through to HTTP
    }
  }

  // HTTP fallback
  try {
    const response = await fetch(`${ENGINE_URL}/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();
    if (data.error) {
      return { ...emptyResult, error: data.error };
    }

    return {
      score: data.score,
      scoreType: data.scoreType,
      bestMove: data.bestMove,
      pv: data.pv,
      depth: data.depth,
      nodes: data.nodes,
      nps: data.nps,
      time_ms: data.time_ms,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed') || msg.includes('timeout') || msg.includes('abort')) {
      return { ...emptyResult, error: 'Engine offline' };
    }
    return { ...emptyResult, error: msg };
  }
}

/**
 * Compare moves from both systems.
 * Uses only the from-to part of UCI for matching (ignoring klik/unklik suffixes
 * since the two systems use different move type naming).
 */
export async function comparePositionMoves(): Promise<ComparisonResult> {
  const fen = buildFullFEN();

  // Get webapp moves
  const webapp = countAllWebappMoves();

  // Get engine moves
  const engine = await fetchEngineMoves(fen);

  if (engine.error) {
    return {
      webappCount: webapp.count,
      engineCount: 0,
      webappMoves: webapp.moves,
      engineMoves: [],
      matching: [],
      webappOnly: webapp.moves.map(m => m.uci),
      engineOnly: [],
      hasMismatch: false,
      engineOnline: false,
      error: engine.error,
    };
  }

  // Compare by UCI string
  const webappUciSet = new Set(webapp.moves.map(m => m.uci));
  const engineUciSet = new Set(engine.moves.map(m => m.uci));

  const matching: string[] = [];
  const webappOnly: string[] = [];
  const engineOnly: string[] = [];

  for (const uci of webappUciSet) {
    if (engineUciSet.has(uci)) {
      matching.push(uci);
    } else {
      webappOnly.push(uci);
    }
  }

  for (const uci of engineUciSet) {
    if (!webappUciSet.has(uci)) {
      engineOnly.push(uci);
    }
  }

  return {
    webappCount: webapp.count,
    engineCount: engine.count,
    webappMoves: webapp.moves,
    engineMoves: engine.moves,
    matching: matching.sort(),
    webappOnly: webappOnly.sort(),
    engineOnly: engineOnly.sort(),
    hasMismatch: webappOnly.length > 0 || engineOnly.length > 0,
    engineOnline: true,
    error: null,
  };
}
