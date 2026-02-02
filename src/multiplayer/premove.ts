import type { MoveType, Piece } from '../game/types.js';

export interface PremoveState {
  from: { row: number; col: number } | null;
  to: { row: number; col: number } | null;
  moveType: MoveType | null;
  unklikPieceIndex: number | null;
  promotionPiece: Piece | null;
}

let premoveState: PremoveState = {
  from: null,
  to: null,
  moveType: null,
  unklikPieceIndex: null,
  promotionPiece: null,
};

export function getPremove(): PremoveState {
  return premoveState;
}

export function hasPremove(): boolean {
  return premoveState.from !== null && premoveState.to !== null;
}

export function setPremove(
  from: { row: number; col: number },
  to: { row: number; col: number },
  moveType: MoveType,
  unklikPieceIndex?: number,
  promotionPiece?: Piece
): void {
  premoveState = {
    from,
    to,
    moveType,
    unklikPieceIndex: unklikPieceIndex ?? null,
    promotionPiece: promotionPiece ?? null,
  };
}

export function clearPremove(): void {
  premoveState = {
    from: null,
    to: null,
    moveType: null,
    unklikPieceIndex: null,
    promotionPiece: null,
  };
}

// Check if a square is part of the premove
export function isPremoveSquare(row: number, col: number): 'from' | 'to' | null {
  if (premoveState.from?.row === row && premoveState.from?.col === col) {
    return 'from';
  }
  if (premoveState.to?.row === row && premoveState.to?.col === col) {
    return 'to';
  }
  return null;
}
