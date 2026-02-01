import type { Piece } from './types.js';

// Piece Symbols mapping
export const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  // Pawn IDs
  P0: '♙', P1: '♙', P2: '♙', P3: '♙', P4: '♙', P5: '♙', P6: '♙', P7: '♙',
  p0: '♟', p1: '♟', p2: '♟', p3: '♟', p4: '♟', p5: '♟', p6: '♟', p7: '♟',
};

// Piece values for sorting stacked pieces
export const PIECE_VALUES: Record<string, number> = {
  q: 5, r: 4, b: 3, n: 2, p: 1, k: 6,
};

// Knight move offsets
export const KNIGHT_MOVES: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

// King move offsets
export const KING_MOVES: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

// Diagonal directions (for bishop/queen)
export const DIAGONAL_DIRS: [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Orthogonal directions (for rook/queen)
export const ORTHOGONAL_DIRS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

// File letters
export const FILES = 'abcdefgh';

// Rank numbers (from white's perspective, row 0 = rank 8)
export const RANKS = '87654321';

// Helper functions
export function isWhitePiece(piece: Piece): boolean {
  return piece === piece.toUpperCase();
}

export function isPawn(piece: Piece): boolean {
  return piece.charAt(0).toLowerCase() === 'p';
}

export function getPieceType(piece: Piece): string {
  return piece.charAt(0).toLowerCase();
}

export function getPieceValue(piece: Piece): number {
  return PIECE_VALUES[getPieceType(piece)] || 0;
}

export function coordToNotation(row: number, col: number): string {
  return FILES[col] + RANKS[row];
}

export function piecesToSymbols(pieces: Piece[]): string {
  return pieces.map(p => PIECE_SYMBOLS[p]).join('');
}
