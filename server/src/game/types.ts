// Types voor Klikschaak - Shared between client and server

export type PieceColor = 'white' | 'black';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

// Pion IDs: P0-P7 voor wit, p0-p7 voor zwart
export type WhitePawnId = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7';
export type BlackPawnId = 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7';
export type PawnId = WhitePawnId | BlackPawnId;

export type Piece = PieceType | PawnId;

export interface Square {
  pieces: Piece[];
}

export type Board = Square[][];

export interface CastlingRights {
  kingSide: boolean;
  queenSide: boolean;
}

export interface GameCastlingRights {
  white: CastlingRights;
  black: CastlingRights;
}

export type MoveType =
  | 'normal'
  | 'klik'
  | 'unklik'
  | 'unklik-klik'
  | 'en-passant'
  | 'en-passant-unklik'
  | 'en-passant-choice'
  | 'castle-k'
  | 'castle-q'
  | 'castle-k-klik'
  | 'castle-q-klik'
  | 'castle-k-unklik-klik'
  | 'castle-q-unklik-klik'
  | 'castle-k-choice'
  | 'castle-q-choice'
  | 'castle-k-both'
  | 'castle-q-both';

export interface Move {
  row: number;
  col: number;
  type?: MoveType;
}

export interface ValidMove extends Move {
  type: MoveType;
}

export interface MoveHistoryEntry {
  turn: PieceColor;
  notation: string;
}

export interface EnPassantTarget {
  row: number;
  col: number;
}

// Server-specific types
export interface GameMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  moveType: MoveType;
  pieces: Piece[];
  unklikIndex?: number;
  promoteTo?: Piece;
}

export interface Player {
  id: string;
  username: string;
  friendCode: string;
  socketId: string;
}

export interface GameResult {
  type: 'checkmate' | 'stalemate' | 'timeout' | 'resignation' | 'disconnect';
  winner: PieceColor | null;
}

export interface TimerState {
  white: number;
  black: number;
}
