import type { Language, Translations } from '../game/types';

export const translations: Record<Language, Translations> = {
  nl: {
    title: 'Klikschaak',
    subtitle: 'Combineer stukken voor strategische dominantie',
    newGame: 'Nieuw Spel',
    whiteToMove: 'Wit aan zet',
    blackToMove: 'Zwart aan zet',
    moves: 'Zetten',
    noMoves: 'Nog geen zetten',
    gameRules: 'Spelregels',
    klik: 'Klikken:',
    unklik: 'Ontklikken:',
    kingWarning: 'Koning mag NOOIT klikken!',
    promotionTip: 'Promotie: alleen met een pionzet!',
    autoPromote: 'Automatisch promoveren tot dame',
    selected: 'Geselecteerd',
    possibleMoves: 'mogelijke zetten',
    choosePromotion: 'Kies een stuk voor promotie:',
    chooseCastling: 'Kies rokade optie:',
    onlyRook: 'Alleen toren',
    bothPieces: 'Beide stukken',
    chooseMove: 'Kies zet type:',
    enPassant: 'En passant',
    normalMove: 'Normale zet',
    pawnCaptures: '(pion slaat)',
    moves_: 'beweegt',
    checkmate: 'Schaakmat!',
    stalemate: 'Pat!',
    check: 'SCHAAK!',
    wins: 'wint!',
    draw: 'Remise',
    gameEndsDraw: 'Het spel eindigt in remise',
    analysis: 'Analyse',
    analysisMode: 'Analysemodus',
    boardEditor: 'Bord Editor',
    exitEditor: 'Verlaat Editor',
    exportPGN: 'Exporteer PGN',
    importPGN: 'Importeer PGN',
    playFromHere: 'Speel vanaf hier',
    backToGame: 'Terug naar Spel',
    pieces: 'Stukken',
    turnToMove: 'Aan zet',
    white: 'Wit',
    black: 'Zwart',
    clearBoard: 'Leeg Bord',
    standardPosition: 'Start Positie',
    loadFEN: 'Laad',
    copyFEN: 'Kopieer',
    copied: 'Gekopieerd!',
    invalidFEN: 'Ongeldige FEN',
    invalidPosition: 'Ongeldige positie',
    copyToClipboard: 'Kopieer naar Klembord',
    downloadFile: 'Download Bestand',
    close: 'Sluiten',
    loadPGN: 'Laad PGN',
    cancel: 'Annuleren',
    pasteHere: 'Plak hier...',
    chooseFile: 'Kies Bestand',
  },
  en: {
    title: 'Clickchess',
    subtitle: 'Combine pieces for strategic dominance',
    newGame: 'New Game',
    whiteToMove: 'White to move',
    blackToMove: 'Black to move',
    moves: 'Moves',
    noMoves: 'No moves yet',
    gameRules: 'Game Rules',
    klik: 'Click:',
    unklik: 'Unclick:',
    kingWarning: 'King may NEVER click!',
    promotionTip: 'Promotion: only with a pawn move!',
    autoPromote: 'Auto-promote to queen',
    selected: 'Selected',
    possibleMoves: 'possible moves',
    choosePromotion: 'Choose a piece for promotion:',
    chooseCastling: 'Choose castling option:',
    onlyRook: 'Only rook',
    bothPieces: 'Both pieces',
    chooseMove: 'Choose move type:',
    enPassant: 'En passant',
    normalMove: 'Normal move',
    pawnCaptures: '(pawn captures)',
    moves_: 'moves',
    checkmate: 'Checkmate!',
    stalemate: 'Stalemate!',
    check: 'CHECK!',
    wins: 'wins!',
    draw: 'Draw',
    gameEndsDraw: 'The game ends in a draw',
    analysis: 'Analysis',
    analysisMode: 'Analysis Mode',
    boardEditor: 'Board Editor',
    exitEditor: 'Exit Editor',
    exportPGN: 'Export PGN',
    importPGN: 'Import PGN',
    playFromHere: 'Play from here',
    backToGame: 'Back to Game',
    pieces: 'Pieces',
    turnToMove: 'Turn to move',
    white: 'White',
    black: 'Black',
    clearBoard: 'Clear Board',
    standardPosition: 'Standard Position',
    loadFEN: 'Load',
    copyFEN: 'Copy',
    copied: 'Copied!',
    invalidFEN: 'Invalid FEN',
    invalidPosition: 'Invalid position',
    copyToClipboard: 'Copy to Clipboard',
    downloadFile: 'Download File',
    close: 'Close',
    loadPGN: 'Load PGN',
    cancel: 'Cancel',
    pasteHere: 'Paste here...',
    chooseFile: 'Choose File',
  },
};

let currentLanguage: Language = 'nl';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  localStorage.setItem('klikschaak-language', lang);
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function initLanguage(): void {
  const saved = localStorage.getItem('klikschaak-language') as Language | null;
  if (saved && (saved === 'nl' || saved === 'en')) {
    currentLanguage = saved;
  } else {
    // Detect browser language
    const browserLang = navigator.language.slice(0, 2);
    currentLanguage = browserLang === 'nl' ? 'nl' : 'en';
  }
}

export function t(key: keyof Translations): string {
  return translations[currentLanguage][key];
}

export function getPieceName(piece: string): string {
  // Import is done at runtime to avoid circular dependency
  // PIECE_NAMES is a static mapping, so we inline it here
  const names: Record<Language, Record<string, string>> = {
    nl: {
      K: 'Koning', Q: 'Dame', R: 'Toren', B: 'Loper', N: 'Paard', P: 'Pion',
      k: 'koning', q: 'dame', r: 'toren', b: 'loper', n: 'paard', p: 'pion',
    },
    en: {
      K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
      k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
    },
  };
  // Handle pawn IDs (P0-P7, p0-p7)
  const baseType = piece.charAt(0);
  return names[currentLanguage][baseType] || piece;
}
