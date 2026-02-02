import { getSocket } from './socket.js';
import type { Board, Piece, PieceColor, MoveType, EnPassantTarget, GameCastlingRights, MoveHistoryEntry } from '../game/types.js';

export type TimeControl = 'bullet' | 'blitz-3' | 'blitz-5' | 'rapid-7' | 'standard' | 'custom';

export interface TimeControlSettings {
  initialTime: number;  // ms
  increment: number;    // ms
}

export interface OnlineGameState {
  gameId: string;
  gameCode: string;
  myColor: PieceColor;
  board: Board;
  currentTurn: PieceColor;
  timer: { white: number; black: number };
  opponent: { username: string } | null;
  moveHistory: MoveHistoryEntry[];
  enPassantTarget: EnPassantTarget | null;
  castlingRights: GameCastlingRights;
  movedPawns: Piece[];
  gameStarted: boolean;
  gameOver: boolean;
  result: {
    type: 'checkmate' | 'stalemate' | 'timeout' | 'resignation' | 'disconnect';
    winner: PieceColor | null;
  } | null;
}

// State
let gameState: OnlineGameState | null = null;
let isOnlineMode = false;

// Callbacks
let onGameCreated: ((gameCode: string) => void) | null = null;
let onGameJoined: ((state: OnlineGameState) => void) | null = null;
let onGameStarted: ((state: OnlineGameState) => void) | null = null;
let onMoveMade: ((state: OnlineGameState) => void) | null = null;
let onTimerUpdate: ((white: number, black: number) => void) | null = null;
let onGameOver: ((result: OnlineGameState['result']) => void) | null = null;
let onError: ((message: string) => void) | null = null;

export function setupGameListeners(): void {
  const socket = getSocket();
  if (!socket) return;

  socket.on('game:created', (data: {
    gameId: string;
    gameCode: string;
    color: PieceColor;
    timeControl: TimeControl;
  }) => {
    gameState = {
      gameId: data.gameId,
      gameCode: data.gameCode,
      myColor: data.color,
      board: createEmptyBoard(),
      currentTurn: 'white',
      timer: { white: getInitialTime(data.timeControl), black: getInitialTime(data.timeControl) },
      opponent: null,
      moveHistory: [],
      enPassantTarget: null,
      castlingRights: {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      },
      movedPawns: [],
      gameStarted: false,
      gameOver: false,
      result: null,
    };
    isOnlineMode = true;
    onGameCreated?.(data.gameCode);
  });

  socket.on('game:joined', (data: {
    gameId: string;
    gameCode: string;
    color: PieceColor;
    opponent: { username: string };
  }) => {
    gameState = {
      gameId: data.gameId,
      gameCode: data.gameCode,
      myColor: data.color,
      board: createEmptyBoard(),
      currentTurn: 'white',
      timer: { white: 420000, black: 420000 },
      opponent: data.opponent,
      moveHistory: [],
      enPassantTarget: null,
      castlingRights: {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      },
      movedPawns: [],
      gameStarted: false,
      gameOver: false,
      result: null,
    };
    isOnlineMode = true;
    onGameJoined?.(gameState);
  });

  socket.on('game:started', (data: {
    gameId: string;
    board: Board;
    currentTurn: PieceColor;
    timer: { white: number; black: number };
    white: { username: string };
    black: { username: string };
  }) => {
    if (gameState) {
      gameState.board = data.board;
      gameState.currentTurn = data.currentTurn;
      gameState.timer = data.timer;
      gameState.gameStarted = true;
      gameState.opponent = gameState.myColor === 'white'
        ? data.black
        : data.white;
      onGameStarted?.(gameState);
    }
  });

  socket.on('game:move-made', (data: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    moveType: MoveType;
    notation: string;
    board: Board;
    currentTurn: PieceColor;
    timer: { white: number; black: number };
    enPassantTarget: EnPassantTarget | null;
    castlingRights: GameCastlingRights;
    movedPawns: Piece[];
  }) => {
    if (gameState) {
      gameState.board = data.board;
      gameState.currentTurn = data.currentTurn;
      gameState.timer = data.timer;
      gameState.enPassantTarget = data.enPassantTarget;
      gameState.castlingRights = data.castlingRights;
      gameState.movedPawns = data.movedPawns;
      gameState.moveHistory.push({
        turn: data.currentTurn === 'white' ? 'black' : 'white',
        notation: data.notation,
      });
      onMoveMade?.(gameState);
    }
  });

  socket.on('game:move-rejected', (data: { error: string }) => {
    onError?.(data.error);
  });

  socket.on('game:timer-sync', (data: { white: number; black: number }) => {
    if (gameState) {
      gameState.timer = data;
      onTimerUpdate?.(data.white, data.black);
    }
  });

  socket.on('game:over', (result: OnlineGameState['result']) => {
    if (gameState) {
      gameState.gameOver = true;
      gameState.result = result;
      onGameOver?.(result);
    }
  });

  socket.on('game:error', (data: { message: string }) => {
    onError?.(data.message);
  });

  socket.on('game:state', (state: any) => {
    if (state) {
      gameState = {
        gameId: state.id,
        gameCode: state.gameCode,
        myColor: state.yourColor,
        board: state.board,
        currentTurn: state.currentTurn,
        timer: state.timer,
        opponent: state.yourColor === 'white' ? state.blackPlayer : state.whitePlayer,
        moveHistory: state.moveHistory,
        enPassantTarget: state.enPassantTarget,
        castlingRights: state.castlingRights,
        movedPawns: state.movedPawns,
        gameStarted: state.gameStarted,
        gameOver: state.gameOver,
        result: state.result,
      };
      isOnlineMode = true;
      onGameJoined?.(gameState);
      if (state.gameStarted) {
        onGameStarted?.(gameState);
      }
    }
  });
}

function getInitialTime(timeControl: TimeControl): number {
  switch (timeControl) {
    case 'bullet': return 60 * 1000;
    case 'blitz-3': return 3 * 60 * 1000;
    case 'blitz-5': return 5 * 60 * 1000;
    case 'rapid-7': return 7 * 60 * 1000;
    case 'standard': return 7 * 60 * 1000;
    default: return 7 * 60 * 1000;
  }
}

function createEmptyBoard(): Board {
  return Array(8).fill(null).map(() =>
    Array(8).fill(null).map(() => ({ pieces: [] }))
  );
}

// Callbacks setters
export function setGameCallbacks(callbacks: {
  onGameCreated?: (gameCode: string) => void;
  onGameJoined?: (state: OnlineGameState) => void;
  onGameStarted?: (state: OnlineGameState) => void;
  onMoveMade?: (state: OnlineGameState) => void;
  onTimerUpdate?: (white: number, black: number) => void;
  onGameOver?: (result: OnlineGameState['result']) => void;
  onError?: (message: string) => void;
}): void {
  if (callbacks.onGameCreated) onGameCreated = callbacks.onGameCreated;
  if (callbacks.onGameJoined) onGameJoined = callbacks.onGameJoined;
  if (callbacks.onGameStarted) onGameStarted = callbacks.onGameStarted;
  if (callbacks.onMoveMade) onMoveMade = callbacks.onMoveMade;
  if (callbacks.onTimerUpdate) onTimerUpdate = callbacks.onTimerUpdate;
  if (callbacks.onGameOver) onGameOver = callbacks.onGameOver;
  if (callbacks.onError) onError = callbacks.onError;
}

// Game actions
export function createGame(timeControl: TimeControl = 'standard', customSettings?: TimeControlSettings): void {
  const socket = getSocket();
  socket?.emit('game:create', { timeControl, customSettings });
}

export function joinGame(gameCode: string): void {
  const socket = getSocket();
  socket?.emit('game:join', { gameCode: gameCode.toUpperCase() });
}

export function sendMove(
  from: { row: number; col: number },
  to: { row: number; col: number },
  moveType: MoveType,
  unklikIndex?: number,
  promoteTo?: Piece
): void {
  if (!gameState) return;

  const socket = getSocket();
  socket?.emit('game:move', {
    gameId: gameState.gameId,
    from,
    to,
    moveType,
    unklikIndex,
    promoteTo,
  });
}

export function resign(): void {
  if (!gameState) return;

  const socket = getSocket();
  socket?.emit('game:resign', { gameId: gameState.gameId });
}

export function reconnectToGame(gameId: string): void {
  const socket = getSocket();
  socket?.emit('game:get-state', { gameId });
}

// State getters
export function getOnlineGameState(): OnlineGameState | null {
  return gameState;
}

export function isOnline(): boolean {
  return isOnlineMode;
}

export function isMyTurn(): boolean {
  return gameState !== null && gameState.currentTurn === gameState.myColor;
}

export function getMyColor(): PieceColor | null {
  return gameState?.myColor || null;
}

export function leaveOnlineGame(): void {
  gameState = null;
  isOnlineMode = false;
}
