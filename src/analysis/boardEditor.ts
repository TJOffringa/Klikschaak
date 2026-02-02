import type { Piece, PieceColor } from '../game/types.js';
import * as state from '../game/state.js';

export interface EditorState {
  isActive: boolean;
  selectedPiece: Piece | null;
  turnToMove: PieceColor;
}

let editorState: EditorState = {
  isActive: false,
  selectedPiece: null,
  turnToMove: 'white',
};

// Available pieces for placement
export const EDITOR_PIECES: { white: Piece[]; black: Piece[] } = {
  white: ['K', 'Q', 'R', 'B', 'N', 'P0'],
  black: ['k', 'q', 'r', 'b', 'n', 'p0'],
};

export function isEditorMode(): boolean {
  return editorState.isActive;
}

export function getEditorState(): EditorState {
  return editorState;
}

export function getSelectedEditorPiece(): Piece | null {
  return editorState.selectedPiece;
}

export function getTurnToMove(): PieceColor {
  return editorState.turnToMove;
}

export function startEditor(): void {
  editorState = {
    isActive: true,
    selectedPiece: null,
    turnToMove: 'white',
  };
}

export function exitEditor(): void {
  editorState = {
    isActive: false,
    selectedPiece: null,
    turnToMove: 'white',
  };
}

export function selectEditorPiece(piece: Piece | null): void {
  editorState.selectedPiece = piece;
}

export function setTurnToMove(turn: PieceColor): void {
  editorState.turnToMove = turn;
  while (state.getCurrentTurn() !== turn) {
    state.switchTurn();
  }
}

export function placePiece(row: number, col: number): void {
  if (!editorState.selectedPiece) return;

  const currentPieces = state.getBoardSquare(row, col);

  // Generate unique pawn ID if placing a pawn
  let pieceToPlace = editorState.selectedPiece;
  if (pieceToPlace === 'P0' || pieceToPlace === 'p0') {
    pieceToPlace = generateUniquePawnId(pieceToPlace[0] as 'P' | 'p');
  }

  // Klikschaak allows stacking up to 2 pieces
  if (currentPieces.length < 2) {
    // Don't allow stacking two kings or stacking pieces of different colors
    const hasKing = currentPieces.some(p => p === 'K' || p === 'k');
    const newIsKing = pieceToPlace === 'K' || pieceToPlace === 'k';

    if (hasKing || newIsKing) {
      // Can't stack with king
      state.setBoardSquare(row, col, [pieceToPlace]);
    } else if (currentPieces.length > 0) {
      const existingIsWhite = currentPieces[0].toUpperCase() === currentPieces[0];
      const newIsWhite = pieceToPlace.toUpperCase() === pieceToPlace;

      if (existingIsWhite === newIsWhite) {
        // Same color, can stack
        state.setBoardSquare(row, col, [...currentPieces, pieceToPlace]);
      } else {
        // Different colors, replace
        state.setBoardSquare(row, col, [pieceToPlace]);
      }
    } else {
      state.setBoardSquare(row, col, [pieceToPlace]);
    }
  } else {
    // Square is full, replace with new piece
    state.setBoardSquare(row, col, [pieceToPlace]);
  }
}

export function removePiece(row: number, col: number, pieceIndex?: number): void {
  const currentPieces = state.getBoardSquare(row, col);

  if (pieceIndex !== undefined && pieceIndex >= 0 && pieceIndex < currentPieces.length) {
    // Remove specific piece from stack
    const newPieces = currentPieces.filter((_, i) => i !== pieceIndex);
    state.setBoardSquare(row, col, newPieces);
  } else {
    // Clear the square
    state.setBoardSquare(row, col, []);
  }
}

export function clearBoard(): void {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.setBoardSquare(r, c, []);
    }
  }
}

export function setupStandardPosition(): void {
  state.initializeBoard();
}

// Generate a unique pawn ID that's not already on the board
function generateUniquePawnId(color: 'P' | 'p'): Piece {
  const board = state.getBoard();
  const existingIds = new Set<string>();

  // Collect all existing pawn IDs
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      for (const piece of board[r][c].pieces) {
        if (piece.startsWith(color)) {
          existingIds.add(piece);
        }
      }
    }
  }

  // Find first available ID
  for (let i = 0; i < 16; i++) {
    const id = `${color}${i}` as Piece;
    if (!existingIds.has(id)) {
      return id;
    }
  }

  // Fallback (shouldn't happen with max 16 pawns per color)
  return `${color}0` as Piece;
}

// Validate board position
export function validatePosition(): { valid: boolean; errors: string[] } {
  const board = state.getBoard();
  const errors: string[] = [];

  let whiteKings = 0;
  let blackKings = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      for (const piece of board[r][c].pieces) {
        if (piece === 'K') whiteKings++;
        if (piece === 'k') blackKings++;
      }
    }
  }

  if (whiteKings === 0) errors.push('White needs a king');
  if (whiteKings > 1) errors.push('White has too many kings');
  if (blackKings === 0) errors.push('Black needs a king');
  if (blackKings > 1) errors.push('Black has too many kings');

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Get FEN-like representation (simplified for Klikschaak)
export function getBoardAsFEN(): string {
  const board = state.getBoard();
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
        // For stacked pieces, use parentheses
        if (pieces.length === 1) {
          rowStr += getPieceFENChar(pieces[0]);
        } else {
          rowStr += '(' + pieces.map(getPieceFENChar).join('') + ')';
        }
      }
    }

    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }

  const turn = state.getCurrentTurn() === 'white' ? 'w' : 'b';
  return `${rows.join('/')} ${turn}`;
}

// Set board from FEN-like string
export function setBoardFromFEN(fen: string): boolean {
  try {
    const parts = fen.trim().split(' ');
    const boardPart = parts[0];
    const turnPart = parts[1] || 'w';

    clearBoard();

    const rows = boardPart.split('/');
    if (rows.length !== 8) return false;

    for (let r = 0; r < 8; r++) {
      let c = 0;
      let i = 0;
      const rowStr = rows[r];

      while (i < rowStr.length && c < 8) {
        const char = rowStr[i];

        if (char >= '1' && char <= '8') {
          c += parseInt(char);
          i++;
        } else if (char === '(') {
          // Stacked pieces
          const closeIdx = rowStr.indexOf(')', i);
          if (closeIdx === -1) return false;
          const stackStr = rowStr.substring(i + 1, closeIdx);
          const pieces: Piece[] = [];
          for (const pc of stackStr) {
            const piece = fenCharToPiece(pc);
            if (piece) pieces.push(piece);
          }
          state.setBoardSquare(r, c, pieces);
          c++;
          i = closeIdx + 1;
        } else {
          const piece = fenCharToPiece(char);
          if (piece) {
            state.setBoardSquare(r, c, [piece]);
          }
          c++;
          i++;
        }
      }
    }

    // Set turn
    setTurnToMove(turnPart === 'b' ? 'black' : 'white');

    return true;
  } catch {
    return false;
  }
}

function getPieceFENChar(piece: Piece): string {
  const type = piece[0];
  // Standard FEN characters
  if ('KQRBNPkqrbnp'.includes(type)) {
    return type;
  }
  return type;
}

function fenCharToPiece(char: string): Piece | null {
  const pawnCounter = { P: 0, p: 0 };

  if (char === 'P') {
    return `P${pawnCounter.P++ % 8}` as Piece;
  }
  if (char === 'p') {
    return `p${pawnCounter.p++ % 8}` as Piece;
  }
  if ('KQRBNkqrbn'.includes(char)) {
    return char as Piece;
  }
  return null;
}
