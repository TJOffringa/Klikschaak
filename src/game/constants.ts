import type { Piece } from './types';

// Piece Symbols mapping
export const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  // Pawn IDs
  P0: '♙', P1: '♙', P2: '♙', P3: '♙', P4: '♙', P5: '♙', P6: '♙', P7: '♙',
  p0: '♟', p1: '♟', p2: '♟', p3: '♟', p4: '♟', p5: '♟', p6: '♟', p7: '♟',
};

// Piece Names - will be updated by i18n
export const PIECE_NAMES: Record<string, Record<string, string>> = {
  nl: {
    K: 'Koning', Q: 'Dame', R: 'Toren', B: 'Loper', N: 'Paard', P: 'Pion',
    k: 'koning', q: 'dame', r: 'toren', b: 'loper', n: 'paard', p: 'pion',
    P0: 'Pion', P1: 'Pion', P2: 'Pion', P3: 'Pion', P4: 'Pion', P5: 'Pion', P6: 'Pion', P7: 'Pion',
    p0: 'pion', p1: 'pion', p2: 'pion', p3: 'pion', p4: 'pion', p5: 'pion', p6: 'pion', p7: 'pion',
  },
  en: {
    K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
    k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
    P0: 'Pawn', P1: 'Pawn', P2: 'Pawn', P3: 'Pawn', P4: 'Pawn', P5: 'Pawn', P6: 'Pawn', P7: 'Pawn',
    p0: 'pawn', p1: 'pawn', p2: 'pawn', p3: 'pawn', p4: 'pawn', p5: 'pawn', p6: 'pawn', p7: 'pawn',
  },
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
