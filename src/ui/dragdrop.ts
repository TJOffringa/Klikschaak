import type { Piece, ValidMove } from '../game/types';
import { isWhitePiece, PIECE_SYMBOLS } from '../game/constants';
import * as state from '../game/state';
import { getCombinedMoves } from '../game/moves';
import { handleSquareClick } from '../game/actions';

interface Position {
  row: number;
  col: number;
}

interface TouchState {
  dragging: boolean;
  from: Position | null;
  pieces: Piece[];
  ghostElement: HTMLElement | null;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

const touchState: TouchState = {
  dragging: false,
  from: null,
  pieces: [],
  ghostElement: null,
  startX: 0,
  startY: 0,
  hasMoved: false,
};

// Threshold in pixels before we consider it a drag vs a tap
const DRAG_THRESHOLD = 10;

// Initialize drag and drop for the board
export function initDragAndDrop(): void {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  // Use event delegation on the board
  boardEl.addEventListener('mousedown', handleMouseDown);
  boardEl.addEventListener('touchstart', handleTouchStart, { passive: false });

  // Global listeners for move and end events
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchcancel', handleTouchEnd);
}

// Get the square element and position from event target
function getSquareFromEvent(e: MouseEvent | Touch): { element: HTMLElement; pos: Position } | null {
  const target = e.target as HTMLElement;
  const square = target.closest('.square') as HTMLElement;
  if (!square) return null;

  const row = parseInt(square.dataset.row || '-1');
  const col = parseInt(square.dataset.col || '-1');
  if (row < 0 || col < 0) return null;

  return { element: square, pos: { row, col } };
}

// Get square at specific coordinates
function getSquareAtPoint(x: number, y: number): { element: HTMLElement; pos: Position } | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el.classList.contains('square')) {
      const square = el as HTMLElement;
      const row = parseInt(square.dataset.row || '-1');
      const col = parseInt(square.dataset.col || '-1');
      if (row >= 0 && col >= 0) {
        return { element: square, pos: { row, col } };
      }
    }
  }
  return null;
}

// Create ghost piece that follows cursor/finger
function createGhost(pieces: Piece[]): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = pieces.map(p => {
    const colorClass = isWhitePiece(p) ? 'piece-white' : 'piece-black';
    return `<span class="piece ${colorClass}">${PIECE_SYMBOLS[p]}</span>`;
  }).join('');
  document.body.appendChild(ghost);
  return ghost;
}

// Update ghost position
function updateGhostPosition(ghost: HTMLElement, x: number, y: number): void {
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

// Show valid move indicators on squares
function showValidMoveIndicators(moves: ValidMove[]): void {
  const board = state.getBoard();

  document.querySelectorAll('.square').forEach(sq => {
    const square = sq as HTMLElement;
    const row = parseInt(square.dataset.row || '-1');
    const col = parseInt(square.dataset.col || '-1');

    const move = moves.find(m => m.row === row && m.col === col);
    if (move) {
      square.classList.add('drag-valid-target');
      if (board[row][col].pieces.length > 0) {
        if (move.type === 'klik' || move.type === 'unklik-klik') {
          square.classList.add('drag-klik-target');
        } else {
          square.classList.add('drag-capture-target');
        }
      }
    }
  });
}

// Clear all drag-related classes
function clearDragClasses(): void {
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('drag-valid-target', 'drag-capture-target', 'drag-klik-target', 'drag-over', 'dragging');
  });
}

// Check if a move to position is valid
function isValidMoveTarget(pos: Position, validMoves: ValidMove[]): ValidMove | undefined {
  return validMoves.find(m => m.row === pos.row && m.col === pos.col);
}

// Handle start of drag (common logic)
function startDrag(pos: Position, x: number, y: number): boolean {
  const board = state.getBoard();
  const pieces = board[pos.row][pos.col].pieces;

  if (pieces.length === 0) return false;

  const isWhite = isWhitePiece(pieces[0]);
  const currentTurn = state.getCurrentTurn();

  // Can only drag own pieces
  if ((isWhite && currentTurn !== 'white') || (!isWhite && currentTurn !== 'black')) {
    return false;
  }

  touchState.from = pos;
  touchState.pieces = pieces;
  touchState.startX = x;
  touchState.startY = y;
  touchState.hasMoved = false;
  touchState.dragging = false;

  return true;
}

// Actually start the visual drag
function beginVisualDrag(x: number, y: number): void {
  if (!touchState.from) return;

  touchState.dragging = true;

  // Create ghost
  touchState.ghostElement = createGhost(touchState.pieces);
  updateGhostPosition(touchState.ghostElement, x, y);

  // Mark source square
  const sourceSquare = document.querySelector(
    `.square[data-row="${touchState.from.row}"][data-col="${touchState.from.col}"]`
  );
  if (sourceSquare) {
    sourceSquare.classList.add('dragging');
  }

  // Calculate and show valid moves
  const validMoves = getCombinedMoves(
    state.getBoard(),
    touchState.from.row,
    touchState.from.col,
    touchState.pieces,
    state.getCastlingRights(),
    state.getEnPassantTarget(),
    state.getMovedPawns(),
    null
  );
  state.setValidMoves(validMoves);
  showValidMoveIndicators(validMoves);
}

// Handle drag move (common logic)
function moveDrag(x: number, y: number): void {
  if (!touchState.from) return;

  // Check if we've moved enough to start dragging
  if (!touchState.dragging) {
    const dx = Math.abs(x - touchState.startX);
    const dy = Math.abs(y - touchState.startY);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      touchState.hasMoved = true;
      beginVisualDrag(x, y);
    }
    return;
  }

  // Update ghost position
  if (touchState.ghostElement) {
    updateGhostPosition(touchState.ghostElement, x, y);
  }

  // Highlight square under cursor
  document.querySelectorAll('.square.drag-over').forEach(sq => {
    sq.classList.remove('drag-over');
  });

  const target = getSquareAtPoint(x, y);
  if (target) {
    const validMoves = state.getValidMoves();
    if (isValidMoveTarget(target.pos, validMoves)) {
      target.element.classList.add('drag-over');
    }
  }
}

// Handle end of drag (common logic)
function endDrag(x: number, y: number): void {
  const wasFrom = touchState.from;
  const wasDragging = touchState.dragging;
  const hasMoved = touchState.hasMoved;

  // Clean up ghost
  if (touchState.ghostElement) {
    touchState.ghostElement.remove();
    touchState.ghostElement = null;
  }

  // Clear visual indicators
  clearDragClasses();

  // Reset state
  touchState.from = null;
  touchState.pieces = [];
  touchState.dragging = false;
  touchState.hasMoved = false;

  if (!wasFrom) return;

  // If we didn't move much, treat as click
  if (!hasMoved) {
    handleSquareClick(wasFrom.row, wasFrom.col);
    return;
  }

  // If we were dragging, try to make the move
  if (wasDragging) {
    const target = getSquareAtPoint(x, y);
    if (target) {
      const validMoves = state.getValidMoves();
      const move = isValidMoveTarget(target.pos, validMoves);
      if (move) {
        // Use existing click handler which handles all move types
        state.setSelectedSquare([wasFrom.row, wasFrom.col]);
        handleSquareClick(target.pos.row, target.pos.col);
        return;
      }
    }
    // Invalid drop - clear selection
    state.clearSelection();
  }
}

// Mouse event handlers
function handleMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return; // Left click only
  if (state.isGameOver()) return;

  // Don't start drag on triangle clicks (for unklik)
  const target = e.target as HTMLElement;
  if (target.classList.contains('triangle-left') || target.classList.contains('triangle-right')) {
    return;
  }

  const square = getSquareFromEvent(e);
  if (!square) return;

  if (startDrag(square.pos, e.clientX, e.clientY)) {
    e.preventDefault();
  }
}

function handleMouseMove(e: MouseEvent): void {
  if (!touchState.from) return;
  moveDrag(e.clientX, e.clientY);
}

function handleMouseUp(e: MouseEvent): void {
  if (!touchState.from) return;
  endDrag(e.clientX, e.clientY);
}

// Touch event handlers
function handleTouchStart(e: TouchEvent): void {
  if (state.isGameOver()) return;
  if (e.touches.length !== 1) return;

  // Don't start drag on triangle clicks (for unklik)
  const target = e.target as HTMLElement;
  if (target.classList.contains('triangle-left') || target.classList.contains('triangle-right')) {
    return;
  }

  const touch = e.touches[0];
  const square = getSquareFromEvent(touch);
  if (!square) return;

  if (startDrag(square.pos, touch.clientX, touch.clientY)) {
    // Don't prevent default yet - allow for tap detection
  }
}

function handleTouchMove(e: TouchEvent): void {
  if (!touchState.from) return;
  if (e.touches.length !== 1) return;

  // Prevent scrolling immediately when a piece is touched
  e.preventDefault();

  const touch = e.touches[0];
  moveDrag(touch.clientX, touch.clientY);
}

function handleTouchEnd(e: TouchEvent): void {
  if (!touchState.from) return;

  const touch = e.changedTouches[0];
  endDrag(touch.clientX, touch.clientY);
}

// Clean up (call when game resets)
export function cleanupDragAndDrop(): void {
  if (touchState.ghostElement) {
    touchState.ghostElement.remove();
    touchState.ghostElement = null;
  }
  clearDragClasses();
  touchState.from = null;
  touchState.pieces = [];
  touchState.dragging = false;
  touchState.hasMoved = false;
}
