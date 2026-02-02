// Types voor Klikschaak

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

export interface PendingPromotion {
  row: number;
  col: number;
  isWhite: boolean;
  moveNotation: string;
  otherPieces?: Piece[];
  wasCapture?: boolean;
}

export interface EnPassantTarget {
  row: number;
  col: number;
}

export interface GameState {
  board: Board;
  currentTurn: PieceColor;
  selectedSquare: [number, number] | null;
  selectedUnklikPiece: number | null;
  validMoves: ValidMove[];
  moveHistory: MoveHistoryEntry[];
  castlingRights: GameCastlingRights;
  enPassantTarget: EnPassantTarget | null;
  movedPawns: Set<Piece>;
  autoPromoteToQueen: boolean;
  pendingPromotion: PendingPromotion | null;
  gameOver: boolean;
}

export type Language = 'nl' | 'en';

export interface Translations {
  title: string;
  subtitle: string;
  newGame: string;
  whiteToMove: string;
  blackToMove: string;
  moves: string;
  noMoves: string;
  gameRules: string;
  klik: string;
  unklik: string;
  kingWarning: string;
  promotionTip: string;
  autoPromote: string;
  selected: string;
  possibleMoves: string;
  choosePromotion: string;
  chooseCastling: string;
  onlyRook: string;
  bothPieces: string;
  chooseMove: string;
  enPassant: string;
  normalMove: string;
  pawnCaptures: string;
  moves_: string;
  checkmate: string;
  stalemate: string;
  check: string;
  wins: string;
  draw: string;
  gameEndsDraw: string;
  analysis: string;
  analysisMode: string;
  boardEditor: string;
  exitEditor: string;
  exportPGN: string;
  importPGN: string;
  playFromHere: string;
  backToGame: string;
  pieces: string;
  turnToMove: string;
  white: string;
  black: string;
  clearBoard: string;
  standardPosition: string;
  loadFEN: string;
  copyFEN: string;
  copied: string;
  invalidFEN: string;
  invalidPosition: string;
  copyToClipboard: string;
  downloadFile: string;
  close: string;
  loadPGN: string;
  cancel: string;
  pasteHere: string;
  chooseFile: string;
}
