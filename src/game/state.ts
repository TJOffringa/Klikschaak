import type {
  Board,
  GameState,
  Piece,
  PieceColor,
  ValidMove,
  MoveHistoryEntry,
  EnPassantTarget,
  PendingPromotion,
  GameCastlingRights
} from './types';

// Global game state
let state: GameState = createInitialState();

function createInitialState(): GameState {
  return {
    board: createEmptyBoard(),
    currentTurn: 'white',
    selectedSquare: null,
    selectedUnklikPiece: null,
    validMoves: [],
    moveHistory: [],
    castlingRights: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassantTarget: null,
    movedPawns: new Set(),
    autoPromoteToQueen: false,
    pendingPromotion: null,
    gameOver: false,
  };
}

function createEmptyBoard(): Board {
  return Array(8).fill(null).map(() =>
    Array(8).fill(null).map(() => ({ pieces: [] }))
  );
}

export function initializeBoard(): void {
  state = createInitialState();

  // Set up white pieces
  state.board[7][0].pieces = ['R'];
  state.board[7][1].pieces = ['N'];
  state.board[7][2].pieces = ['B'];
  state.board[7][3].pieces = ['Q'];
  state.board[7][4].pieces = ['K'];
  state.board[7][5].pieces = ['B'];
  state.board[7][6].pieces = ['N'];
  state.board[7][7].pieces = ['R'];

  // White pawns with unique IDs
  for (let i = 0; i < 8; i++) {
    state.board[6][i].pieces = [`P${i}` as Piece];
  }

  // Set up black pieces
  state.board[0][0].pieces = ['r'];
  state.board[0][1].pieces = ['n'];
  state.board[0][2].pieces = ['b'];
  state.board[0][3].pieces = ['q'];
  state.board[0][4].pieces = ['k'];
  state.board[0][5].pieces = ['b'];
  state.board[0][6].pieces = ['n'];
  state.board[0][7].pieces = ['r'];

  // Black pawns with unique IDs
  for (let i = 0; i < 8; i++) {
    state.board[1][i].pieces = [`p${i}` as Piece];
  }
}

// Getters
export function getBoard(): Board {
  return state.board;
}

export function getCurrentTurn(): PieceColor {
  return state.currentTurn;
}

export function getSelectedSquare(): [number, number] | null {
  return state.selectedSquare;
}

export function getSelectedUnklikPiece(): number | null {
  return state.selectedUnklikPiece;
}

export function getValidMoves(): ValidMove[] {
  return state.validMoves;
}

export function getMoveHistory(): MoveHistoryEntry[] {
  return state.moveHistory;
}

export function getCastlingRights(): GameCastlingRights {
  return state.castlingRights;
}

export function getEnPassantTarget(): EnPassantTarget | null {
  return state.enPassantTarget;
}

export function getMovedPawns(): Set<Piece> {
  return state.movedPawns;
}

export function isAutoPromoteEnabled(): boolean {
  return state.autoPromoteToQueen;
}

export function getPendingPromotion(): PendingPromotion | null {
  return state.pendingPromotion;
}

export function isGameOver(): boolean {
  return state.gameOver;
}

// Setters
export function setSelectedSquare(square: [number, number] | null): void {
  state.selectedSquare = square;
}

export function setSelectedUnklikPiece(index: number | null): void {
  state.selectedUnklikPiece = index;
}

export function setValidMoves(moves: ValidMove[]): void {
  state.validMoves = moves;
}

export function setEnPassantTarget(target: EnPassantTarget | null): void {
  state.enPassantTarget = target;
}

export function setAutoPromote(enabled: boolean): void {
  state.autoPromoteToQueen = enabled;
}

export function setPendingPromotion(promotion: PendingPromotion | null): void {
  state.pendingPromotion = promotion;
}

export function setGameOver(over: boolean): void {
  state.gameOver = over;
}

export function switchTurn(): void {
  state.currentTurn = state.currentTurn === 'white' ? 'black' : 'white';
}

export function addMoveToHistory(entry: MoveHistoryEntry): void {
  state.moveHistory.push(entry);
}

export function addMovedPawn(pawn: Piece): void {
  state.movedPawns.add(pawn);
}

export function updateCastlingRights(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  pieces: Piece[]
): void {
  // Rook captured or moved
  if (toRow === 7 && toCol === 0 && pieces.includes('R')) state.castlingRights.white.queenSide = false;
  if (toRow === 7 && toCol === 7 && pieces.includes('R')) state.castlingRights.white.kingSide = false;
  if (toRow === 0 && toCol === 0 && pieces.includes('r')) state.castlingRights.black.queenSide = false;
  if (toRow === 0 && toCol === 7 && pieces.includes('r')) state.castlingRights.black.kingSide = false;

  if (pieces.includes('R') && fromRow === 7 && fromCol === 0) state.castlingRights.white.queenSide = false;
  if (pieces.includes('R') && fromRow === 7 && fromCol === 7) state.castlingRights.white.kingSide = false;
  if (pieces.includes('r') && fromRow === 0 && fromCol === 0) state.castlingRights.black.queenSide = false;
  if (pieces.includes('r') && fromRow === 0 && fromCol === 7) state.castlingRights.black.kingSide = false;
}

export function disableCastling(color: PieceColor): void {
  if (color === 'white') {
    state.castlingRights.white = { kingSide: false, queenSide: false };
  } else {
    state.castlingRights.black = { kingSide: false, queenSide: false };
  }
}

export function clearSelection(): void {
  state.selectedSquare = null;
  state.selectedUnklikPiece = null;
  state.validMoves = [];
}

// Direct board manipulation (for moves)
export function setBoardSquare(row: number, col: number, pieces: Piece[]): void {
  state.board[row][col].pieces = pieces;
}

export function getBoardSquare(row: number, col: number): Piece[] {
  return state.board[row][col].pieces;
}
