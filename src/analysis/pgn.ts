import type { MoveHistoryEntry, PieceColor } from '../game/types.js';

export interface PGNData {
  event: string;
  site: string;
  date: string;
  round: string;
  white: string;
  black: string;
  result: string;
  variant: string;
  fen?: string;
  moves: MoveHistoryEntry[];
}

// Export game to PGN format
export function exportToPGN(data: {
  moves: MoveHistoryEntry[];
  white?: string;
  black?: string;
  result?: string;
  fen?: string;
}): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '.');

  const headers: string[] = [
    `[Event "Klikschaak Game"]`,
    `[Site "Klikschaak Online"]`,
    `[Date "${dateStr}"]`,
    `[Round "-"]`,
    `[White "${data.white || 'Player 1'}"]`,
    `[Black "${data.black || 'Player 2'}"]`,
    `[Result "${data.result || '*'}"]`,
    `[Variant "Klikschaak"]`,
  ];

  if (data.fen) {
    headers.push(`[FEN "${data.fen}"]`);
    headers.push(`[SetUp "1"]`);
  }

  // Format moves
  const moveText = formatMoves(data.moves);

  return headers.join('\n') + '\n\n' + moveText + ' ' + (data.result || '*');
}

// Format moves in PGN notation
function formatMoves(moves: MoveHistoryEntry[]): string {
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = moves[i]?.notation || '';
    const blackMove = moves[i + 1]?.notation || '';

    let moveStr = `${moveNum}. ${whiteMove}`;
    if (blackMove) {
      moveStr += ` ${blackMove}`;
    }

    if (currentLine.length + moveStr.length > 75) {
      lines.push(currentLine.trim());
      currentLine = moveStr + ' ';
    } else {
      currentLine += moveStr + ' ';
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join('\n');
}

// Parse PGN and extract game data
export function parsePGN(pgn: string): PGNData | null {
  try {
    const lines = pgn.trim().split('\n');
    const headers: Record<string, string> = {};
    let moveSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Header line
        const match = trimmed.match(/\[(\w+)\s+"(.*)"\]/);
        if (match) {
          headers[match[1].toLowerCase()] = match[2];
        }
      } else if (trimmed.length > 0) {
        // Move section
        moveSection += ' ' + trimmed;
      }
    }

    // Parse moves
    const moves = parseMoveSection(moveSection);

    return {
      event: headers['event'] || 'Unknown',
      site: headers['site'] || 'Unknown',
      date: headers['date'] || '',
      round: headers['round'] || '-',
      white: headers['white'] || 'White',
      black: headers['black'] || 'Black',
      result: headers['result'] || '*',
      variant: headers['variant'] || 'Standard',
      fen: headers['fen'],
      moves,
    };
  } catch (error) {
    console.error('Error parsing PGN:', error);
    return null;
  }
}

// Parse the move section of PGN
function parseMoveSection(moveSection: string): MoveHistoryEntry[] {
  const moves: MoveHistoryEntry[] = [];

  // Remove result markers and clean up
  let cleaned = moveSection
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, '')
    .replace(/\{[^}]*\}/g, '') // Remove comments
    .replace(/\([^)]*\)/g, '') // Remove variations
    .replace(/\$\d+/g, '') // Remove NAGs
    .trim();

  // Split into tokens
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

  let currentTurn: PieceColor = 'white';

  for (const token of tokens) {
    // Skip move numbers (e.g., "1.", "2.", etc.)
    if (/^\d+\.+$/.test(token)) {
      currentTurn = 'white';
      continue;
    }

    // Skip if it looks like a move number with move (e.g., "1.e4")
    const moveMatch = token.match(/^(\d+)\.(.*)/);
    if (moveMatch && moveMatch[2]) {
      currentTurn = 'white';
      moves.push({ turn: currentTurn, notation: moveMatch[2] });
      currentTurn = 'black';
      continue;
    }

    // Regular move
    if (token.length > 0 && !token.match(/^\d+$/)) {
      moves.push({ turn: currentTurn, notation: token });
      currentTurn = currentTurn === 'white' ? 'black' : 'white';
    }
  }

  return moves;
}

// Download PGN as file
export function downloadPGN(pgn: string, filename: string = 'game.pgn'): void {
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy PGN to clipboard
export async function copyPGNToClipboard(pgn: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(pgn);
    return true;
  } catch {
    return false;
  }
}

// Load PGN from file input
export function loadPGNFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
