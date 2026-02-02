import type { Board, Piece, PieceColor, MoveHistoryEntry, EnPassantTarget, GameCastlingRights } from '../game/types.js';
import * as state from '../game/state.js';

export interface AnalysisState {
  isActive: boolean;
  initialBoard: Board;
  initialTurn: PieceColor;
  moveIndex: number; // Current position in move history (-1 = initial position)
  savedMoves: MoveHistoryEntry[];
  boardStates: BoardSnapshot[];
}

export interface BoardSnapshot {
  board: Board;
  turn: PieceColor;
  enPassantTarget: EnPassantTarget | null;
  castlingRights: GameCastlingRights;
  movedPawns: Piece[];
}

let analysisState: AnalysisState = {
  isActive: false,
  initialBoard: [],
  initialTurn: 'white',
  moveIndex: -1,
  savedMoves: [],
  boardStates: [],
};

export function isAnalysisMode(): boolean {
  return analysisState.isActive;
}

export function getAnalysisState(): AnalysisState {
  return analysisState;
}

export function getMoveIndex(): number {
  return analysisState.moveIndex;
}

export function getTotalMoves(): number {
  return analysisState.savedMoves.length;
}

export function getSavedMoves(): MoveHistoryEntry[] {
  return analysisState.savedMoves;
}

// Start analysis mode with a game's moves
export function startAnalysis(moves: MoveHistoryEntry[], boardStates?: BoardSnapshot[]): void {
  analysisState = {
    isActive: true,
    initialBoard: cloneBoard(state.getBoard()),
    initialTurn: state.getCurrentTurn(),
    moveIndex: moves.length - 1, // Start at the end
    savedMoves: [...moves],
    boardStates: boardStates || [],
  };

  // If we don't have board states, we need to replay to build them
  if (!boardStates || boardStates.length === 0) {
    buildBoardStates();
  }
}

// Start analysis from current position (for local games)
export function startAnalysisFromCurrent(): void {
  const moves = state.getMoveHistory();

  analysisState = {
    isActive: true,
    initialBoard: cloneBoard(state.getBoard()),
    initialTurn: state.getCurrentTurn(),
    moveIndex: moves.length - 1,
    savedMoves: [...moves],
    boardStates: [],
  };

  // Build board states by replaying
  buildBoardStates();
}

// Start fresh analysis with empty/standard board
export function startFreshAnalysis(useStandardPosition: boolean = true): void {
  state.initializeBoard();

  if (!useStandardPosition) {
    // Clear the board
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.setBoardSquare(r, c, []);
      }
    }
  }

  analysisState = {
    isActive: true,
    initialBoard: cloneBoard(state.getBoard()),
    initialTurn: 'white',
    moveIndex: -1,
    savedMoves: [],
    boardStates: [{
      board: cloneBoard(state.getBoard()),
      turn: 'white',
      enPassantTarget: null,
      castlingRights: { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      movedPawns: [],
    }],
  };
}

export function exitAnalysis(): void {
  analysisState = {
    isActive: false,
    initialBoard: [],
    initialTurn: 'white',
    moveIndex: -1,
    savedMoves: [],
    boardStates: [],
  };
}

// Navigate to a specific move
export function goToMove(index: number): void {
  if (index < -1 || index >= analysisState.savedMoves.length) return;

  analysisState.moveIndex = index;

  // Restore board state at this index
  const snapshotIndex = index + 1; // boardStates[0] is initial, [1] is after move 0, etc.
  if (snapshotIndex >= 0 && snapshotIndex < analysisState.boardStates.length) {
    const snapshot = analysisState.boardStates[snapshotIndex];
    restoreSnapshot(snapshot);
  }
}

export function goToStart(): void {
  goToMove(-1);
}

export function goToEnd(): void {
  goToMove(analysisState.savedMoves.length - 1);
}

export function goBack(): void {
  if (analysisState.moveIndex >= 0) {
    goToMove(analysisState.moveIndex - 1);
  }
}

export function goForward(): void {
  if (analysisState.moveIndex < analysisState.savedMoves.length - 1) {
    goToMove(analysisState.moveIndex + 1);
  }
}

// Add a move in analysis (when playing forward from current position)
export function addAnalysisMove(entry: MoveHistoryEntry): void {
  // If we're not at the end, truncate future moves
  if (analysisState.moveIndex < analysisState.savedMoves.length - 1) {
    analysisState.savedMoves = analysisState.savedMoves.slice(0, analysisState.moveIndex + 1);
    analysisState.boardStates = analysisState.boardStates.slice(0, analysisState.moveIndex + 2);
  }

  analysisState.savedMoves.push(entry);
  analysisState.boardStates.push(captureCurrentState());
  analysisState.moveIndex = analysisState.savedMoves.length - 1;
}

// Helper functions
function cloneBoard(board: Board): Board {
  return board.map(row => row.map(sq => ({ pieces: [...sq.pieces] })));
}

function captureCurrentState(): BoardSnapshot {
  return {
    board: cloneBoard(state.getBoard()),
    turn: state.getCurrentTurn(),
    enPassantTarget: state.getEnPassantTarget(),
    castlingRights: JSON.parse(JSON.stringify(state.getCastlingRights())),
    movedPawns: Array.from(state.getMovedPawns()),
  };
}

function restoreSnapshot(snapshot: BoardSnapshot): void {
  // Restore board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.setBoardSquare(r, c, [...snapshot.board[r][c].pieces]);
    }
  }

  // Restore turn
  while (state.getCurrentTurn() !== snapshot.turn) {
    state.switchTurn();
  }

  // Restore en passant
  state.setEnPassantTarget(snapshot.enPassantTarget);

  state.clearSelection();
}

function buildBoardStates(): void {
  // This would require replaying all moves from the initial position
  // For now, we'll just save the final state
  // A full implementation would need the move execution logic
  analysisState.boardStates = [{
    board: analysisState.initialBoard,
    turn: analysisState.initialTurn,
    enPassantTarget: null,
    castlingRights: { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
    movedPawns: [],
  }];
}

// Set a specific board position (for board editor)
export function setPosition(board: Board, turn: PieceColor = 'white'): void {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      state.setBoardSquare(r, c, [...board[r][c].pieces]);
    }
  }

  while (state.getCurrentTurn() !== turn) {
    state.switchTurn();
  }

  state.clearSelection();

  // Update analysis state if active
  if (analysisState.isActive) {
    analysisState.initialBoard = cloneBoard(board);
    analysisState.initialTurn = turn;
    analysisState.savedMoves = [];
    analysisState.moveIndex = -1;
    analysisState.boardStates = [captureCurrentState()];
  }
}
