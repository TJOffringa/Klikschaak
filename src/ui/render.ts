import type { Piece, MoveType, PieceColor } from '../game/types';
import { isWhitePiece, getPieceValue, getPieceType, PIECE_SYMBOLS } from '../game/constants';
import * as state from '../game/state';
import { t, getPieceName, getLanguage, setLanguage } from '../i18n/translations';
import { handleSquareClick, handleUnklikSelect, executePromotion, movePiece, executeCastling, initGame, toggleAutoPromote, handleRightClick } from '../game/actions';
import { shouldUseEditorClick, handleEditorBoardClick, openAnalysisFromGame } from './analysisUI.js';
import { isPremoveSquare } from '../multiplayer/premove.js';
import { isOnline, isMyTurn, getMyColor } from '../multiplayer/onlineGame.js';

// Board orientation state
let boardFlipped = false;

export function setBoardFlipped(flipped: boolean): void {
  boardFlipped = flipped;
}

export function isBoardFlipped(): boolean {
  return boardFlipped;
}

// Make functions available globally for onclick handlers
(window as any).handleSquareClick = handleSquareClick;
(window as any).handleUnklikSelect = handleUnklikSelect;
(window as any).initializeBoard = initGame;
(window as any).toggleAutoPromote = toggleAutoPromote;
(window as any).executePromotion = executePromotion;
(window as any).executeCastling = executeCastling;
(window as any).movePiece = movePiece;
(window as any).switchLanguage = switchLanguage;

function switchLanguage(): void {
  const newLang = getLanguage() === 'nl' ? 'en' : 'nl';
  setLanguage(newLang);
  renderBoard();
  updateUI();
  updateStaticTexts();
}

function updateStaticTexts(): void {
  const title = document.querySelector('.header h1');
  if (title) title.textContent = `👑 ${t('title')}`;

  const subtitle = document.querySelector('.header p');
  if (subtitle) subtitle.textContent = t('subtitle');

  const newGameBtn = document.querySelector('.new-game-btn');
  if (newGameBtn) newGameBtn.textContent = `🔄 ${t('newGame')}`;

  const movesHeader = document.querySelector('.panel h2');
  if (movesHeader) {
    const moveCount = document.getElementById('moveCount')?.textContent || '0';
    movesHeader.innerHTML = `📋 ${t('moves')} (<span id="moveCount">${moveCount}</span>)`;
  }

  const rulesHeader = document.querySelector('.rules h2');
  if (rulesHeader) rulesHeader.textContent = `⚡ ${t('gameRules')}`;

  const rulesContent = document.querySelectorAll('.rules p');
  if (rulesContent.length >= 4) {
    rulesContent[0].innerHTML = `<strong style="color: #c084fc;">${t('klik')}</strong> ${getLanguage() === 'nl' ? 'Selecteer stuk, klik op veld met blauwe ring' : 'Select piece, click square with blue ring'}`;
    rulesContent[1].innerHTML = `<strong style="color: #60a5fa;">${t('unklik')}</strong> ${getLanguage() === 'nl' ? 'Klik op driehoek met het stuk' : 'Click triangle with the piece'}`;
    rulesContent[2].innerHTML = `⚠️ ${t('kingWarning')}`;
    rulesContent[3].innerHTML = `💡 ${t('promotionTip')}`;
  }

  const autoPromoteLabel = document.querySelector('label[for="autoPromote"]');
  if (autoPromoteLabel) autoPromoteLabel.textContent = t('autoPromote');

  const selectedHeader = document.querySelector('#selectedInfo h2');
  if (selectedHeader) selectedHeader.textContent = t('selected');

  // Update language button
  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = getLanguage() === 'nl' ? 'EN' : 'NL';
}

function renderPiece(pieces: Piece[], row: number, col: number, isSelected: boolean): string {
  if (pieces.length === 0) return '';

  const getClass = (p: Piece) => isWhitePiece(p) ? 'piece piece-white' : 'piece piece-black';

  if (pieces.length === 1) {
    return `<div class="${getClass(pieces[0])}">${PIECE_SYMBOLS[pieces[0]]}</div>`;
  }

  const sorted = [...pieces].sort((a, b) => getPieceValue(b) - getPieceValue(a));
  const bottom = sorted[0], top = sorted[1];
  const isWhite = isWhitePiece(pieces[0]);
  const selectedUnklikPiece = state.getSelectedUnklikPiece();
  const bottomSel = isSelected && selectedUnklikPiece !== null && pieces.indexOf(bottom) === selectedUnklikPiece;
  const topSel = isSelected && selectedUnklikPiece !== null && pieces.indexOf(top) === selectedUnklikPiece;
  const wholeSel = isSelected && selectedUnklikPiece === null;
  const currentTurn = state.getCurrentTurn();
  let canInt: boolean;
  if (isOnline()) {
    const myColor = getMyColor();
    canInt = isMyTurn() && ((isWhite && myColor === 'white') || (!isWhite && myColor === 'black'));
  } else {
    canInt = (isWhite && currentTurn === 'white') || (!isWhite && currentTurn === 'black');
  }

  return `<div class="stacked-piece">
    <svg class="stacked-svg" viewBox="0 0 64 64">
      <line x1="32" y1="0" x2="0" y2="64" stroke="rgba(100,100,100,0.4)" stroke-width="2"/>
      <line x1="32" y1="0" x2="64" y2="64" stroke="rgba(100,100,100,0.4)" stroke-width="2"/>
    </svg>
    ${wholeSel ? '<div class="whole-selected"></div>' : ''}
    <div class="stacked-center">
      <div class="stacked-top ${getClass(top)}">${PIECE_SYMBOLS[top]}</div>
      <div class="stacked-bottom ${getClass(bottom)}">${PIECE_SYMBOLS[bottom]}</div>
    </div>
    ${canInt ? `
      <div class="triangle-left ${bottomSel ? 'selected' : ''}" onclick="handleUnklikSelect(${row},${col},${pieces.indexOf(bottom)},event)" title="${getLanguage() === 'nl' ? 'Zet met' : 'Move with'} ${getPieceName(bottom)}">
        <span class="triangle-symbol left ${getClass(bottom)}">${PIECE_SYMBOLS[bottom]}</span>
      </div>
      <div class="triangle-right ${topSel ? 'selected' : ''}" onclick="handleUnklikSelect(${row},${col},${pieces.indexOf(top)},event)" title="${getLanguage() === 'nl' ? 'Zet met' : 'Move with'} ${getPieceName(top)}">
        <span class="triangle-symbol right ${getClass(top)}">${PIECE_SYMBOLS[top]}</span>
      </div>
    ` : ''}
    ${!bottomSel && !wholeSel ? '<div class="triangle-bg-left"></div>' : ''}
    ${!topSel && !wholeSel ? '<div class="triangle-bg-right"></div>' : ''}
  </div>`;
}

export function renderBoard(): void {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  const board = state.getBoard();
  const selectedSquare = state.getSelectedSquare();
  const validMoves = state.getValidMoves();

  // Lock board height during re-render to prevent mobile scroll shift
  const prevHeight = boardEl.offsetHeight;
  if (prevHeight > 0) {
    boardEl.style.minHeight = prevHeight + 'px';
  }

  boardEl.innerHTML = '';

  // When flipped, iterate in reverse order
  const rowOrder = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  for (const row of rowOrder) {
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';

    for (const col of colOrder) {
      const square = document.createElement('div');
      const isLight = (row + col) % 2 === 0;
      square.className = `square ${isLight ? 'light' : 'dark'}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col) {
        square.classList.add('selected');
      }

      // Check for premove highlighting
      const premoveType = isPremoveSquare(row, col);
      if (premoveType === 'from') {
        square.classList.add('premove-from');
      } else if (premoveType === 'to') {
        square.classList.add('premove-to');
      }

      const pieces = board[row][col].pieces;
      const isSel = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
      square.innerHTML = renderPiece(pieces, row, col, !!isSel);

      const move = validMoves.find(m => m.row === row && m.col === col);
      if (move) {
        const ind = document.createElement('div');
        if (move.type === 'klik') ind.className = 'valid-klik';
        else if (move.type === 'unklik-klik') ind.className = 'valid-unklik-klik';
        else if (pieces.length > 0) ind.className = 'valid-capture';
        else ind.className = 'valid-move';
        square.appendChild(ind);
      }

      square.onclick = (e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('triangle-left') && !target.classList.contains('triangle-right')) {
          // Check if we're in editor mode
          if (shouldUseEditorClick()) {
            handleEditorBoardClick(row, col);
          } else {
            handleSquareClick(row, col);
          }
        }
      };

      // Right-click to cancel premove
      square.oncontextmenu = (e) => {
        e.preventDefault();
        handleRightClick();
      };

      rowEl.appendChild(square);
    }

    boardEl.appendChild(rowEl);
  }

  // Release height lock after content is rebuilt
  boardEl.style.minHeight = '';
}

export function updateUI(): void {
  const ind = document.getElementById('turnIndicator');
  if (ind) {
    ind.textContent = state.getCurrentTurn() === 'white' ? t('whiteToMove') : t('blackToMove');
    ind.className = `turn-indicator ${state.getCurrentTurn() === 'white' ? 'turn-white' : 'turn-black'}`;
  }

  const moveCount = document.getElementById('moveCount');
  if (moveCount) {
    moveCount.textContent = String(Math.ceil(state.getMoveHistory().length / 2));
  }

  const histEl = document.getElementById('moveHistory');
  const moveHistory = state.getMoveHistory();

  if (histEl) {
    if (moveHistory.length === 0) {
      histEl.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:16px 0;">${t('noMoves')}</p>`;
    } else {
      // Group moves into pairs (white, black)
      const pairs: { moveNumber: number; white: { notation: string } | null; black: { notation: string } | null }[] = [];
      for (let i = 0; i < moveHistory.length; i += 2) {
        const whiteMove = moveHistory[i];
        const blackMove = i + 1 < moveHistory.length ? moveHistory[i + 1] : null;
        pairs.push({
          moveNumber: Math.floor(i / 2) + 1,
          white: whiteMove,
          black: blackMove
        });
      }

      // Show last 10 move pairs
      histEl.innerHTML = pairs.slice(-10).reverse().map(pair => {
        const whiteText = pair.white ? pair.white.notation : '';
        const blackText = pair.black ? pair.black.notation : '';
        return `<div class="move-pair">
          <span class="move-number">${pair.moveNumber}.</span>
          <span class="move-white">${whiteText}</span>
          <span class="move-black">${blackText}</span>
        </div>`;
      }).join('');
    }
  }

  updateSelectedInfo();
}

function updateSelectedInfo(): void {
  const info = document.getElementById('selectedInfo');
  if (!info) return;

  const selectedSquare = state.getSelectedSquare();
  if (selectedSquare && state.getBoard()[selectedSquare[0]][selectedSquare[1]].pieces.length > 0) {
    info.classList.add('show');
    const pieces = state.getBoard()[selectedSquare[0]][selectedSquare[1]].pieces;

    const getClass = (p: Piece) => isWhitePiece(p) ? 'selected-piece-icon piece piece-white' : 'selected-piece-icon piece piece-black';

    const piecesEl = document.getElementById('selectedPieces');
    if (piecesEl) {
      piecesEl.innerHTML = pieces.map(p => `<div class="${getClass(p)}">${PIECE_SYMBOLS[p]}</div>`).join('');
    }

    const namesEl = document.getElementById('selectedNames');
    if (namesEl) {
      namesEl.textContent = pieces.map(p => getPieceName(p)).join(' + ');
    }

    const movesEl = document.getElementById('selectedMoves');
    if (movesEl) {
      movesEl.textContent = `${state.getValidMoves().length} ${t('possibleMoves')}`;
    }
  } else {
    info.classList.remove('show');
  }
}

export function showCheckIndicator(): void {
  const existing = document.getElementById('checkIndicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.id = 'checkIndicator';
  indicator.className = 'check-indicator';
  indicator.textContent = t('check');

  const container = document.querySelector('.board-container');
  if (container) {
    (container as HTMLElement).style.position = 'relative';
    container.appendChild(indicator);
  }

  setTimeout(() => {
    const el = document.getElementById('checkIndicator');
    if (el) el.remove();
  }, 3000);
}

export function showGameOver(type: 'checkmate' | 'stalemate', winner: PieceColor | null): void {
  const overlay = document.createElement('div');
  overlay.className = 'promotion-overlay';
  overlay.id = 'gameOverOverlay';

  const box = document.createElement('div');
  box.className = 'game-over-box';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'game-over-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.onclick = () => overlay.remove();
  box.appendChild(closeBtn);

  const titleDiv = document.createElement('div');
  titleDiv.className = 'game-over-title';
  titleDiv.textContent = type === 'checkmate' ? t('checkmate') : t('stalemate');
  box.appendChild(titleDiv);

  const message = document.createElement('div');
  message.className = 'game-over-message';
  if (type === 'stalemate') {
    message.textContent = t('gameEndsDraw');
  } else {
    const winnerName = winner === 'white'
      ? (getLanguage() === 'nl' ? 'Wit' : 'White')
      : (getLanguage() === 'nl' ? 'Zwart' : 'Black');
    message.textContent = `${winnerName} ${t('wins')}`;
  }
  box.appendChild(message);

  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;';

  const analysisBtn = document.createElement('button');
  analysisBtn.className = 'game-over-btn';
  analysisBtn.textContent = getLanguage() === 'nl' ? 'Analyse' : 'Analysis';
  analysisBtn.onclick = () => {
    overlay.remove();
    const moves = state.getMoveHistory();
    openAnalysisFromGame(moves);
  };
  buttonsDiv.appendChild(analysisBtn);

  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'game-over-btn';
  newGameBtn.textContent = t('newGame');
  newGameBtn.onclick = () => initGame();
  buttonsDiv.appendChild(newGameBtn);

  box.appendChild(buttonsDiv);

  overlay.appendChild(box);
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.body.appendChild(overlay);
}

export function showPromotionDialog(): void {
  const promotion = state.getPendingPromotion();
  if (!promotion) return;

  const overlay = document.createElement('div');
  overlay.className = 'promotion-overlay';
  overlay.id = 'promotionOverlay';

  const isWhite = promotion.isWhite;
  const pieces = isWhite ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

  const box = document.createElement('div');
  box.className = 'promotion-box';

  const title = document.createElement('div');
  title.className = 'promotion-title';
  title.textContent = t('choosePromotion');
  box.appendChild(title);

  const piecesDiv = document.createElement('div');
  piecesDiv.className = 'promotion-pieces';

  pieces.forEach(p => {
    const choice = document.createElement('div');
    choice.className = 'promotion-choice';
    const pieceDiv = document.createElement('div');
    pieceDiv.className = `promotion-piece piece ${isWhite ? 'piece-white' : 'piece-black'}`;
    pieceDiv.textContent = PIECE_SYMBOLS[p];
    choice.appendChild(pieceDiv);
    choice.onclick = () => executePromotion(p as Piece);
    piecesDiv.appendChild(choice);
  });

  box.appendChild(piecesDiv);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function showCastlingChoiceDialog(fromRow: number, fromCol: number, toRow: number, toCol: number, castleType: MoveType): void {
  const overlay = document.createElement('div');
  overlay.className = 'promotion-overlay';
  overlay.id = 'castlingChoiceOverlay';

  const isKingSide = castleType.includes('k');
  const rookCol = isKingSide ? 7 : 0;
  const board = state.getBoard();
  const rookPieces = board[fromRow][rookCol].pieces;
  const toren = rookPieces.find(p => getPieceType(p) === 'r')!;
  const otherPiece = rookPieces.find(p => getPieceType(p) !== 'r')!;
  const isWhite = isWhitePiece(toren);

  const box = document.createElement('div');
  box.className = 'promotion-box';

  const title = document.createElement('div');
  title.className = 'promotion-title';
  title.textContent = t('chooseCastling');
  box.appendChild(title);

  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'promotion-pieces';
  choicesDiv.style.gap = '20px';

  // Option 1: Only rook
  const choice1 = document.createElement('div');
  choice1.className = 'promotion-choice';
  choice1.style.cssText = 'width:120px;height:100px;flex-direction:column;display:flex;justify-content:center;align-items:center;';

  const piece1 = document.createElement('div');
  piece1.className = `promotion-piece piece ${isWhite ? 'piece-white' : 'piece-black'}`;
  piece1.textContent = PIECE_SYMBOLS[toren];
  piece1.style.fontSize = '48px';
  choice1.appendChild(piece1);

  const label1 = document.createElement('div');
  label1.textContent = t('onlyRook');
  label1.style.cssText = 'font-size:12px;margin-top:5px;color:white;';
  choice1.appendChild(label1);

  choice1.onclick = () => {
    document.getElementById('castlingChoiceOverlay')?.remove();
    executeCastling(fromRow, fromCol, toRow, toCol, castleType.replace('-choice', '') as MoveType);
  };
  choicesDiv.appendChild(choice1);

  // Option 2: Both pieces
  const choice2 = document.createElement('div');
  choice2.className = 'promotion-choice';
  choice2.style.cssText = 'width:120px;height:100px;flex-direction:column;display:flex;justify-content:center;align-items:center;';

  const pieces2 = document.createElement('div');
  pieces2.style.cssText = 'display:flex;gap:5px;';

  const piece2a = document.createElement('div');
  piece2a.className = `piece ${isWhite ? 'piece-white' : 'piece-black'}`;
  piece2a.textContent = PIECE_SYMBOLS[toren];
  piece2a.style.fontSize = '36px';

  const piece2b = document.createElement('div');
  piece2b.className = `piece ${isWhite ? 'piece-white' : 'piece-black'}`;
  piece2b.textContent = PIECE_SYMBOLS[otherPiece];
  piece2b.style.fontSize = '36px';

  pieces2.appendChild(piece2a);
  pieces2.appendChild(piece2b);
  choice2.appendChild(pieces2);

  const label2 = document.createElement('div');
  label2.textContent = t('bothPieces');
  label2.style.cssText = 'font-size:12px;margin-top:5px;color:white;';
  choice2.appendChild(label2);

  choice2.onclick = () => {
    document.getElementById('castlingChoiceOverlay')?.remove();
    executeCastling(fromRow, fromCol, toRow, toCol, castleType.replace('-choice', '-both') as MoveType);
  };
  choicesDiv.appendChild(choice2);

  box.appendChild(choicesDiv);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function showEnPassantChoiceDialog(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
  const overlay = document.createElement('div');
  overlay.className = 'promotion-overlay';
  overlay.id = 'enPassantChoiceOverlay';

  const board = state.getBoard();
  const pieces = board[fromRow][fromCol].pieces;
  const isWhite = isWhitePiece(pieces[0]);
  const pawn = pieces.find(p => getPieceType(p) === 'p')!;
  const otherPiece = pieces.find(p => getPieceType(p) !== 'p')!;

  const box = document.createElement('div');
  box.className = 'promotion-box';

  const title = document.createElement('div');
  title.className = 'promotion-title';
  title.textContent = t('chooseMove');
  box.appendChild(title);

  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'promotion-pieces';
  choicesDiv.style.gap = '20px';

  // Option 1: En passant
  const choice1 = document.createElement('div');
  choice1.className = 'promotion-choice';
  choice1.style.cssText = 'width:140px;height:110px;flex-direction:column;display:flex;justify-content:center;align-items:center;';

  const pieces1 = document.createElement('div');
  pieces1.style.cssText = 'display:flex;gap:5px;';
  const piece1a = document.createElement('div');
  piece1a.className = `piece ${isWhite ? 'piece-white' : 'piece-black'}`;
  piece1a.textContent = PIECE_SYMBOLS[pawn];
  piece1a.style.fontSize = '48px';
  pieces1.appendChild(piece1a);
  choice1.appendChild(pieces1);

  const label1 = document.createElement('div');
  label1.textContent = t('enPassant');
  label1.style.cssText = 'font-size:12px;margin-top:5px;color:white;';
  choice1.appendChild(label1);

  const sublabel1 = document.createElement('div');
  sublabel1.textContent = t('pawnCaptures');
  sublabel1.style.cssText = 'font-size:10px;color:#64748b;';
  choice1.appendChild(sublabel1);

  choice1.onclick = () => {
    document.getElementById('enPassantChoiceOverlay')?.remove();
    movePiece(fromRow, fromCol, toRow, toCol, 'en-passant');
  };
  choicesDiv.appendChild(choice1);

  // Option 2: Normal move
  const choice2 = document.createElement('div');
  choice2.className = 'promotion-choice';
  choice2.style.cssText = 'width:140px;height:110px;flex-direction:column;display:flex;justify-content:center;align-items:center;';

  const pieces2 = document.createElement('div');
  pieces2.style.cssText = 'display:flex;gap:5px;';
  const piece2a = document.createElement('div');
  piece2a.className = `piece ${isWhite ? 'piece-white' : 'piece-black'}`;
  piece2a.textContent = PIECE_SYMBOLS[otherPiece];
  piece2a.style.fontSize = '48px';
  pieces2.appendChild(piece2a);
  choice2.appendChild(pieces2);

  const label2 = document.createElement('div');
  label2.textContent = t('normalMove');
  label2.style.cssText = 'font-size:12px;margin-top:5px;color:white;';
  choice2.appendChild(label2);

  const sublabel2 = document.createElement('div');
  sublabel2.textContent = `(${getPieceName(otherPiece)} ${t('moves_')})`;
  sublabel2.style.cssText = 'font-size:10px;color:#64748b;';
  choice2.appendChild(sublabel2);

  choice2.onclick = () => {
    document.getElementById('enPassantChoiceOverlay')?.remove();
    movePiece(fromRow, fromCol, toRow, toCol, 'normal');
  };
  choicesDiv.appendChild(choice2);

  box.appendChild(choicesDiv);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
