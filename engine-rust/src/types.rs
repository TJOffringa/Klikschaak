/// Klikschaak Engine - Type Definitions

// Colors
pub const WHITE: u8 = 0;
pub const BLACK: u8 = 1;

#[inline(always)]
pub fn opposite_color(c: u8) -> u8 {
    c ^ 1
}

// Piece types (without color)
pub const NONE: u8 = 0;
pub const PAWN: u8 = 1;
pub const KNIGHT: u8 = 2;
pub const BISHOP: u8 = 3;
pub const ROOK: u8 = 4;
pub const QUEEN: u8 = 5;
pub const KING: u8 = 6;

// Pieces (with color encoded: white 1-6, black 9-14)
pub const NO_PIECE: u8 = 0;
pub const W_PAWN: u8 = 1;
pub const W_KNIGHT: u8 = 2;
pub const W_BISHOP: u8 = 3;
pub const W_ROOK: u8 = 4;
pub const W_QUEEN: u8 = 5;
pub const W_KING: u8 = 6;
pub const B_PAWN: u8 = 9;
pub const B_KNIGHT: u8 = 10;
pub const B_BISHOP: u8 = 11;
pub const B_ROOK: u8 = 12;
pub const B_QUEEN: u8 = 13;
pub const B_KING: u8 = 14;

#[inline(always)]
pub fn piece_color(p: u8) -> u8 {
    if p == NO_PIECE { return WHITE; }
    if p < 8 { WHITE } else { BLACK }
}

#[inline(always)]
pub fn piece_type(p: u8) -> u8 {
    if p == NO_PIECE { return NONE; }
    p & 7
}

#[inline(always)]
pub fn make_piece(color: u8, pt: u8) -> u8 {
    pt + if color == BLACK { 8 } else { 0 }
}

// Square representation (0-63, a1=0, h8=63)
pub const SQ_NONE: u8 = 64;

pub const SQ_A1: u8 = 0;
pub const SQ_B1: u8 = 1;
pub const SQ_C1: u8 = 2;
pub const SQ_D1: u8 = 3;
pub const SQ_E1: u8 = 4;
pub const SQ_F1: u8 = 5;
pub const SQ_G1: u8 = 6;
pub const SQ_H1: u8 = 7;
pub const SQ_A8: u8 = 56;
pub const SQ_B8: u8 = 57;
pub const SQ_C8: u8 = 58;
pub const SQ_D8: u8 = 59;
pub const SQ_E8: u8 = 60;
pub const SQ_F8: u8 = 61;
pub const SQ_G8: u8 = 62;
pub const SQ_H8: u8 = 63;

#[inline(always)]
pub fn square_file(sq: u8) -> u8 {
    sq & 7
}

#[inline(always)]
pub fn square_rank(sq: u8) -> u8 {
    sq >> 3
}

#[inline(always)]
pub fn make_square(file: u8, rank: u8) -> u8 {
    rank * 8 + file
}

pub fn square_name(sq: u8) -> String {
    if sq == SQ_NONE { return "-".to_string(); }
    let f = (b'a' + square_file(sq)) as char;
    let r = (b'1' + square_rank(sq)) as char;
    format!("{}{}", f, r)
}

pub fn parse_square(name: &str) -> u8 {
    let bytes = name.as_bytes();
    if bytes.len() != 2 { return SQ_NONE; }
    let file = bytes[0].wrapping_sub(b'a');
    let rank = bytes[1].wrapping_sub(b'1');
    if file < 8 && rank < 8 {
        make_square(file, rank)
    } else {
        SQ_NONE
    }
}

// Move types
pub const MT_NORMAL: u8 = 0;
pub const MT_CAPTURE: u8 = 1;
pub const MT_KLIK: u8 = 2;
pub const MT_UNKLIK: u8 = 3;
pub const MT_UNKLIK_KLIK: u8 = 4;
pub const MT_EN_PASSANT: u8 = 5;
pub const MT_CASTLE_K: u8 = 6;
pub const MT_CASTLE_Q: u8 = 7;
pub const MT_CASTLE_K_KLIK: u8 = 8;
pub const MT_CASTLE_Q_KLIK: u8 = 9;
pub const MT_PROMOTION: u8 = 10;
pub const MT_PROMOTION_CAPTURE: u8 = 11;
pub const MT_PROMOTION_KLIK: u8 = 12;

pub fn move_type_name(mt: u8) -> &'static str {
    match mt {
        MT_NORMAL => "NORMAL",
        MT_CAPTURE => "CAPTURE",
        MT_KLIK => "KLIK",
        MT_UNKLIK => "UNKLIK",
        MT_UNKLIK_KLIK => "UNKLIK_KLIK",
        MT_EN_PASSANT => "EN_PASSANT",
        MT_CASTLE_K => "CASTLE_K",
        MT_CASTLE_Q => "CASTLE_Q",
        MT_CASTLE_K_KLIK => "CASTLE_K_KLIK",
        MT_CASTLE_Q_KLIK => "CASTLE_Q_KLIK",
        MT_PROMOTION => "PROMOTION",
        MT_PROMOTION_CAPTURE => "PROMOTION_CAPTURE",
        MT_PROMOTION_KLIK => "PROMOTION_KLIK",
        _ => "UNKNOWN",
    }
}

// Castling rights (bitmask)
pub const CR_NONE: u8 = 0;
pub const CR_W_KINGSIDE: u8 = 1;
pub const CR_W_QUEENSIDE: u8 = 2;
pub const CR_B_KINGSIDE: u8 = 4;
pub const CR_B_QUEENSIDE: u8 = 8;
pub const CR_WHITE: u8 = CR_W_KINGSIDE | CR_W_QUEENSIDE;
pub const CR_BLACK: u8 = CR_B_KINGSIDE | CR_B_QUEENSIDE;
pub const CR_ALL: u8 = CR_WHITE | CR_BLACK;

// Move representation
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct Move {
    pub from_sq: u8,
    pub to_sq: u8,
    pub move_type: u8,
    pub unklik_index: i8,
    pub promotion: u8,
}

impl Move {
    #[inline]
    pub fn new(from_sq: u8, to_sq: u8, move_type: u8) -> Self {
        Move { from_sq, to_sq, move_type, unklik_index: 0, promotion: NONE }
    }

    #[inline]
    pub fn with_unklik(from_sq: u8, to_sq: u8, move_type: u8, unklik_index: i8) -> Self {
        Move { from_sq, to_sq, move_type, unklik_index, promotion: NONE }
    }

    #[inline]
    pub fn with_promotion(from_sq: u8, to_sq: u8, move_type: u8, promotion: u8) -> Self {
        Move { from_sq, to_sq, move_type, unklik_index: 0, promotion }
    }

    #[inline]
    pub fn with_unklik_promotion(from_sq: u8, to_sq: u8, move_type: u8, unklik_index: i8, promotion: u8) -> Self {
        Move { from_sq, to_sq, move_type, unklik_index, promotion }
    }

    pub fn to_uci(&self) -> String {
        let mut s = format!("{}{}", square_name(self.from_sq), square_name(self.to_sq));

        if self.promotion != NONE {
            let promo_char = match self.promotion {
                KNIGHT => 'n',
                BISHOP => 'b',
                ROOK => 'r',
                QUEEN => 'q',
                _ => '?',
            };
            s.push(promo_char);
        }

        match self.move_type {
            MT_KLIK => s.push('k'),
            MT_UNKLIK | MT_UNKLIK_KLIK => {
                s.push_str(&format!("u{}", self.unklik_index));
            }
            _ => {}
        }

        s
    }
}

impl std::fmt::Display for Move {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Move({})", self.to_uci())
    }
}

// Square stack (max 2 pieces)
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct SquareStack {
    pub pieces: [u8; 2],
    pub count: u8,
}

impl SquareStack {
    #[inline(always)]
    pub const fn empty() -> Self {
        SquareStack { pieces: [NO_PIECE, NO_PIECE], count: 0 }
    }

    #[inline(always)]
    pub fn single(piece: u8) -> Self {
        SquareStack { pieces: [piece, NO_PIECE], count: 1 }
    }

    #[inline(always)]
    pub fn double(bottom: u8, top: u8) -> Self {
        SquareStack { pieces: [bottom, top], count: 2 }
    }

    #[inline(always)]
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    #[inline(always)]
    pub fn has_stack(&self) -> bool {
        self.count == 2
    }

    #[inline(always)]
    pub fn top(&self) -> u8 {
        if self.count == 0 { NO_PIECE }
        else { self.pieces[(self.count - 1) as usize] }
    }

    #[inline(always)]
    pub fn bottom(&self) -> u8 {
        if self.count == 0 { NO_PIECE }
        else { self.pieces[0] }
    }

    #[inline(always)]
    pub fn add(&mut self, piece: u8) {
        if self.count < 2 {
            self.pieces[self.count as usize] = piece;
            self.count += 1;
        }
    }

    #[inline(always)]
    pub fn remove_top(&mut self) -> u8 {
        if self.count == 0 { return NO_PIECE; }
        self.count -= 1;
        let p = self.pieces[self.count as usize];
        self.pieces[self.count as usize] = NO_PIECE;
        p
    }

    #[inline]
    pub fn remove_at(&mut self, index: u8) -> u8 {
        if index >= self.count { return NO_PIECE; }
        let p = self.pieces[index as usize];
        if index == 0 && self.count == 2 {
            // Shift top piece down
            self.pieces[0] = self.pieces[1];
            self.pieces[1] = NO_PIECE;
        } else {
            self.pieces[index as usize] = NO_PIECE;
        }
        self.count -= 1;
        p
    }

    #[inline(always)]
    pub fn clear(&mut self) {
        self.pieces = [NO_PIECE, NO_PIECE];
        self.count = 0;
    }
}

impl std::fmt::Debug for SquareStack {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.count == 0 {
            write!(f, "[]")
        } else if self.count == 1 {
            write!(f, "[{}]", piece_char(self.pieces[0]))
        } else {
            write!(f, "[{}, {}]", piece_char(self.pieces[0]), piece_char(self.pieces[1]))
        }
    }
}

// Piece characters
pub fn piece_char(p: u8) -> char {
    match p {
        NO_PIECE => '.',
        W_PAWN => 'P', W_KNIGHT => 'N', W_BISHOP => 'B',
        W_ROOK => 'R', W_QUEEN => 'Q', W_KING => 'K',
        B_PAWN => 'p', B_KNIGHT => 'n', B_BISHOP => 'b',
        B_ROOK => 'r', B_QUEEN => 'q', B_KING => 'k',
        _ => '?',
    }
}

pub fn char_to_piece(c: char) -> u8 {
    match c {
        'P' => W_PAWN, 'N' => W_KNIGHT, 'B' => W_BISHOP,
        'R' => W_ROOK, 'Q' => W_QUEEN, 'K' => W_KING,
        'p' => B_PAWN, 'n' => B_KNIGHT, 'b' => B_BISHOP,
        'r' => B_ROOK, 'q' => B_QUEEN, 'k' => B_KING,
        _ => NO_PIECE,
    }
}

// Piece values for evaluation
pub const PIECE_VALUES: [i32; 7] = [
    0,      // NONE
    100,    // PAWN
    320,    // KNIGHT
    330,    // BISHOP
    500,    // ROOK
    900,    // QUEEN
    20000,  // KING
];
