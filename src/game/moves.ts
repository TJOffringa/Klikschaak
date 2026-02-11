import type { Board, Piece, ValidMove, MoveType, EnPassantTarget, GameCastlingRights } from './types';
import {
  isWhitePiece,
  isPawn,
  getPieceType,
  KNIGHT_MOVES,
  KING_MOVES,
  DIAGONAL_DIRS,
  ORTHOGONAL_DIRS,
} from './constants';

// Check if a square is attacked by opponent pieces
export function isSquareAttacked(
  board: Board,
  row: number,
  col: number,
  byWhite: boolean
): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const pieces = board[r][c].pieces;
      if (pieces.length === 0) continue;
      if (isWhitePiece(pieces[0]) === byWhite) continue;

      for (const piece of pieces) {
        if (canPieceAttack(board, r, c, piece, row, col)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if a specific piece can attack a target square
function canPieceAttack(
  board: Board,
  fromRow: number,
  fromCol: number,
  piece: Piece,
  toRow: number,
  toCol: number
): boolean {
  const p = getPieceType(piece);
  const isWhite = isWhitePiece(piece);

  // Pawn attacks diagonally
  if (p === 'p') {
    const dir = isWhite ? -1 : 1;
    return Math.abs(fromCol - toCol) === 1 && fromRow + dir === toRow;
  }

  // Knight
  if (p === 'n') {
    const dr = Math.abs(fromRow - toRow);
    const dc = Math.abs(fromCol - toCol);
    return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
  }

  // King
  if (p === 'k') {
    return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1;
  }

  // Bishop or Queen (diagonal)
  if (p === 'b' || p === 'q') {
    if (Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol)) {
      const dr = toRow > fromRow ? 1 : -1;
      const dc = toCol > fromCol ? 1 : -1;
      let r = fromRow + dr, c = fromCol + dc;
      while (r !== toRow || c !== toCol) {
        if (board[r][c].pieces.length > 0) return false;
        r += dr;
        c += dc;
      }
      return true;
    }
  }

  // Rook or Queen (orthogonal)
  if (p === 'r' || p === 'q') {
    if (fromRow === toRow || fromCol === toCol) {
      const dr = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
      const dc = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
      let r = fromRow + dr, c = fromCol + dc;
      while (r !== toRow || c !== toCol) {
        if (board[r][c].pieces.length > 0) return false;
        r += dr;
        c += dc;
      }
      return true;
    }
  }

  return false;
}

// Get all possible moves for a single piece (not filtered for check)
export function getPieceMoves(
  board: Board,
  row: number,
  col: number,
  piece: Piece,
  castlingRights: GameCastlingRights,
  enPassantTarget: EnPassantTarget | null,
  movedPawns: Set<Piece>
): [number, number, MoveType?][] {
  const moves: [number, number, MoveType?][] = [];
  const isWhite = isWhitePiece(piece);
  const p = getPieceType(piece);

  if (p === 'p') {
    const dir = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;

    // Forward move
    if (row + dir >= 0 && row + dir < 8 && board[row + dir][col].pieces.length === 0) {
      moves.push([row + dir, col]);
      // Double move from start
      if (row === startRow && !movedPawns.has(piece) && board[row + 2 * dir][col].pieces.length === 0) {
        moves.push([row + 2 * dir, col]);
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const newCol = col + dc;
      if (newCol >= 0 && newCol < 8 && row + dir >= 0 && row + dir < 8) {
        const targetSq = board[row + dir][newCol];
        if (targetSq.pieces.length > 0 && isWhitePiece(targetSq.pieces[0]) !== isWhite) {
          moves.push([row + dir, newCol]);
        }
        // En passant
        if (enPassantTarget && enPassantTarget.row === row + dir && enPassantTarget.col === newCol) {
          moves.push([row + dir, newCol, 'en-passant']);
        }
      }
    }
  }

  if (p === 'n') {
    for (const [dr, dc] of KNIGHT_MOVES) {
      const newRow = row + dr, newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        moves.push([newRow, newCol]);
      }
    }
  }

  if (p === 'b' || p === 'q') {
    for (const [dr, dc] of DIAGONAL_DIRS) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dr * i, newCol = col + dc * i;
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
        moves.push([newRow, newCol]);
        if (board[newRow][newCol].pieces.length > 0) break;
      }
    }
  }

  if (p === 'r' || p === 'q') {
    for (const [dr, dc] of ORTHOGONAL_DIRS) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dr * i, newCol = col + dc * i;
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
        moves.push([newRow, newCol]);
        if (board[newRow][newCol].pieces.length > 0) break;
      }
    }
  }

  if (p === 'k') {
    for (const [dr, dc] of KING_MOVES) {
      const newRow = row + dr, newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const targetSq = board[newRow][newCol];
        if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
          moves.push([newRow, newCol]);
        }
      }
    }

    // Castling
    const rights = isWhite ? castlingRights.white : castlingRights.black;
    const baseRow = isWhite ? 7 : 0;

    // Kingside castling
    if (rights.kingSide) {
      const rookSquare = board[baseRow][7];
      const targetSquare = board[baseRow][5]; // f1/f8
      const kingDestSquare = board[baseRow][6]; // g1/g8

      if (kingDestSquare.pieces.length === 0) {
        if (rookSquare.pieces.length > 0 && rookSquare.pieces.some(p => getPieceType(p) === 'r')) {
          if (targetSquare.pieces.length === 0) {
            if (rookSquare.pieces.length === 1) {
              moves.push([baseRow, 6, 'castle-k']);
            } else if (rookSquare.pieces.length === 2) {
              moves.push([baseRow, 6, 'castle-k-choice']);
            }
          } else if (targetSquare.pieces.length === 1 && isWhitePiece(targetSquare.pieces[0]) === isWhite) {
            if (rookSquare.pieces.length === 1) {
              moves.push([baseRow, 6, 'castle-k-klik']);
            } else if (rookSquare.pieces.length === 2) {
              moves.push([baseRow, 6, 'castle-k-unklik-klik']);
            }
          }
        }
      }
    }

    // Queenside castling
    if (rights.queenSide) {
      const rookSquare = board[baseRow][0];
      const targetSquare = board[baseRow][3]; // d1/d8
      const kingDestSquare = board[baseRow][2]; // c1/c8
      const betweenSquare = board[baseRow][1]; // b1/b8

      if (kingDestSquare.pieces.length === 0 && betweenSquare.pieces.length === 0) {
        if (rookSquare.pieces.length > 0 && rookSquare.pieces.some(p => getPieceType(p) === 'r')) {
          if (targetSquare.pieces.length === 0) {
            if (rookSquare.pieces.length === 1) {
              moves.push([baseRow, 2, 'castle-q']);
            } else if (rookSquare.pieces.length === 2) {
              moves.push([baseRow, 2, 'castle-q-choice']);
            }
          } else if (targetSquare.pieces.length === 1 && isWhitePiece(targetSquare.pieces[0]) === isWhite) {
            if (rookSquare.pieces.length === 1) {
              moves.push([baseRow, 2, 'castle-q-klik']);
            } else if (rookSquare.pieces.length === 2) {
              moves.push([baseRow, 2, 'castle-q-unklik-klik']);
            }
          }
        }
      }
    }
  }

  return moves;
}

// Check if making a move would leave the king in check
export function wouldBeInCheck(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  pieces: Piece[],
  moveType: MoveType | undefined,
  unklikIndex: number | null
): boolean {
  // Create a test board
  const testBoard: Board = board.map(row =>
    row.map(sq => ({ pieces: [...sq.pieces] }))
  );
  const isWhite = isWhitePiece(pieces[0]);

  // Apply the move to test board
  if (moveType === 'en-passant') {
    const captureRow = isWhite ? toRow + 1 : toRow - 1;
    testBoard[captureRow][toCol].pieces = [];
    testBoard[toRow][toCol].pieces = [...pieces];
    testBoard[fromRow][fromCol].pieces = [];
  } else if (moveType === 'en-passant-unklik') {
    const captureRow = isWhite ? toRow + 1 : toRow - 1;
    testBoard[captureRow][toCol].pieces = [];
    const movingPiece = pieces[unklikIndex!];
    testBoard[toRow][toCol].pieces = [movingPiece];
    testBoard[fromRow][fromCol].pieces = testBoard[fromRow][fromCol].pieces.filter((_, i) => i !== unklikIndex);
  } else if (moveType === 'unklik' || moveType === 'unklik-klik') {
    const movingPiece = pieces[unklikIndex!];
    if (moveType === 'unklik-klik') {
      testBoard[toRow][toCol].pieces = [...testBoard[toRow][toCol].pieces, movingPiece];
    } else {
      testBoard[toRow][toCol].pieces = [movingPiece];
    }
    testBoard[fromRow][fromCol].pieces = testBoard[fromRow][fromCol].pieces.filter((_, i) => i !== unklikIndex);
  } else if (moveType === 'klik') {
    testBoard[toRow][toCol].pieces = [...testBoard[toRow][toCol].pieces, ...pieces];
    testBoard[fromRow][fromCol].pieces = [];
  } else if (moveType?.startsWith('castle-')) {
    const isKingSide = moveType.startsWith('castle-k');
    const rookCol = isKingSide ? 7 : 0;
    const newRookCol = isKingSide ? 5 : 3;

    // Move king
    testBoard[toRow][toCol].pieces = pieces;
    testBoard[fromRow][fromCol].pieces = [];

    const rookSquare = [...testBoard[fromRow][rookCol].pieces];
    testBoard[fromRow][rookCol].pieces = [];

    if (moveType.includes('unklik-klik')) {
      const rook = rookSquare.find(p => getPieceType(p) === 'r')!;
      const pieceOnTarget = [...testBoard[fromRow][newRookCol].pieces];
      testBoard[fromRow][newRookCol].pieces = [rook, ...pieceOnTarget];
    } else if (moveType.includes('klik') && !moveType.includes('unklik')) {
      const pieceOnSquare = [...testBoard[fromRow][newRookCol].pieces];
      testBoard[fromRow][newRookCol].pieces = [...rookSquare, ...pieceOnSquare];
    } else if (moveType.includes('both')) {
      testBoard[fromRow][newRookCol].pieces = rookSquare;
    } else {
      if (rookSquare.length === 2) {
        const rook = rookSquare.find(p => getPieceType(p) === 'r')!;
        testBoard[fromRow][newRookCol].pieces = [rook];
      } else {
        testBoard[fromRow][newRookCol].pieces = rookSquare;
      }
    }

    // Check if king passes through check
    const throughSquare = isKingSide ? fromCol + 1 : fromCol - 1;
    for (const checkCol of [fromCol, throughSquare, toCol]) {
      if (isSquareAttacked(testBoard, fromRow, checkCol, isWhite)) {
        return true;
      }
    }
  } else {
    // Normal move
    testBoard[toRow][toCol].pieces = [...pieces];
    testBoard[fromRow][fromCol].pieces = [];
  }

  // Find king position
  let kingRow = -1, kingCol = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (testBoard[r][c].pieces.includes(isWhite ? 'K' : 'k')) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return false;
  return isSquareAttacked(testBoard, kingRow, kingCol, isWhite);
}

// Get all valid moves for pieces on a square (combined for klikked pieces)
export function getCombinedMoves(
  board: Board,
  row: number,
  col: number,
  pieces: Piece[],
  castlingRights: GameCastlingRights,
  enPassantTarget: EnPassantTarget | null,
  movedPawns: Set<Piece>,
  selectedUnklikPiece: number | null
): ValidMove[] {
  const allMoves = new Map<string, ValidMove>();
  const isWhite = isWhitePiece(pieces[0]);
  const canKlik = pieces.length === 1;
  const hasPawn = pieces.some(p => isPawn(p));

  for (const piece of pieces) {
    const moves = getPieceMoves(board, row, col, piece, castlingRights, enPassantTarget, movedPawns);

    for (const move of moves) {
      const [r, c, moveType] = move;
      const key = `${r},${c}`;
      const targetSq = board[r][c];
      const isPawnMove = isPawn(piece);
      const isPromotionRank = (isWhite && r === 0) || (!isWhite && r === 7);

      // Rule: A pawn cannot be carried to the promotion rank by another piece
      if (hasPawn && pieces.length === 2 && !isPawnMove && isPromotionRank) {
        continue;
      }

      // Rule: A pawn can never move to its own back rank
      const isOwnBackRank = (isWhite && r === 7) || (!isWhite && r === 0);
      if (hasPawn && isOwnBackRank) {
        continue;
      }

      // En passant handling
      if (moveType === 'en-passant') {
        const existingMove = allMoves.get(key);
        if (existingMove && existingMove.type !== 'en-passant') {
          allMoves.set(key, { row: r, col: c, type: 'en-passant-choice' });
        } else {
          allMoves.set(key, { row: r, col: c, type: 'en-passant' });
        }
        continue;
      }

      // Check conflict with en-passant
      const existingMove = allMoves.get(key);
      if (existingMove && existingMove.type === 'en-passant') {
        allMoves.set(key, { row: r, col: c, type: 'en-passant-choice' });
        continue;
      }

      if (!canKlik) {
        if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
          allMoves.set(key, { row: r, col: c, type: moveType || 'normal' });
        }
      } else {
        if (targetSq.pieces.length > 0 && isWhitePiece(targetSq.pieces[0]) === isWhite) {
          const isPawnPiece = isPawn(piece);
          const isStraight = isPawnPiece && col === c;
          const hasNoKing = !targetSq.pieces.some(p => getPieceType(p) === 'k') && !pieces.some(p => getPieceType(p) === 'k');

          if (isStraight && targetSq.pieces.length < 2 && hasNoKing) {
            allMoves.set(key, { row: r, col: c, type: 'klik' });
          } else if (!isPawnPiece && targetSq.pieces.length < 2 && hasNoKing) {
            allMoves.set(key, { row: r, col: c, type: 'klik' });
          }
        } else if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
          allMoves.set(key, { row: r, col: c, type: moveType || 'normal' });
        }
      }
    }
  }

  // Special pawn klik moves: pawn can klik straight forward with own pieces
  if (canKlik) {
    const pawn = pieces.find(p => isPawn(p));
    if (pawn) {
      const dir = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;

      // 1 square forward
      if (row + dir >= 0 && row + dir < 8) {
        const targetSq = board[row + dir][col];
        if (targetSq.pieces.length === 1 &&
            isWhitePiece(targetSq.pieces[0]) === isWhite &&
            !targetSq.pieces.some(p => getPieceType(p) === 'k')) {
          const key = `${row + dir},${col}`;
          allMoves.set(key, { row: row + dir, col, type: 'klik' });
        }
      }

      // 2 squares forward from start
      if (row === startRow && !movedPawns.has(pawn) && row + 2 * dir >= 0 && row + 2 * dir < 8) {
        const targetSq = board[row + 2 * dir][col];
        const betweenSq = board[row + dir][col];
        if (betweenSq.pieces.length === 0 &&
            targetSq.pieces.length === 1 &&
            isWhitePiece(targetSq.pieces[0]) === isWhite &&
            !targetSq.pieces.some(p => getPieceType(p) === 'k')) {
          const key = `${row + 2 * dir},${col}`;
          allMoves.set(key, { row: row + 2 * dir, col, type: 'klik' });
        }
      }
    }
  }

  // Filter moves that would leave king in check
  let finalMoves = Array.from(allMoves.values());
  finalMoves = finalMoves.filter(move =>
    !wouldBeInCheck(board, row, col, move.row, move.col, pieces, move.type, selectedUnklikPiece)
  );

  return finalMoves;
}

// Check if the king is in check
export function isInCheck(board: Board, color: 'white' | 'black'): boolean {
  const isWhite = color === 'white';
  let kingRow = -1, kingCol = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c].pieces.includes(isWhite ? 'K' : 'k')) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return false;
  return isSquareAttacked(board, kingRow, kingCol, isWhite);
}

// Check if the current player has any legal moves
export function hasLegalMoves(
  board: Board,
  color: 'white' | 'black',
  castlingRights: GameCastlingRights,
  enPassantTarget: EnPassantTarget | null,
  movedPawns: Set<Piece>
): boolean {
  const isWhite = color === 'white';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const pieces = board[r][c].pieces;
      if (pieces.length === 0) continue;
      if (isWhitePiece(pieces[0]) !== isWhite) continue;

      const moves = getCombinedMoves(board, r, c, pieces, castlingRights, enPassantTarget, movedPawns, null);
      if (moves.length > 0) return true;

      // Also check unklik moves for stacked pieces
      if (pieces.length === 2) {
        for (let i = 0; i < 2; i++) {
          const piece = pieces[i];
          const singleMoves = getPieceMoves(board, r, c, piece, castlingRights, enPassantTarget, movedPawns);

          // Pawn klik targets: forward onto friendly non-king piece (getPieceMoves only returns empty/enemy)
          if (isPawn(piece)) {
            const dir = isWhite ? -1 : 1;
            const startRow = isWhite ? 6 : 1;
            const promoRank = isWhite ? 0 : 7;
            const fwdRow = r + dir;
            if (fwdRow >= 0 && fwdRow < 8 && fwdRow !== promoRank) {
              const fwdSq = board[fwdRow][c];
              if (fwdSq.pieces.length === 1 && isWhitePiece(fwdSq.pieces[0]) === isWhite &&
                  getPieceType(fwdSq.pieces[0]) !== 'k') {
                singleMoves.push([fwdRow, c]);
              }
            }
            if (r === startRow && !movedPawns.has(piece)) {
              const midRow = r + dir;
              const dblRow = r + 2 * dir;
              if (board[midRow][c].pieces.length === 0 && dblRow !== promoRank) {
                const dblSq = board[dblRow][c];
                if (dblSq.pieces.length === 1 && isWhitePiece(dblSq.pieces[0]) === isWhite &&
                    getPieceType(dblSq.pieces[0]) !== 'k') {
                  singleMoves.push([dblRow, c]);
                }
              }
            }
          }

          for (const move of singleMoves) {
            const [mr, mc] = move;
            const targetSq = board[mr][mc];

            if (targetSq.pieces.length === 0 || isWhitePiece(targetSq.pieces[0]) !== isWhite) {
              if (!wouldBeInCheck(board, r, c, mr, mc, pieces, 'unklik', i)) return true;
            } else if (targetSq.pieces.length < 2 &&
                       isWhitePiece(targetSq.pieces[0]) === isWhite &&
                       !targetSq.pieces.some(p => getPieceType(p) === 'k')) {
              if (!wouldBeInCheck(board, r, c, mr, mc, pieces, 'unklik-klik', i)) return true;
            }
          }
        }
      }
    }
  }

  return false;
}
