import type { Piece, MoveType, ValidMove, PendingPromotion } from './types';
import {
  isWhitePiece,
  isPawn,
  getPieceType,
  coordToNotation,
  piecesToSymbols,
  PIECE_SYMBOLS,
} from './constants';
import * as state from './state';
import { getCombinedMoves, getPieceMoves, wouldBeInCheck, isInCheck, hasLegalMoves } from './moves';
import { renderBoard, updateUI, showCheckIndicator, showGameOver, showPromotionDialog, showCastlingChoiceDialog, showEnPassantChoiceDialog } from '../ui/render';
import { isOnline, isMyTurn, sendMove, getMyColor } from '../multiplayer/onlineGame';
import { isAnalysisMode, addAnalysisMove } from '../analysis/analysisMode.js';
import { updateAnalysisUI } from '../ui/analysisUI.js';
import { hasPremove, setPremove, clearPremove, getPremove } from '../multiplayer/premove.js';
import { isEngineGame, isEngineTurn, requestEngineMove } from './engineGame.js';

export function handleSquareClick(row: number, col: number): void {
  if (state.isGameOver() && !isAnalysisMode()) return;

  // Block clicks during engine's turn
  if (isEngineGame() && isEngineTurn()) return;

  // In online mode (but not analysis mode), handle premoves when not your turn
  if (isOnline() && !isMyTurn() && !isAnalysisMode()) {
    const board = state.getBoard();
    const square = board[row][col];
    const myColor = getMyColor();
    const selectedSquare = state.getSelectedSquare();

    // If we have a selected square and click on a valid move, set premove
    if (selectedSquare) {
      const validMoves = state.getValidMoves();
      const move = validMoves.find(m => m.row === row && m.col === col);

      if (move) {
        // Set premove
        const [selRow, selCol] = selectedSquare;
        const unklikIndex = state.getSelectedUnklikPiece();

        // Clear any existing premove and set new one
        setPremove(
          { row: selRow, col: selCol },
          { row, col },
          move.type,
          unklikIndex !== null ? unklikIndex : undefined
        );

        state.clearSelection();
        renderBoard();
        updateUI();
        return;
      }
    }

    // Clicking elsewhere clears premove and tries to select a piece
    if (hasPremove()) {
      clearPremove();
    }

    // Select own pieces to see valid moves (for premove planning)
    if (square.pieces.length > 0 && isWhitePiece(square.pieces[0]) === (myColor === 'white')) {
      state.setSelectedSquare([row, col]);
      state.setSelectedUnklikPiece(null);
      const moves = getCombinedMoves(
        board, row, col, square.pieces,
        state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns(), null
      );
      state.setValidMoves(moves);
    } else {
      state.clearSelection();
    }

    renderBoard();
    updateUI();
    return;
  }

  const board = state.getBoard();
  const square = board[row][col];
  const selectedSquare = state.getSelectedSquare();

  if (selectedSquare) {
    const [selRow, selCol] = selectedSquare;
    const validMoves = state.getValidMoves();
    const move = validMoves.find(m => m.row === row && m.col === col);

    if (move) {
      const moveType = move.type;
      if (moveType === 'castle-k' || moveType === 'castle-q' ||
          moveType === 'castle-k-klik' || moveType === 'castle-q-klik' ||
          moveType === 'castle-k-unklik-klik' || moveType === 'castle-q-unklik-klik') {
        executeCastling(selRow, selCol, row, col, moveType);
      } else if (moveType === 'castle-k-choice' || moveType === 'castle-q-choice') {
        showCastlingChoiceDialog(selRow, selCol, row, col, moveType);
      } else if (moveType === 'en-passant-choice') {
        showEnPassantChoiceDialog(selRow, selCol, row, col);
      } else {
        movePiece(selRow, selCol, row, col, moveType);
      }
    } else {
      // Try to select a new piece
      if (square.pieces.length > 0 && isWhitePiece(square.pieces[0]) === (state.getCurrentTurn() === 'white')) {
        state.setSelectedSquare([row, col]);
        state.setSelectedUnklikPiece(null);
        const moves = getCombinedMoves(
          board, row, col, square.pieces,
          state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns(), null
        );
        state.setValidMoves(moves);
      } else {
        state.clearSelection();
      }
    }
  } else if (square.pieces.length > 0) {
    const isWhite = isWhitePiece(square.pieces[0]);
    if ((isWhite && state.getCurrentTurn() === 'white') || (!isWhite && state.getCurrentTurn() === 'black')) {
      state.setSelectedSquare([row, col]);
      state.setSelectedUnklikPiece(null);
      const moves = getCombinedMoves(
        board, row, col, square.pieces,
        state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns(), null
      );
      state.setValidMoves(moves);
    }
  }

  renderBoard();
  updateUI();
}

export function handleUnklikSelect(row: number, col: number, pieceIndex: number, e: Event): void {
  if (state.isGameOver() && !isAnalysisMode()) return;
  e.stopPropagation();

  // Block during engine's turn
  if (isEngineGame() && isEngineTurn()) return;

  // In online mode (but not analysis mode), only allow on your turn
  if (isOnline() && !isMyTurn() && !isAnalysisMode()) return;

  const board = state.getBoard();
  const square = board[row][col];
  const selectedPiece = square.pieces[pieceIndex];
  const isWhite = isWhitePiece(selectedPiece);

  if ((isWhite && state.getCurrentTurn() !== 'white') || (!isWhite && state.getCurrentTurn() !== 'black')) return;

  state.setSelectedSquare([row, col]);
  state.setSelectedUnklikPiece(pieceIndex);

  // King can only do regular unklik moves
  if (getPieceType(selectedPiece) === 'k') {
    const kingMoves = getPieceMoves(board, row, col, selectedPiece, state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns());
    const validMoves: ValidMove[] = kingMoves
      .map(m => ({ row: m[0], col: m[1], type: 'unklik' as MoveType }))
      .filter(move => !wouldBeInCheck(board, row, col, move.row, move.col, square.pieces, 'unklik', pieceIndex));
    state.setValidMoves(validMoves);
    renderBoard();
    updateUI();
    return;
  }

  const singleMoves = getPieceMoves(board, row, col, selectedPiece, state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns());
  const movesKlik: ValidMove[] = [];
  const isPawnPiece = isPawn(selectedPiece);

  for (const move of singleMoves) {
    const [r, c, moveType] = move;
    const targetSq = board[r][c];

    // Rule: Pawn can never go to own back rank
    const isOwnBackRank = (isWhite && r === 7) || (!isWhite && r === 0);
    if (isPawnPiece && isOwnBackRank) {
      continue;
    }

    if (moveType === 'en-passant') {
      movesKlik.push({ row: r, col: c, type: 'en-passant-unklik' });
    } else if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
      movesKlik.push({ row: r, col: c, type: 'unklik' });
    } else if (targetSq.pieces.length < 2 &&
               isWhitePiece(targetSq.pieces[0]) === isWhite &&
               !targetSq.pieces.some(p => getPieceType(p) === 'k')) {
      movesKlik.push({ row: r, col: c, type: 'unklik-klik' });
    }
  }

  const validMoves = movesKlik.filter(move =>
    !wouldBeInCheck(board, row, col, move.row, move.col, square.pieces, move.type, pieceIndex)
  );
  state.setValidMoves(validMoves);

  renderBoard();
  updateUI();
}

export function executeCastling(fromRow: number, fromCol: number, toRow: number, toCol: number, castleType: MoveType): void {
  // In online mode (but not analysis mode), send move to server
  if (isOnline() && !isAnalysisMode()) {
    sendMove(
      { row: fromRow, col: fromCol },
      { row: toRow, col: toCol },
      castleType
    );
    state.clearSelection();
    renderBoard();
    updateUI();
    return;
  }

  const board = state.getBoard();
  const isKingSide = castleType.startsWith('castle-k');
  const rookCol = isKingSide ? 7 : 0;
  const newRookCol = isKingSide ? 5 : 3;

  // Move king
  const kingPieces = board[fromRow][fromCol].pieces;
  state.setBoardSquare(toRow, toCol, kingPieces);
  state.setBoardSquare(fromRow, fromCol, []);

  // Get rook
  const rookSquare = [...board[fromRow][rookCol].pieces];
  state.setBoardSquare(fromRow, rookCol, []);

  let notation = `O-O${isKingSide ? '' : '-O'}`;

  if (castleType.includes('unklik-klik')) {
    const toren = rookSquare.find(p => getPieceType(p) === 'r')!;
    const otherPiece = rookSquare.find(p => getPieceType(p) !== 'r')!;
    const pieceOnTarget = [...board[fromRow][newRookCol].pieces];
    state.setBoardSquare(fromRow, newRookCol, [toren, ...pieceOnTarget]);
    state.setBoardSquare(fromRow, rookCol, [otherPiece]);
    notation += ' (toren klikt)';
  } else if (castleType.includes('klik') && !castleType.includes('unklik')) {
    const pieceOnSquare = [...board[fromRow][newRookCol].pieces];
    state.setBoardSquare(fromRow, newRookCol, [...rookSquare, ...pieceOnSquare]);
    notation += ' klikt';
  } else if (castleType.includes('both')) {
    state.setBoardSquare(fromRow, newRookCol, rookSquare);
    notation += ' (beide)';
  } else {
    if (rookSquare.length === 2) {
      const toren = rookSquare.find(p => getPieceType(p) === 'r')!;
      const otherPiece = rookSquare.find(p => getPieceType(p) !== 'r')!;
      state.setBoardSquare(fromRow, newRookCol, [toren]);
      state.setBoardSquare(fromRow, rookCol, [otherPiece]);
      notation += ' (alleen toren)';
    } else {
      state.setBoardSquare(fromRow, newRookCol, rookSquare);
    }
  }

  state.disableCastling(state.getCurrentTurn());
  state.clearSelection();
  const turn = state.getCurrentTurn();
  state.switchTurn();
  state.addMoveToHistory({ turn, notation });

  // If in analysis mode, also record the move there
  if (isAnalysisMode()) {
    addAnalysisMove({ turn, notation });
    renderBoard();
    updateUI();
    checkForCheckmate();
    updateAnalysisUI();
    return;
  }

  renderBoard();
  updateUI();
  checkForCheckmate();

  // Trigger engine move if it's the engine's turn
  if (isEngineGame() && isEngineTurn() && !state.isGameOver()) {
    setTimeout(() => requestEngineMove(), 100);
  }
}

export function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, moveType: MoveType, promoteTo?: Piece): void {
  // In online mode (but not analysis mode), send move to server (except for promotion which needs piece selection)
  if (isOnline() && !isAnalysisMode()) {
    const selectedUnklikPiece = state.getSelectedUnklikPiece();
    const board = state.getBoard();
    const fromSq = board[fromRow][fromCol];
    const hasPawn = fromSq.pieces.some(p => isPawn(p));
    const isWhite = isWhitePiece(fromSq.pieces[0]);
    const isPromotionRank = (isWhite && toRow === 0) || (!isWhite && toRow === 7);

    // Check if this is a promotion move that needs piece selection
    if (hasPawn && isPromotionRank && !promoteTo && !state.isAutoPromoteEnabled()) {
      // Store pending promotion state for online
      const promotion: PendingPromotion = {
        row: toRow,
        col: toCol,
        isWhite,
        moveNotation: '',
      };
      // Store move info for later
      (promotion as any).fromRow = fromRow;
      (promotion as any).fromCol = fromCol;
      (promotion as any).moveType = moveType;
      (promotion as any).unklikIndex = selectedUnklikPiece;
      state.setPendingPromotion(promotion);
      showPromotionDialog();
      return;
    }

    const promoTo = promoteTo || (state.isAutoPromoteEnabled() && hasPawn && isPromotionRank
      ? (isWhite ? 'Q' : 'q') as Piece
      : undefined);

    sendMove(
      { row: fromRow, col: fromCol },
      { row: toRow, col: toCol },
      moveType,
      selectedUnklikPiece !== null ? selectedUnklikPiece : undefined,
      promoTo
    );
    state.clearSelection();
    renderBoard();
    updateUI();
    return;
  }

  const board = state.getBoard();
  const fromSq = board[fromRow][fromCol];
  const toSq = board[toRow][toCol];
  let piecesToMove: Piece[];
  let moveNotation = '';
  state.setEnPassantTarget(null);

  const isCapture = toSq.pieces.length > 0;
  const fromNotation = coordToNotation(fromRow, fromCol);
  const toNotation = coordToNotation(toRow, toCol);
  const selectedUnklikPiece = state.getSelectedUnklikPiece();

  if (moveType === 'unklik' || moveType === 'unklik-klik' || moveType === 'en-passant-unklik') {
    // UNKLIK: separate one piece from stacked pieces
    const movingPiece = fromSq.pieces[selectedUnklikPiece!];
    const otherPieces = fromSq.pieces.filter((_, i) => i !== selectedUnklikPiece);
    piecesToMove = [movingPiece];
    state.setBoardSquare(fromRow, fromCol, otherPieces);
    moveNotation = `${PIECE_SYMBOLS[movingPiece]}${fromNotation}-${toNotation}`;

    // EN PASSANT UNKLIK
    if (moveType === 'en-passant-unklik') {
      const captureRow = state.getCurrentTurn() === 'white' ? toRow + 1 : toRow - 1;
      state.setBoardSquare(captureRow, toCol, []);
      state.setBoardSquare(toRow, toCol, [movingPiece]);
      moveNotation += ` x${coordToNotation(captureRow, toCol)} e.p.`;

      state.updateCastlingRights(fromRow, fromCol, toRow, toCol, piecesToMove);
      finishMove(moveNotation);
      return;
    }

    const isPawnMove = isPawn(movingPiece);
    const isPromotionRank = (isWhitePiece(movingPiece) && toRow === 0) || (!isWhitePiece(movingPiece) && toRow === 7);

    // PROMOTION ON UNKLIK
    if (isPawnMove && isPromotionRank) {
      if (moveType === 'unklik-klik') {
        state.setBoardSquare(toRow, toCol, [...toSq.pieces, movingPiece]);
        moveNotation += ' klikt';
      } else if (toSq.pieces.length > 0) {
        state.setBoardSquare(toRow, toCol, [movingPiece]);
        moveNotation += ' x';
      } else {
        state.setBoardSquare(toRow, toCol, [movingPiece]);
      }

      const resolvedPromo = promoteTo || (state.isAutoPromoteEnabled()
        ? (isWhitePiece(movingPiece) ? 'Q' : 'q') as Piece
        : null);
      if (resolvedPromo) {
        const currentPieces = state.getBoardSquare(toRow, toCol);
        const newPieces = currentPieces.filter(p => !isPawn(p));
        newPieces.unshift(resolvedPromo);
        state.setBoardSquare(toRow, toCol, newPieces);
        moveNotation += '=' + PIECE_SYMBOLS[resolvedPromo];

        state.updateCastlingRights(fromRow, fromCol, toRow, toCol, newPieces);
        finishMove(moveNotation);
      } else {
        const promotion: PendingPromotion = {
          row: toRow,
          col: toCol,
          isWhite: isWhitePiece(movingPiece),
          moveNotation,
          wasCapture: toSq.pieces.length > 1 || (moveType !== 'unklik-klik' && toSq.pieces.length > 0)
        };
        state.setPendingPromotion(promotion);
        showPromotionDialog();
      }
      return;
    }

    // Normal unklik (no promotion)
    if (moveType === 'unklik-klik') {
      state.setBoardSquare(toRow, toCol, [...toSq.pieces, movingPiece]);
      moveNotation += ' klikt';
    } else {
      if (toSq.pieces.length > 0) moveNotation = `${PIECE_SYMBOLS[movingPiece]}${fromNotation}x${toNotation}`;
      state.setBoardSquare(toRow, toCol, [movingPiece]);
    }

    state.updateCastlingRights(fromRow, fromCol, toRow, toCol, piecesToMove);

  } else if (moveType === 'en-passant') {
    piecesToMove = [...fromSq.pieces];
    state.setBoardSquare(fromRow, fromCol, []);
    const captureRow = state.getCurrentTurn() === 'white' ? toRow + 1 : toRow - 1;
    state.setBoardSquare(captureRow, toCol, []);
    state.setBoardSquare(toRow, toCol, piecesToMove);
    moveNotation = `${piecesToSymbols(piecesToMove)}${fromNotation}x${coordToNotation(captureRow, toCol)} e.p.`;

  } else {
    // NORMAL MOVE OR KLIK
    piecesToMove = [...fromSq.pieces];
    state.setBoardSquare(fromRow, fromCol, []);
    moveNotation = `${piecesToSymbols(piecesToMove)}${fromNotation}-${toNotation}`;

    const isPawnInStack = piecesToMove.some(p => isPawn(p));
    const isPromotionRank = (isWhitePiece(piecesToMove[0]) && toRow === 0) || (!isWhitePiece(piecesToMove[0]) && toRow === 7);

    // PROMOTION WITH STACKED PIECES
    if (isPawnInStack && isPromotionRank) {
      if (moveType === 'klik') {
        state.setBoardSquare(toRow, toCol, [...toSq.pieces, ...piecesToMove]);
        moveNotation += ' klikt';
      } else {
        if (toSq.pieces.length > 0) moveNotation += ' x';
        state.setBoardSquare(toRow, toCol, piecesToMove);
      }

      const resolvedPromo2 = promoteTo || (state.isAutoPromoteEnabled()
        ? (isWhitePiece(piecesToMove[0]) ? 'Q' : 'q') as Piece
        : null);
      if (resolvedPromo2) {
        const currentPieces = state.getBoardSquare(toRow, toCol);
        const newPieces = currentPieces.filter(p => !isPawn(p));
        newPieces.unshift(resolvedPromo2);
        state.setBoardSquare(toRow, toCol, newPieces);
        moveNotation += '=' + PIECE_SYMBOLS[resolvedPromo2];

        state.updateCastlingRights(fromRow, fromCol, toRow, toCol, newPieces);
        finishMove(moveNotation);
      } else {
        const promotion: PendingPromotion = {
          row: toRow,
          col: toCol,
          isWhite: isWhitePiece(piecesToMove[0]),
          moveNotation,
          otherPieces: piecesToMove.filter(p => !isPawn(p)),
          wasCapture: toSq.pieces.length > piecesToMove.length
        };
        state.setPendingPromotion(promotion);
        showPromotionDialog();
      }
      return;
    }

    // Normal move (no promotion)
    if (moveType === 'klik') {
      state.setBoardSquare(toRow, toCol, [...toSq.pieces, ...piecesToMove]);
      moveNotation += ' klikt';
    } else {
      if (toSq.pieces.length > 0) moveNotation = `${piecesToSymbols(piecesToMove)}${fromNotation}x${toNotation}`;
      state.setBoardSquare(toRow, toCol, piecesToMove);
    }

    state.updateCastlingRights(fromRow, fromCol, toRow, toCol, piecesToMove);
  }

  // En passant target - only on straight double pawn move from start without capture
  const hasPawn = piecesToMove.some(p => isPawn(p));
  const isStraightMove = fromCol === toCol;
  const isFromStartRank = (isWhitePiece(piecesToMove[0]) && fromRow === 6) || (!isWhitePiece(piecesToMove[0]) && fromRow === 1);
  const isNotCapture = !isCapture;

  if (hasPawn && isStraightMove && isFromStartRank && isNotCapture && Math.abs(fromRow - toRow) === 2) {
    const enPassantRow = (fromRow + toRow) / 2;
    state.setEnPassantTarget({ row: enPassantRow, col: toCol });
  }

  // King castling rights
  if (piecesToMove.includes('K')) state.disableCastling('white');
  else if (piecesToMove.includes('k')) state.disableCastling('black');

  // Track moved pawns
  for (const piece of piecesToMove) {
    if (isPawn(piece)) {
      state.addMovedPawn(piece);
    }
  }

  finishMove(moveNotation);
}

function finishMove(moveNotation: string): void {
  state.clearSelection();
  const turn = state.getCurrentTurn();
  state.switchTurn();
  state.addMoveToHistory({ turn, notation: moveNotation });

  // If in analysis mode, also record the move there
  if (isAnalysisMode()) {
    addAnalysisMove({ turn, notation: moveNotation });
    renderBoard();
    updateUI();
    checkForCheckmate();
    updateAnalysisUI();
    return;
  }

  renderBoard();
  updateUI();
  checkForCheckmate();

  // Trigger engine move if it's the engine's turn
  if (isEngineGame() && isEngineTurn() && !state.isGameOver()) {
    setTimeout(() => requestEngineMove(), 100);
  }
}

export function executePromotion(piece: Piece): void {
  const promotion = state.getPendingPromotion();
  if (!promotion) return;

  // Remove promotion overlay
  const overlay = document.getElementById('promotionOverlay');
  if (overlay) overlay.remove();

  // In online mode (but not analysis mode), send move with promotion piece
  if (isOnline() && !isAnalysisMode()) {
    const { fromRow, fromCol, moveType, unklikIndex } = promotion as any;
    sendMove(
      { row: fromRow, col: fromCol },
      { row: promotion.row, col: promotion.col },
      moveType || 'normal',
      unklikIndex,
      piece
    );
    state.clearSelection();
    state.setPendingPromotion(null);
    renderBoard();
    updateUI();
    return;
  }

  const { row, col, moveNotation } = promotion;

  // Replace the pawn with the chosen piece
  const currentPieces = state.getBoardSquare(row, col);
  const newPieces = currentPieces.filter(p => !isPawn(p));
  newPieces.unshift(piece);

  state.setBoardSquare(row, col, newPieces);

  const finalNotation = moveNotation + '=' + PIECE_SYMBOLS[piece];

  state.clearSelection();
  const turn = state.getCurrentTurn();
  state.switchTurn();
  state.addMoveToHistory({ turn, notation: finalNotation });
  state.setPendingPromotion(null);

  // If in analysis mode, also record the move there
  if (isAnalysisMode()) {
    addAnalysisMove({ turn, notation: finalNotation });
    renderBoard();
    updateUI();
    checkForCheckmate();
    updateAnalysisUI();
    return;
  }

  renderBoard();
  updateUI();
  checkForCheckmate();

  // Trigger engine move if it's the engine's turn
  if (isEngineGame() && isEngineTurn() && !state.isGameOver()) {
    setTimeout(() => requestEngineMove(), 100);
  }
}

function checkForCheckmate(): void {
  const board = state.getBoard();
  const currentTurn = state.getCurrentTurn();
  const inCheck = isInCheck(board, currentTurn);
  const hasLegal = hasLegalMoves(board, currentTurn, state.getCastlingRights(), state.getEnPassantTarget(), state.getMovedPawns());

  if (!hasLegal) {
    state.setGameOver(true);
    if (inCheck) {
      showGameOver('checkmate', currentTurn === 'white' ? 'black' : 'white');
    } else {
      showGameOver('stalemate', null);
    }
  } else if (inCheck) {
    showCheckIndicator();
  }
}

export function initGame(): void {
  // Remove any game over overlay
  const overlay = document.getElementById('gameOverOverlay');
  if (overlay) overlay.remove();

  state.initializeBoard();
  renderBoard();
  updateUI();
}

export function toggleAutoPromote(): void {
  const checkbox = document.getElementById('autoPromote') as HTMLInputElement;
  state.setAutoPromote(checkbox.checked);
}

// Handle right-click to cancel premove
export function handleRightClick(): void {
  if (hasPremove()) {
    clearPremove();
    state.clearSelection();
    renderBoard();
    updateUI();
  }
}

// Try to execute a pending premove - called when it becomes your turn
export function tryExecutePremove(): boolean {
  if (!hasPremove()) return false;

  const premove = getPremove();
  if (!premove.from || !premove.to || !premove.moveType) {
    clearPremove();
    return false;
  }

  const board = state.getBoard();
  const fromSquare = board[premove.from.row][premove.from.col];

  // Check if the premove is still valid
  if (fromSquare.pieces.length === 0) {
    clearPremove();
    return false;
  }

  // Verify it's still our piece
  const myColor = getMyColor();
  const isOurPiece = isWhitePiece(fromSquare.pieces[0]) === (myColor === 'white');
  if (!isOurPiece) {
    clearPremove();
    return false;
  }

  // Get valid moves for this piece
  const validMoves = getCombinedMoves(
    board,
    premove.from.row,
    premove.from.col,
    fromSquare.pieces,
    state.getCastlingRights(),
    state.getEnPassantTarget(),
    state.getMovedPawns(),
    premove.unklikPieceIndex
  );

  // Check if the target square is still a valid move
  const matchingMove = validMoves.find(
    m => m.row === premove.to!.row && m.col === premove.to!.col
  );

  if (!matchingMove) {
    clearPremove();
    return false;
  }

  // Execute the premove
  const { from, to, unklikPieceIndex, promotionPiece } = premove;

  // Set up selection state for the move
  state.setSelectedSquare([from.row, from.col]);
  if (unklikPieceIndex !== null) {
    state.setSelectedUnklikPiece(unklikPieceIndex);
  }

  // Clear premove before executing
  clearPremove();

  // Execute based on move type
  const moveType = matchingMove.type;
  if (moveType.startsWith('castle')) {
    executeCastling(from.row, from.col, to.row, to.col, moveType);
  } else {
    movePiece(from.row, from.col, to.row, to.col, moveType, promotionPiece || undefined);
  }

  return true;
}
