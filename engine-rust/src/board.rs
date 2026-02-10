/// Klikschaak Engine - Board Representation

use crate::types::*;

pub const STARTING_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

#[derive(Clone)]
pub struct Board {
    pub squares: [SquareStack; 64],
    pub turn: u8,
    pub castling: u8,
    pub ep_square: u8, // SQ_NONE if no ep
    pub halfmove_clock: u16,
    pub fullmove: u16,
    pub king_sq: [u8; 2], // [WHITE, BLACK]
    pub unmoved_pawns: [u8; 2], // bitmask per color
    pub zobrist_hash: u64,
}

impl Board {
    pub fn new() -> Self {
        Board {
            squares: [SquareStack::empty(); 64],
            turn: WHITE,
            castling: CR_ALL,
            ep_square: SQ_NONE,
            halfmove_clock: 0,
            fullmove: 1,
            king_sq: [SQ_E1, SQ_E8],
            unmoved_pawns: [0xFF, 0xFF],
            zobrist_hash: 0,
        }
    }

    pub fn from_fen(fen: &str) -> Self {
        let mut board = Board::new();
        board.set_fen(fen);
        board
    }

    pub fn startpos() -> Self {
        Board::from_fen(STARTING_FEN)
    }

    pub fn clear(&mut self) {
        self.squares = [SquareStack::empty(); 64];
        self.turn = WHITE;
        self.castling = CR_NONE;
        self.ep_square = SQ_NONE;
        self.halfmove_clock = 0;
        self.fullmove = 1;
        self.king_sq = [SQ_NONE, SQ_NONE];
        self.unmoved_pawns = [0x00, 0x00];
        self.zobrist_hash = 0;
    }

    // Piece access
    #[inline(always)]
    pub fn piece_at(&self, sq: u8) -> u8 {
        self.squares[sq as usize].top()
    }

    #[inline(always)]
    pub fn stack_at(&self, sq: u8) -> &SquareStack {
        &self.squares[sq as usize]
    }

    #[inline(always)]
    pub fn is_empty(&self, sq: u8) -> bool {
        self.squares[sq as usize].is_empty()
    }

    #[inline(always)]
    pub fn has_stack(&self, sq: u8) -> bool {
        self.squares[sq as usize].has_stack()
    }

    pub fn put_piece(&mut self, sq: u8, piece: u8) {
        self.squares[sq as usize] = SquareStack::single(piece);
        if piece_type(piece) == KING {
            self.king_sq[piece_color(piece) as usize] = sq;
        }
    }

    // FEN parsing
    pub fn set_fen(&mut self, fen: &str) {
        self.clear();

        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() < 4 { return; }

        // Board
        let mut rank: i8 = 7;
        let mut file: u8 = 0;
        let board_bytes = parts[0].as_bytes();
        let mut i = 0;

        while i < board_bytes.len() {
            let c = board_bytes[i] as char;

            if c == '/' {
                rank -= 1;
                file = 0;
            } else if c.is_ascii_digit() {
                file += (c as u8) - b'0';
            } else if c == '(' {
                // Stack notation: (Np)
                i += 1;
                let mut pieces = Vec::new();
                while i < board_bytes.len() && board_bytes[i] != b')' {
                    let pc = char_to_piece(board_bytes[i] as char);
                    if pc != NO_PIECE {
                        pieces.push(pc);
                    }
                    i += 1;
                }
                let sq = make_square(file, rank as u8);
                let idx = sq as usize;
                self.squares[idx] = SquareStack::empty();
                for &p in &pieces {
                    self.squares[idx].add(p);
                    if piece_type(p) == KING {
                        self.king_sq[piece_color(p) as usize] = sq;
                    }
                }
                file += 1;
            } else {
                let piece = char_to_piece(c);
                if piece != NO_PIECE {
                    let sq = make_square(file, rank as u8);
                    self.put_piece(sq, piece);
                    file += 1;
                }
            }

            i += 1;
        }

        // Side to move
        self.turn = if parts[1] == "w" { WHITE } else { BLACK };

        // Castling rights
        self.castling = CR_NONE;
        if parts[2].contains('K') { self.castling |= CR_W_KINGSIDE; }
        if parts[2].contains('Q') { self.castling |= CR_W_QUEENSIDE; }
        if parts[2].contains('k') { self.castling |= CR_B_KINGSIDE; }
        if parts[2].contains('q') { self.castling |= CR_B_QUEENSIDE; }

        // En passant
        if parts[3] != "-" {
            self.ep_square = parse_square(parts[3]);
        }

        // Halfmove clock and fullmove
        if parts.len() > 4 {
            self.halfmove_clock = parts[4].parse().unwrap_or(0);
        }
        if parts.len() > 5 {
            self.fullmove = parts[5].parse().unwrap_or(1);
        }

        // Initialize unmoved_pawns
        self.unmoved_pawns = [0x00, 0x00];
        for f in 0..8u8 {
            // White pawns on rank 1
            let sq_w = make_square(f, 1);
            let stack_w = &self.squares[sq_w as usize];
            for pi in 0..stack_w.count {
                if stack_w.pieces[pi as usize] == W_PAWN {
                    self.unmoved_pawns[WHITE as usize] |= 1 << f;
                    break;
                }
            }
            // Black pawns on rank 6
            let sq_b = make_square(f, 6);
            let stack_b = &self.squares[sq_b as usize];
            for pi in 0..stack_b.count {
                if stack_b.pieces[pi as usize] == B_PAWN {
                    self.unmoved_pawns[BLACK as usize] |= 1 << f;
                    break;
                }
            }
        }
    }

    pub fn get_fen(&self) -> String {
        let mut fen = String::new();

        // Board
        for rank in (0..8).rev() {
            let mut empty = 0u8;
            for file in 0..8u8 {
                let sq = make_square(file, rank);
                let stack = &self.squares[sq as usize];

                if stack.is_empty() {
                    empty += 1;
                } else {
                    if empty > 0 {
                        fen.push((b'0' + empty) as char);
                        empty = 0;
                    }
                    if stack.has_stack() {
                        fen.push('(');
                        for pi in 0..stack.count {
                            fen.push(piece_char(stack.pieces[pi as usize]));
                        }
                        fen.push(')');
                    } else {
                        fen.push(piece_char(stack.top()));
                    }
                }
            }
            if empty > 0 {
                fen.push((b'0' + empty) as char);
            }
            if rank > 0 {
                fen.push('/');
            }
        }

        // Side to move
        fen.push(' ');
        fen.push(if self.turn == WHITE { 'w' } else { 'b' });

        // Castling
        fen.push(' ');
        let mut castling_str = String::new();
        if self.castling & CR_W_KINGSIDE != 0 { castling_str.push('K'); }
        if self.castling & CR_W_QUEENSIDE != 0 { castling_str.push('Q'); }
        if self.castling & CR_B_KINGSIDE != 0 { castling_str.push('k'); }
        if self.castling & CR_B_QUEENSIDE != 0 { castling_str.push('q'); }
        if castling_str.is_empty() { castling_str.push('-'); }
        fen.push_str(&castling_str);

        // En passant
        fen.push(' ');
        if self.ep_square != SQ_NONE {
            fen.push_str(&square_name(self.ep_square));
        } else {
            fen.push('-');
        }

        // Halfmove clock and fullmove
        fen.push(' ');
        fen.push_str(&self.halfmove_clock.to_string());
        fen.push(' ');
        fen.push_str(&self.fullmove.to_string());

        fen
    }

    pub fn display(&self) -> String {
        let mut lines = Vec::new();
        lines.push("  +-----------------+".to_string());

        for rank in (0..8).rev() {
            let mut line = format!("{} | ", rank + 1);
            for file in 0..8u8 {
                let sq = make_square(file, rank);
                let stack = &self.squares[sq as usize];

                if stack.is_empty() {
                    line.push_str(". ");
                } else if stack.has_stack() {
                    line.push(piece_char(stack.bottom()));
                    let tc = piece_char(stack.top());
                    line.push(tc.to_ascii_lowercase());
                } else {
                    line.push(piece_char(stack.top()));
                    line.push(' ');
                }
            }
            line.push('|');
            lines.push(line);
        }

        lines.push("  +-----------------+".to_string());
        lines.push("    a b c d e f g h".to_string());
        lines.push(format!("\nTurn: {}", if self.turn == WHITE { "White" } else { "Black" }));
        lines.push(format!("FEN: {}", self.get_fen()));

        lines.join("\n")
    }
}

impl std::fmt::Display for Board {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display())
    }
}

impl std::fmt::Debug for Board {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Board('{}')", self.get_fen())
    }
}
