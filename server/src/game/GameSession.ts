import type {
  Board,
  Piece,
  PieceColor,
  MoveType,
  GameCastlingRights,
  EnPassantTarget,
  MoveHistoryEntry,
  GameMove,
  GameResult,
  Player,
  ValidMove,
} from './types.js';
import { isWhitePiece, isPawn, getPieceType, coordToNotation, piecesToSymbols, PIECE_SYMBOLS } from './constants.js';
import { getCombinedMoves, getPieceMoves, wouldBeInCheck, isInCheck, hasLegalMoves } from './moves.js';
import { GameTimer, TimeControl } from './Timer.js';

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class GameSession {
  readonly id: string;
  readonly gameCode: string;
  readonly timeControl: TimeControl;

  private board: Board;
  private currentTurn: PieceColor = 'white';
  private castlingRights: GameCastlingRights;
  private enPassantTarget: EnPassantTarget | null = null;
  private movedPawns: Set<Piece> = new Set();
  private moveHistory: MoveHistoryEntry[] = [];

  private whitePlayer: Player | null = null;
  private blackPlayer: Player | null = null;

  private timer: GameTimer;
  private gameStarted: boolean = false;
  private gameOver: boolean = false;
  private result: GameResult | null = null;

  private onTimerTick: ((white: number, black: number) => void) | null = null;
  private onGameEnd: ((result: GameResult) => void) | null = null;

  constructor(id: string, timeControl: TimeControl = 'standard') {
    this.id = id;
    this.gameCode = generateGameCode();
    this.timeControl = timeControl;
    this.board = this.createInitialBoard();
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    };
    this.timer = new GameTimer(timeControl);

    this.timer.setCallbacks(
      (color) => this.handleTimeout(color),
      (state) => this.onTimerTick?.(state.white, state.black)
    );
  }

  private createInitialBoard(): Board {
    const board: Board = Array(8).fill(null).map(() =>
      Array(8).fill(null).map(() => ({ pieces: [] }))
    );

    // White pieces
    board[7][0].pieces = ['R'];
    board[7][1].pieces = ['N'];
    board[7][2].pieces = ['B'];
    board[7][3].pieces = ['Q'];
    board[7][4].pieces = ['K'];
    board[7][5].pieces = ['B'];
    board[7][6].pieces = ['N'];
    board[7][7].pieces = ['R'];

    // White pawns
    for (let i = 0; i < 8; i++) {
      board[6][i].pieces = [`P${i}` as Piece];
    }

    // Black pieces
    board[0][0].pieces = ['r'];
    board[0][1].pieces = ['n'];
    board[0][2].pieces = ['b'];
    board[0][3].pieces = ['q'];
    board[0][4].pieces = ['k'];
    board[0][5].pieces = ['b'];
    board[0][6].pieces = ['n'];
    board[0][7].pieces = ['r'];

    // Black pawns
    for (let i = 0; i < 8; i++) {
      board[1][i].pieces = [`p${i}` as Piece];
    }

    return board;
  }

  setCallbacks(
    onTimerTick: (white: number, black: number) => void,
    onGameEnd: (result: GameResult) => void
  ): void {
    this.onTimerTick = onTimerTick;
    this.onGameEnd = onGameEnd;
  }

  // Player management
  addPlayer(player: Player): 'white' | 'black' | null {
    if (!this.whitePlayer) {
      this.whitePlayer = player;
      return 'white';
    } else if (!this.blackPlayer) {
      this.blackPlayer = player;
      return 'black';
    }
    return null;
  }

  removePlayer(playerId: string): void {
    if (this.whitePlayer?.id === playerId) {
      this.whitePlayer = null;
    } else if (this.blackPlayer?.id === playerId) {
      this.blackPlayer = null;
    }

    // If game was in progress, end it
    if (this.gameStarted && !this.gameOver) {
      const winner = this.whitePlayer ? 'white' : (this.blackPlayer ? 'black' : null);
      this.endGame({ type: 'disconnect', winner });
    }
  }

  getPlayer(color: PieceColor): Player | null {
    return color === 'white' ? this.whitePlayer : this.blackPlayer;
  }

  getPlayerColor(playerId: string): PieceColor | null {
    if (this.whitePlayer?.id === playerId) return 'white';
    if (this.blackPlayer?.id === playerId) return 'black';
    return null;
  }

  isFull(): boolean {
    return this.whitePlayer !== null && this.blackPlayer !== null;
  }

  // Game flow
  startGame(): boolean {
    if (!this.isFull() || this.gameStarted) return false;

    this.gameStarted = true;
    this.timer.start('white');
    return true;
  }

  isStarted(): boolean {
    return this.gameStarted;
  }

  isOver(): boolean {
    return this.gameOver;
  }

  getResult(): GameResult | null {
    return this.result;
  }

  // Move validation and execution
  validateMove(playerId: string, move: GameMove): { valid: boolean; error?: string } {
    // Check if it's player's turn
    const playerColor = this.getPlayerColor(playerId);
    if (!playerColor) {
      return { valid: false, error: 'Player not in game' };
    }
    if (playerColor !== this.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }
    if (this.gameOver) {
      return { valid: false, error: 'Game is over' };
    }
    if (!this.gameStarted) {
      return { valid: false, error: 'Game has not started' };
    }

    const { from, to, moveType, unklikIndex } = move;
    const fromSquare = this.board[from.row][from.col];

    // Check if there are pieces on the from square
    if (fromSquare.pieces.length === 0) {
      return { valid: false, error: 'No pieces on source square' };
    }

    // Check if pieces belong to current player
    const isWhite = isWhitePiece(fromSquare.pieces[0]);
    if ((isWhite && this.currentTurn !== 'white') || (!isWhite && this.currentTurn !== 'black')) {
      return { valid: false, error: 'Not your pieces' };
    }

    // Get valid moves for the square
    let validMoves: ValidMove[];

    if (moveType === 'unklik' || moveType === 'unklik-klik' || moveType === 'en-passant-unklik') {
      // Unklik move - get moves for individual piece
      if (unklikIndex === undefined || unklikIndex < 0 || unklikIndex >= fromSquare.pieces.length) {
        return { valid: false, error: 'Invalid unklik index' };
      }
      const piece = fromSquare.pieces[unklikIndex];
      const singleMoves = getPieceMoves(
        this.board, from.row, from.col, piece,
        this.castlingRights, this.enPassantTarget, this.movedPawns
      );

      validMoves = [];
      for (const [r, c, mt] of singleMoves) {
        const targetSq = this.board[r][c];
        if (mt === 'en-passant') {
          validMoves.push({ row: r, col: c, type: 'en-passant-unklik' });
        } else if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
          validMoves.push({ row: r, col: c, type: 'unklik' });
        } else if (targetSq.pieces.length < 2 &&
                   isWhitePiece(targetSq.pieces[0]) === isWhite &&
                   !targetSq.pieces.some(p => getPieceType(p) === 'k')) {
          validMoves.push({ row: r, col: c, type: 'unklik-klik' });
        }
      }

      // Filter for check
      validMoves = validMoves.filter(m =>
        !wouldBeInCheck(this.board, from.row, from.col, m.row, m.col, fromSquare.pieces, m.type, unklikIndex)
      );
    } else {
      validMoves = getCombinedMoves(
        this.board, from.row, from.col, fromSquare.pieces,
        this.castlingRights, this.enPassantTarget, this.movedPawns, null
      );
    }

    // Check if the move is in valid moves
    const isValid = validMoves.some(m =>
      m.row === to.row && m.col === to.col &&
      (m.type === moveType ||
       // Handle choice types
       (m.type === 'en-passant-choice' && (moveType === 'en-passant' || moveType === 'normal')) ||
       (m.type === 'castle-k-choice' && (moveType === 'castle-k' || moveType === 'castle-k-both')) ||
       (m.type === 'castle-q-choice' && (moveType === 'castle-q' || moveType === 'castle-q-both')))
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid move' };
    }

    return { valid: true };
  }

  executeMove(move: GameMove): { success: boolean; notation?: string; error?: string } {
    const validation = this.validateMove(move.pieces[0] ?
      (isWhitePiece(move.pieces[0]) ? this.whitePlayer?.id : this.blackPlayer?.id) || '' : '',
      move
    );

    // For internal execution, we bypass player check
    const { from, to, moveType, unklikIndex, promoteTo } = move;
    const fromSquare = this.board[from.row][from.col];
    const toSquare = this.board[to.row][to.col];
    const pieces = [...fromSquare.pieces];

    let notation = '';
    this.enPassantTarget = null;

    const fromNotation = coordToNotation(from.row, from.col);
    const toNotation = coordToNotation(to.row, to.col);
    const isWhite = isWhitePiece(pieces[0]);

    // Execute the move based on type
    if (moveType?.startsWith('castle-')) {
      notation = this.executeCastling(from.row, from.col, to.row, to.col, moveType);
    } else if (moveType === 'en-passant' || moveType === 'en-passant-unklik') {
      notation = this.executeEnPassant(from, to, pieces, moveType, unklikIndex);
    } else if (moveType === 'unklik' || moveType === 'unklik-klik') {
      notation = this.executeUnklik(from, to, pieces, moveType, unklikIndex!, promoteTo);
    } else {
      notation = this.executeNormalMove(from, to, pieces, moveType, promoteTo);
    }

    // Update castling rights
    this.updateCastlingRights(from.row, from.col, to.row, to.col, pieces);

    // Track moved pawns
    for (const piece of pieces) {
      if (isPawn(piece)) {
        this.movedPawns.add(piece);
      }
    }

    // Switch turn and timer
    this.moveHistory.push({ turn: this.currentTurn, notation });
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    this.timer.switchTurn();

    // Check for game end
    this.checkGameEnd();

    return { success: true, notation };
  }

  private executeCastling(fromRow: number, fromCol: number, toRow: number, toCol: number, castleType: MoveType): string {
    const isKingSide = castleType.startsWith('castle-k');
    const rookCol = isKingSide ? 7 : 0;
    const newRookCol = isKingSide ? 5 : 3;

    const kingPieces = [...this.board[fromRow][fromCol].pieces];
    this.board[toRow][toCol].pieces = kingPieces;
    this.board[fromRow][fromCol].pieces = [];

    const rookSquare = [...this.board[fromRow][rookCol].pieces];
    this.board[fromRow][rookCol].pieces = [];

    let notation = `O-O${isKingSide ? '' : '-O'}`;

    if (castleType.includes('unklik-klik')) {
      const rook = rookSquare.find(p => getPieceType(p) === 'r')!;
      const otherPiece = rookSquare.find(p => getPieceType(p) !== 'r')!;
      const pieceOnTarget = [...this.board[fromRow][newRookCol].pieces];
      this.board[fromRow][newRookCol].pieces = [rook, ...pieceOnTarget];
      this.board[fromRow][rookCol].pieces = [otherPiece];
      notation += ' (rook klikt)';
    } else if (castleType.includes('klik') && !castleType.includes('unklik')) {
      const pieceOnSquare = [...this.board[fromRow][newRookCol].pieces];
      this.board[fromRow][newRookCol].pieces = [...rookSquare, ...pieceOnSquare];
      notation += ' klikt';
    } else if (castleType.includes('both')) {
      this.board[fromRow][newRookCol].pieces = rookSquare;
      notation += ' (beide)';
    } else {
      if (rookSquare.length === 2) {
        const rook = rookSquare.find(p => getPieceType(p) === 'r')!;
        const otherPiece = rookSquare.find(p => getPieceType(p) !== 'r')!;
        this.board[fromRow][newRookCol].pieces = [rook];
        this.board[fromRow][rookCol].pieces = [otherPiece];
        notation += ' (alleen toren)';
      } else {
        this.board[fromRow][newRookCol].pieces = rookSquare;
      }
    }

    // Disable castling for this color
    const color = this.currentTurn;
    this.castlingRights[color] = { kingSide: false, queenSide: false };

    return notation;
  }

  private executeEnPassant(
    from: { row: number; col: number },
    to: { row: number; col: number },
    pieces: Piece[],
    moveType: MoveType,
    unklikIndex?: number
  ): string {
    const isWhite = isWhitePiece(pieces[0]);
    const captureRow = isWhite ? to.row + 1 : to.row - 1;

    this.board[captureRow][to.col].pieces = [];

    if (moveType === 'en-passant-unklik' && unklikIndex !== undefined) {
      const movingPiece = pieces[unklikIndex];
      this.board[to.row][to.col].pieces = [movingPiece];
      this.board[from.row][from.col].pieces = pieces.filter((_, i) => i !== unklikIndex);
      return `${PIECE_SYMBOLS[movingPiece]}${coordToNotation(from.row, from.col)}x${coordToNotation(captureRow, to.col)} e.p.`;
    } else {
      this.board[from.row][from.col].pieces = [];
      this.board[to.row][to.col].pieces = pieces;
      return `${piecesToSymbols(pieces)}${coordToNotation(from.row, from.col)}x${coordToNotation(captureRow, to.col)} e.p.`;
    }
  }

  private executeUnklik(
    from: { row: number; col: number },
    to: { row: number; col: number },
    pieces: Piece[],
    moveType: MoveType,
    unklikIndex: number,
    promoteTo?: Piece
  ): string {
    const movingPiece = pieces[unklikIndex];
    const otherPieces = pieces.filter((_, i) => i !== unklikIndex);
    const toSquare = this.board[to.row][to.col];
    const isWhite = isWhitePiece(movingPiece);
    const isCapture = toSquare.pieces.length > 0 && isWhitePiece(toSquare.pieces[0]) !== isWhite;

    this.board[from.row][from.col].pieces = otherPieces;

    let notation = `${PIECE_SYMBOLS[movingPiece]}${coordToNotation(from.row, from.col)}`;

    // Check for promotion
    const isPromotionRank = (isWhite && to.row === 0) || (!isWhite && to.row === 7);

    if (moveType === 'unklik-klik') {
      this.board[to.row][to.col].pieces = [...toSquare.pieces, movingPiece];
      notation += `-${coordToNotation(to.row, to.col)} klikt`;
    } else {
      if (isCapture) {
        notation += `x${coordToNotation(to.row, to.col)}`;
      } else {
        notation += `-${coordToNotation(to.row, to.col)}`;
      }
      this.board[to.row][to.col].pieces = [movingPiece];
    }

    // Handle promotion
    if (isPawn(movingPiece) && isPromotionRank && promoteTo) {
      const currentPieces = this.board[to.row][to.col].pieces;
      const newPieces = currentPieces.filter(p => !isPawn(p));
      newPieces.unshift(promoteTo);
      this.board[to.row][to.col].pieces = newPieces;
      notation += `=${PIECE_SYMBOLS[promoteTo]}`;
    }

    return notation;
  }

  private executeNormalMove(
    from: { row: number; col: number },
    to: { row: number; col: number },
    pieces: Piece[],
    moveType: MoveType | undefined,
    promoteTo?: Piece
  ): string {
    const toSquare = this.board[to.row][to.col];
    const isWhite = isWhitePiece(pieces[0]);
    const isCapture = toSquare.pieces.length > 0 && isWhitePiece(toSquare.pieces[0]) !== isWhite;

    this.board[from.row][from.col].pieces = [];

    let notation = `${piecesToSymbols(pieces)}${coordToNotation(from.row, from.col)}`;

    // Check for promotion
    const hasPawn = pieces.some(p => isPawn(p));
    const isPromotionRank = (isWhite && to.row === 0) || (!isWhite && to.row === 7);

    if (moveType === 'klik') {
      this.board[to.row][to.col].pieces = [...toSquare.pieces, ...pieces];
      notation += `-${coordToNotation(to.row, to.col)} klikt`;
    } else {
      if (isCapture) {
        notation += `x${coordToNotation(to.row, to.col)}`;
      } else {
        notation += `-${coordToNotation(to.row, to.col)}`;
      }
      this.board[to.row][to.col].pieces = pieces;
    }

    // Handle promotion
    if (hasPawn && isPromotionRank && promoteTo) {
      const currentPieces = this.board[to.row][to.col].pieces;
      const newPieces = currentPieces.filter(p => !isPawn(p));
      newPieces.unshift(promoteTo);
      this.board[to.row][to.col].pieces = newPieces;
      notation += `=${PIECE_SYMBOLS[promoteTo]}`;
    }

    // Set en passant target for double pawn move
    const isStraightMove = from.col === to.col;
    const isFromStartRank = (isWhite && from.row === 6) || (!isWhite && from.row === 1);
    if (hasPawn && isStraightMove && isFromStartRank && !isCapture && Math.abs(from.row - to.row) === 2) {
      const enPassantRow = (from.row + to.row) / 2;
      this.enPassantTarget = { row: enPassantRow, col: to.col };
    }

    // Disable castling if king moves
    if (pieces.includes('K')) {
      this.castlingRights.white = { kingSide: false, queenSide: false };
    } else if (pieces.includes('k')) {
      this.castlingRights.black = { kingSide: false, queenSide: false };
    }

    return notation;
  }

  private updateCastlingRights(fromRow: number, fromCol: number, toRow: number, toCol: number, pieces: Piece[]): void {
    // Rook captured or moved
    if ((toRow === 7 && toCol === 0) || (fromRow === 7 && fromCol === 0)) {
      this.castlingRights.white.queenSide = false;
    }
    if ((toRow === 7 && toCol === 7) || (fromRow === 7 && fromCol === 7)) {
      this.castlingRights.white.kingSide = false;
    }
    if ((toRow === 0 && toCol === 0) || (fromRow === 0 && fromCol === 0)) {
      this.castlingRights.black.queenSide = false;
    }
    if ((toRow === 0 && toCol === 7) || (fromRow === 0 && fromCol === 7)) {
      this.castlingRights.black.kingSide = false;
    }
  }

  private checkGameEnd(): void {
    const inCheck = isInCheck(this.board, this.currentTurn);
    const hasLegal = hasLegalMoves(
      this.board, this.currentTurn,
      this.castlingRights, this.enPassantTarget, this.movedPawns
    );

    if (!hasLegal) {
      if (inCheck) {
        this.endGame({
          type: 'checkmate',
          winner: this.currentTurn === 'white' ? 'black' : 'white'
        });
      } else {
        this.endGame({ type: 'stalemate', winner: null });
      }
    }
  }

  private handleTimeout(color: PieceColor): void {
    this.endGame({
      type: 'timeout',
      winner: color === 'white' ? 'black' : 'white'
    });
  }

  resign(playerId: string): void {
    const color = this.getPlayerColor(playerId);
    if (!color || this.gameOver) return;

    this.endGame({
      type: 'resignation',
      winner: color === 'white' ? 'black' : 'white'
    });
  }

  private endGame(result: GameResult): void {
    this.gameOver = true;
    this.result = result;
    this.timer.stop();
    this.onGameEnd?.(result);
  }

  // Getters for state
  getBoard(): Board {
    return this.board.map(row => row.map(sq => ({ pieces: [...sq.pieces] })));
  }

  getCurrentTurn(): PieceColor {
    return this.currentTurn;
  }

  getTimerState() {
    return this.timer.getTime();
  }

  getMoveHistory(): MoveHistoryEntry[] {
    return [...this.moveHistory];
  }

  getEnPassantTarget(): EnPassantTarget | null {
    return this.enPassantTarget;
  }

  getCastlingRights(): GameCastlingRights {
    return JSON.parse(JSON.stringify(this.castlingRights));
  }

  getMovedPawns(): Piece[] {
    return Array.from(this.movedPawns);
  }

  // For reconnection
  getFullState() {
    return {
      id: this.id,
      gameCode: this.gameCode,
      board: this.getBoard(),
      currentTurn: this.currentTurn,
      castlingRights: this.getCastlingRights(),
      enPassantTarget: this.enPassantTarget,
      movedPawns: this.getMovedPawns(),
      moveHistory: this.getMoveHistory(),
      timer: this.getTimerState(),
      whitePlayer: this.whitePlayer ? { username: this.whitePlayer.username } : null,
      blackPlayer: this.blackPlayer ? { username: this.blackPlayer.username } : null,
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      result: this.result,
    };
  }
}
