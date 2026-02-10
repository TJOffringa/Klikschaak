/// Klikschaak Engine - Move Generation

use crate::types::*;
use crate::board::Board;
use crate::search::ZOBRIST;

// Direction offsets
const KNIGHT_OFFSETS: [i8; 8] = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING_OFFSETS: [i8; 8] = [-9, -8, -7, -1, 1, 7, 8, 9];
const BISHOP_DIRECTIONS: [i8; 4] = [-9, -7, 7, 9];
const ROOK_DIRECTIONS: [i8; 4] = [-8, -1, 1, 8];

// Pre-computed move tables
struct MoveTables {
    knight: [[u8; 8]; 64], // targets, 0xFF = end sentinel
    knight_count: [u8; 64],
    king: [[u8; 8]; 64],
    king_count: [u8; 64],
}

static MOVE_TABLES: std::sync::LazyLock<MoveTables> = std::sync::LazyLock::new(|| {
    let mut tables = MoveTables {
        knight: [[0xFF; 8]; 64],
        knight_count: [0; 64],
        king: [[0xFF; 8]; 64],
        king_count: [0; 64],
    };

    for sq in 0..64i8 {
        let f = sq & 7;
        let r = sq >> 3;
        let mut ki = 0usize;
        for &offset in &KNIGHT_OFFSETS {
            let to = sq + offset;
            if (0..64).contains(&to) {
                let tf = to & 7;
                let tr = to >> 3;
                if (f - tf).abs() <= 2 && (r - tr).abs() <= 2 {
                    tables.knight[sq as usize][ki] = to as u8;
                    ki += 1;
                }
            }
        }
        tables.knight_count[sq as usize] = ki as u8;

        let mut kii = 0usize;
        for &offset in &KING_OFFSETS {
            let to = sq + offset;
            if (0..64).contains(&to) {
                let tf = to & 7;
                let tr = to >> 3;
                if (f - tf).abs() <= 1 && (r - tr).abs() <= 1 {
                    tables.king[sq as usize][kii] = to as u8;
                    kii += 1;
                }
            }
        }
        tables.king_count[sq as usize] = kii as u8;
    }

    tables
});

fn knight_targets(sq: u8) -> &'static [u8] {
    let t = &*MOVE_TABLES;
    &t.knight[sq as usize][..t.knight_count[sq as usize] as usize]
}

fn king_targets(sq: u8) -> &'static [u8] {
    let t = &*MOVE_TABLES;
    &t.king[sq as usize][..t.king_count[sq as usize] as usize]
}

// Undo info for make/unmake
#[derive(Clone)]
pub struct UndoInfo {
    pub modified: Vec<(u8, SquareStack)>, // (sq, old_stack)
    pub castling: u8,
    pub ep_square: u8,
    pub halfmove_clock: u16,
    pub king_sq: [u8; 2],
    pub fullmove: u16,
    pub unmoved_pawns: [u8; 2],
    pub zobrist_hash: u64,
}

impl UndoInfo {
    fn new() -> Self {
        UndoInfo {
            modified: Vec::with_capacity(4),
            castling: 0,
            ep_square: SQ_NONE,
            halfmove_clock: 0,
            king_sq: [0, 0],
            fullmove: 1,
            unmoved_pawns: [0xFF, 0xFF],
            zobrist_hash: 0,
        }
    }
}

fn sliding_moves(board: &Board, sq: u8, directions: &[i8]) -> Vec<u8> {
    let mut moves = Vec::with_capacity(14);

    for &direction in directions {
        let mut current = sq as i8;
        loop {
            let prev = current;
            current += direction;
            if !(0..64).contains(&current) { break; }
            if ((current & 7) - (prev & 7)).abs() > 1 { break; }

            moves.push(current as u8);

            if board.squares[current as usize].count > 0 { break; }
        }
    }

    moves
}

fn pawn_moves(board: &Board, sq: u8, color: u8, captures_only: bool, include_klik: bool) -> Vec<(u8, u8)> {
    let mut moves = Vec::with_capacity(8);
    let direction: i8 = if color == WHITE { 1 } else { -1 };
    let start_rank: u8 = if color == WHITE { 1 } else { 6 };
    let promo_rank: u8 = if color == WHITE { 7 } else { 0 };
    let rank = square_rank(sq);
    let file = square_file(sq);

    if !captures_only {
        // Forward move
        let one_forward = sq as i8 + 8 * direction;
        if (0..64).contains(&one_forward) {
            let one_fwd = one_forward as u8;
            let fwd_stack = &board.squares[one_fwd as usize];
            if fwd_stack.count == 0 {
                // Empty square
                if square_rank(one_fwd) == promo_rank {
                    moves.push((one_fwd, MT_PROMOTION));
                } else {
                    moves.push((one_fwd, MT_NORMAL));

                    // Double move from start
                    if rank == start_rank && (board.unmoved_pawns[color as usize] & (1 << file)) != 0 {
                        let two_forward = sq as i8 + 16 * direction;
                        if (0..64).contains(&two_forward) {
                            let two_fwd = two_forward as u8;
                            let two_stack = &board.squares[two_fwd as usize];
                            if two_stack.count == 0 {
                                moves.push((two_fwd, MT_NORMAL));
                            } else if include_klik && two_stack.count < 2
                                && piece_color(two_stack.top()) == color
                                && piece_type(two_stack.top()) != KING
                            {
                                moves.push((two_fwd, MT_KLIK));
                            }
                        }
                    }
                }
            } else if include_klik && fwd_stack.count < 2
                && piece_color(fwd_stack.top()) == color
                && piece_type(fwd_stack.top()) != KING
            {
                // Forward klik (not to promo rank)
                if square_rank(one_fwd) != promo_rank {
                    moves.push((one_fwd, MT_KLIK));
                }
            }
        }
    }

    // Captures (diagonal)
    for df in [-1i8, 1] {
        let to_file = file as i8 + df;
        if !(0..8).contains(&to_file) { continue; }

        let to_sq = sq as i8 + 8 * direction + df;
        if !(0..64).contains(&to_sq) { continue; }
        let to = to_sq as u8;
        let target_rank = square_rank(to);

        let target_stack = &board.squares[to as usize];
        if target_stack.count > 0 {
            let target_color = piece_color(target_stack.top());
            if target_color != color {
                if target_rank == promo_rank {
                    moves.push((to, MT_PROMOTION_CAPTURE));
                } else {
                    moves.push((to, MT_CAPTURE));
                }
            }
        }

        // En passant
        if to == board.ep_square {
            moves.push((to, MT_EN_PASSANT));
        }
    }

    moves
}

fn generate_piece_moves(board: &Board, sq: u8, piece: u8, include_klik: bool, captures_only: bool) -> Vec<Move> {
    let mut moves = Vec::with_capacity(32);
    let color = piece_color(piece);
    let pt = piece_type(piece);

    if pt == PAWN {
        for (to_sq, move_type) in pawn_moves(board, sq, color, captures_only, include_klik) {
            if move_type == MT_PROMOTION || move_type == MT_PROMOTION_CAPTURE {
                for &promo in &[QUEEN, ROOK, BISHOP, KNIGHT] {
                    moves.push(Move::with_promotion(sq, to_sq, move_type, promo));
                }
            } else {
                moves.push(Move::new(sq, to_sq, move_type));
            }
        }
        return moves;
    }

    let targets: Vec<u8> = match pt {
        KNIGHT => knight_targets(sq).to_vec(),
        BISHOP => sliding_moves(board, sq, &BISHOP_DIRECTIONS),
        ROOK => sliding_moves(board, sq, &ROOK_DIRECTIONS),
        QUEEN => {
            let mut t = sliding_moves(board, sq, &BISHOP_DIRECTIONS);
            t.extend(sliding_moves(board, sq, &ROOK_DIRECTIONS));
            t
        }
        KING => king_targets(sq).to_vec(),
        _ => return moves,
    };

    for to_sq in targets {
        let target_stack = &board.squares[to_sq as usize];

        if target_stack.count == 0 {
            if !captures_only {
                moves.push(Move::new(sq, to_sq, MT_NORMAL));
            }
        } else if piece_color(target_stack.top()) != color {
            moves.push(Move::new(sq, to_sq, MT_CAPTURE));
        } else if !captures_only && include_klik && target_stack.count < 2 {
            if pt != KING && piece_type(target_stack.top()) != KING {
                moves.push(Move::new(sq, to_sq, MT_KLIK));
            }
        }
    }

    moves
}

fn generate_combined_moves(board: &Board, sq: u8, pieces: &[u8], captures_only: bool) -> Vec<Move> {
    let mut moves = Vec::with_capacity(32);
    let color = piece_color(pieces[0]);

    let mut has_pawn = false;
    for &p in pieces {
        if piece_type(p) == PAWN {
            has_pawn = true;
            break;
        }
    }

    let back_rank: u8 = if color == WHITE { 0 } else { 7 };
    let promo_rank: u8 = if color == WHITE { 7 } else { 0 };

    let mut all_targets = std::collections::HashSet::new();
    let mut pawn_targets = std::collections::HashSet::new();

    for &piece in pieces {
        let pt = piece_type(piece);
        if pt == PAWN {
            let direction: i8 = if color == WHITE { 1 } else { -1 };
            let start_rank: u8 = if color == WHITE { 1 } else { 6 };
            let rank = square_rank(sq);
            let file = square_file(sq);

            if !captures_only {
                let one_forward = sq as i8 + 8 * direction;
                if (0..64).contains(&one_forward) {
                    let one_fwd = one_forward as u8;
                    if board.squares[one_fwd as usize].count == 0 {
                        pawn_targets.insert(one_fwd);
                        all_targets.insert(one_fwd);

                        if rank == start_rank && (board.unmoved_pawns[color as usize] & (1 << file)) != 0 {
                            let two_forward = sq as i8 + 16 * direction;
                            if (0..64).contains(&two_forward) {
                                let two_fwd = two_forward as u8;
                                if board.squares[two_fwd as usize].count == 0 {
                                    pawn_targets.insert(two_fwd);
                                    all_targets.insert(two_fwd);
                                }
                            }
                        }
                    }
                }
            }

            // Diagonal captures
            let file_i = file as i8;
            for df in [-1i8, 1] {
                let to_file = file_i + df;
                if (0..8).contains(&to_file) {
                    let direction_i: i8 = if color == WHITE { 1 } else { -1 };
                    let to_sq = sq as i8 + 8 * direction_i + df;
                    if (0..64).contains(&to_sq) {
                        let to = to_sq as u8;
                        let target_stack = &board.squares[to as usize];
                        if target_stack.count > 0 && piece_color(target_stack.top()) != color {
                            pawn_targets.insert(to);
                            all_targets.insert(to);
                        }
                        if to == board.ep_square {
                            pawn_targets.insert(to);
                            all_targets.insert(to);
                        }
                    }
                }
            }
        } else {
            let targets: Vec<u8> = match pt {
                KNIGHT => knight_targets(sq).to_vec(),
                BISHOP => sliding_moves(board, sq, &BISHOP_DIRECTIONS),
                ROOK => sliding_moves(board, sq, &ROOK_DIRECTIONS),
                QUEEN => {
                    let mut t = sliding_moves(board, sq, &BISHOP_DIRECTIONS);
                    t.extend(sliding_moves(board, sq, &ROOK_DIRECTIONS));
                    t
                }
                KING => king_targets(sq).to_vec(),
                _ => Vec::new(),
            };
            for t in targets {
                all_targets.insert(t);
            }
        }
    }

    for to_sq in all_targets {
        let to_rank = square_rank(to_sq);
        let target_stack = &board.squares[to_sq as usize];

        // Back rank restriction
        if has_pawn && to_rank == back_rank { continue; }

        // Carried-to-promo restriction
        if has_pawn && to_rank == promo_rank {
            if !pawn_targets.contains(&to_sq) { continue; }
            // Combined promotion
            if target_stack.count == 0 {
                for &promo in &[QUEEN, ROOK, BISHOP, KNIGHT] {
                    moves.push(Move::with_unklik_promotion(sq, to_sq, MT_PROMOTION, -1, promo));
                }
            } else if piece_color(target_stack.top()) != color {
                for &promo in &[QUEEN, ROOK, BISHOP, KNIGHT] {
                    moves.push(Move::with_unklik_promotion(sq, to_sq, MT_PROMOTION_CAPTURE, -1, promo));
                }
            }
            continue;
        }

        // En passant (combined)
        if to_sq == board.ep_square && pawn_targets.contains(&to_sq) {
            moves.push(Move::with_unklik(sq, to_sq, MT_EN_PASSANT, -1));
            continue;
        }

        if target_stack.count == 0 {
            if !captures_only {
                moves.push(Move::new(sq, to_sq, MT_NORMAL));
            }
        } else if piece_color(target_stack.top()) != color {
            moves.push(Move::new(sq, to_sq, MT_CAPTURE));
        }
        // Friendly piece: can't klik as combined (would exceed 2 piece max)
    }

    moves
}

fn generate_unklik_moves(board: &Board, sq: u8, piece_idx: u8, piece: u8, captures_only: bool) -> Vec<Move> {
    let mut moves = Vec::with_capacity(32);
    let color = piece_color(piece);
    let pt = piece_type(piece);
    let idx = piece_idx as i8;

    if pt == PAWN {
        for (to_sq, base_type) in pawn_moves(board, sq, color, captures_only, true) {
            let target_stack = &board.squares[to_sq as usize];

            if base_type == MT_EN_PASSANT {
                moves.push(Move::with_unklik(sq, to_sq, MT_EN_PASSANT, idx));
            } else if base_type == MT_PROMOTION || base_type == MT_PROMOTION_CAPTURE {
                let is_capture = target_stack.count > 0 && piece_color(target_stack.top()) != color;
                let mt = if is_capture { MT_PROMOTION_CAPTURE } else { MT_PROMOTION };
                for &promo in &[QUEEN, ROOK, BISHOP, KNIGHT] {
                    moves.push(Move::with_unklik_promotion(sq, to_sq, mt, idx, promo));
                }
            } else if target_stack.count == 0 {
                if !captures_only {
                    moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK, idx));
                }
            } else if piece_color(target_stack.top()) != color {
                moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK, idx));
            } else if !captures_only && target_stack.count < 2 && piece_type(target_stack.top()) != KING {
                let promo_rank: u8 = if color == WHITE { 7 } else { 0 };
                if square_rank(to_sq) != promo_rank {
                    moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK_KLIK, idx));
                }
            }
        }
        return moves;
    }

    let targets: Vec<u8> = match pt {
        KNIGHT => knight_targets(sq).to_vec(),
        BISHOP => sliding_moves(board, sq, &BISHOP_DIRECTIONS),
        ROOK => sliding_moves(board, sq, &ROOK_DIRECTIONS),
        QUEEN => {
            let mut t = sliding_moves(board, sq, &BISHOP_DIRECTIONS);
            t.extend(sliding_moves(board, sq, &ROOK_DIRECTIONS));
            t
        }
        KING => king_targets(sq).to_vec(),
        _ => return moves,
    };

    for to_sq in targets {
        let target_stack = &board.squares[to_sq as usize];

        if target_stack.count == 0 {
            if !captures_only {
                moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK, idx));
            }
        } else if piece_color(target_stack.top()) != color {
            moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK, idx));
        } else if !captures_only && target_stack.count < 2 {
            if pt != KING && piece_type(target_stack.top()) != KING {
                moves.push(Move::with_unklik(sq, to_sq, MT_UNKLIK_KLIK, idx));
            }
        }
    }

    moves
}

fn generate_castling_moves(board: &Board) -> Vec<Move> {
    let mut moves = Vec::with_capacity(4);
    let color = board.turn;
    let enemy = opposite_color(color);

    let (king_sq, rook_piece, base) = if color == WHITE {
        (SQ_E1, W_ROOK, 0u8)
    } else {
        (SQ_E8, B_ROOK, 56u8)
    };

    // King must be at starting square (not stacked)
    let king_stack = &board.squares[king_sq as usize];
    if king_stack.count == 0 || king_stack.top() != make_piece(color, KING) { return moves; }
    if king_stack.count > 1 { return moves; } // King can't be in a stack

    // King can't be in check
    if is_attacked(board, king_sq, enemy) { return moves; }

    let rook_sq_k = base + 7; // h1/h8
    let rook_sq_q = base;     // a1/a8
    let f_sq = base + 5;      // f1/f8
    let g_sq = base + 6;      // g1/g8
    let d_sq = base + 3;      // d1/d8
    let c_sq = base + 2;      // c1/c8
    let b_sq = base + 1;      // b1/b8

    let ks_rights = if color == WHITE { CR_W_KINGSIDE } else { CR_B_KINGSIDE };
    let qs_rights = if color == WHITE { CR_W_QUEENSIDE } else { CR_B_QUEENSIDE };

    // Kingside castle
    if board.castling & ks_rights != 0 {
        let rook_stack = &board.squares[rook_sq_k as usize];
        if rook_stack.count > 0 && has_rook(rook_stack, rook_piece) {
            if board.squares[g_sq as usize].count == 0 {
                if !is_attacked(board, f_sq, enemy) {
                    let f_stack = &board.squares[f_sq as usize];
                    if f_stack.count == 0 {
                        moves.push(Move::new(king_sq, g_sq, MT_CASTLE_K));
                    } else if f_stack.count == 1 && piece_color(f_stack.pieces[0]) == color
                        && piece_type(f_stack.pieces[0]) != KING
                    {
                        moves.push(Move::new(king_sq, g_sq, MT_CASTLE_K_KLIK));
                    }
                }
            }
        }
    }

    // Queenside castle
    if board.castling & qs_rights != 0 {
        let rook_stack = &board.squares[rook_sq_q as usize];
        if rook_stack.count > 0 && has_rook(rook_stack, rook_piece) {
            if board.squares[c_sq as usize].count == 0 && board.squares[b_sq as usize].count == 0 {
                if !is_attacked(board, d_sq, enemy) {
                    let d_stack = &board.squares[d_sq as usize];
                    if d_stack.count == 0 {
                        moves.push(Move::new(king_sq, c_sq, MT_CASTLE_Q));
                    } else if d_stack.count == 1 && piece_color(d_stack.pieces[0]) == color
                        && piece_type(d_stack.pieces[0]) != KING
                    {
                        moves.push(Move::new(king_sq, c_sq, MT_CASTLE_Q_KLIK));
                    }
                }
            }
        }
    }

    moves
}

fn has_rook(stack: &SquareStack, rook_piece: u8) -> bool {
    for i in 0..stack.count {
        if stack.pieces[i as usize] == rook_piece { return true; }
    }
    false
}

pub fn is_attacked(board: &Board, sq: u8, by_color: u8) -> bool {
    let squares = &board.squares;

    // Knight attacks
    for &attacker_sq in knight_targets(sq) {
        let stack = &squares[attacker_sq as usize];
        for i in 0..stack.count {
            let piece = stack.pieces[i as usize];
            if piece_color(piece) == by_color && piece_type(piece) == KNIGHT {
                return true;
            }
        }
    }

    // King attacks
    for &attacker_sq in king_targets(sq) {
        let stack = &squares[attacker_sq as usize];
        for i in 0..stack.count {
            let piece = stack.pieces[i as usize];
            if piece_color(piece) == by_color && piece_type(piece) == KING {
                return true;
            }
        }
    }

    // Bishop/Queen diagonals
    for &direction in &BISHOP_DIRECTIONS {
        let mut current = sq as i8;
        loop {
            let prev = current;
            current += direction;
            if !(0..64).contains(&current) { break; }
            if ((current & 7) - (prev & 7)).abs() > 1 { break; }

            let stack = &squares[current as usize];
            if stack.count > 0 {
                for i in 0..stack.count {
                    let piece = stack.pieces[i as usize];
                    if piece_color(piece) == by_color {
                        let pt = piece_type(piece);
                        if pt == BISHOP || pt == QUEEN { return true; }
                    }
                }
                break;
            }
        }
    }

    // Rook/Queen lines
    for &direction in &ROOK_DIRECTIONS {
        let mut current = sq as i8;
        loop {
            let prev = current;
            current += direction;
            if !(0..64).contains(&current) { break; }
            if ((current & 7) - (prev & 7)).abs() > 1 { break; }

            let stack = &squares[current as usize];
            if stack.count > 0 {
                for i in 0..stack.count {
                    let piece = stack.pieces[i as usize];
                    if piece_color(piece) == by_color {
                        let pt = piece_type(piece);
                        if pt == ROOK || pt == QUEEN { return true; }
                    }
                }
                break;
            }
        }
    }

    // Pawn attacks
    let pawn_direction: i8 = if by_color == WHITE { 1 } else { -1 };
    let enemy_pawn = make_piece(by_color, PAWN);
    let sq_file = (sq & 7) as i8;

    for df in [-1i8, 1] {
        let attacker_sq = sq as i8 - 8 * pawn_direction + df;
        if (0..64).contains(&attacker_sq) && ((attacker_sq & 7) - sq_file).abs() == 1 {
            let stack = &squares[attacker_sq as usize];
            for i in 0..stack.count {
                if stack.pieces[i as usize] == enemy_pawn { return true; }
            }
        }
    }

    false
}

pub fn is_in_check(board: &Board, color: u8) -> bool {
    let king_sq = board.king_sq[color as usize];
    if king_sq == SQ_NONE { return false; }
    is_attacked(board, king_sq, opposite_color(color))
}

pub fn is_legal(board: &mut Board, mv: Move) -> bool {
    let undo = make_move(board, mv);
    let legal = !is_in_check(board, opposite_color(board.turn));
    unmake_move(board, mv, &undo);
    legal
}

pub fn generate_moves(board: &mut Board, legal_only: bool, captures_only: bool) -> Vec<Move> {
    let mut moves = Vec::with_capacity(128);
    let color = board.turn;

    for sq in 0..64u8 {
        let stack = board.squares[sq as usize];
        if stack.count == 0 { continue; }

        if stack.count >= 2 {
            // Stacked position
            let mut friendly_pieces: Vec<(u8, u8)> = Vec::new();
            for idx in 0..stack.count {
                let p = stack.pieces[idx as usize];
                if piece_color(p) == color {
                    friendly_pieces.push((idx, p));
                }
            }

            // Generate unklik moves
            for &(idx, piece) in &friendly_pieces {
                moves.extend(generate_unklik_moves(board, sq, idx, piece, captures_only));
            }

            // Combined moves if both friendly
            if friendly_pieces.len() == 2 {
                let pieces: Vec<u8> = friendly_pieces.iter().map(|&(_, p)| p).collect();
                moves.extend(generate_combined_moves(board, sq, &pieces, captures_only));
            }
        } else {
            let piece = stack.pieces[0];
            if piece_color(piece) == color {
                moves.extend(generate_piece_moves(board, sq, piece, true, captures_only));
            }
        }
    }

    // Castling (not during captures-only)
    if !captures_only {
        moves.extend(generate_castling_moves(board));
    }

    if legal_only {
        moves.retain(|&mv| {
            let undo = make_move(board, mv);
            let legal = !is_in_check(board, opposite_color(board.turn));
            unmake_move(board, mv, &undo);
            legal
        });
    }

    moves
}

pub fn make_move(board: &mut Board, mv: Move) -> UndoInfo {
    let from_sq = mv.from_sq;
    let to_sq = mv.to_sq;
    let mt = mv.move_type;

    let mut undo = UndoInfo::new();
    undo.castling = board.castling;
    undo.ep_square = board.ep_square;
    undo.halfmove_clock = board.halfmove_clock;
    undo.king_sq = board.king_sq;
    undo.fullmove = board.fullmove;
    undo.unmoved_pawns = board.unmoved_pawns;
    undo.zobrist_hash = board.zobrist_hash;

    // Save from and to squares
    undo.modified.push((from_sq, board.squares[from_sq as usize]));
    undo.modified.push((to_sq, board.squares[to_sq as usize]));

    // Get moving piece type BEFORE modifying
    let from_stack = board.squares[from_sq as usize];
    let moving_piece_type = if mt == MT_UNKLIK || mt == MT_UNKLIK_KLIK {
        if mv.unklik_index >= 0 && (mv.unklik_index as u8) < from_stack.count {
            piece_type(from_stack.pieces[mv.unklik_index as usize])
        } else {
            NONE
        }
    } else if mv.unklik_index == -1 {
        // Combined move
        let mut mpt = NONE;
        for i in 0..from_stack.count {
            if piece_type(from_stack.pieces[i as usize]) == PAWN {
                mpt = PAWN;
                break;
            }
        }
        mpt
    } else {
        if from_stack.count > 0 { piece_type(from_stack.top()) } else { NONE }
    };

    // Handle different move types
    match mt {
        MT_CASTLE_K | MT_CASTLE_Q | MT_CASTLE_K_KLIK | MT_CASTLE_Q_KLIK => {
            let is_kingside = mt == MT_CASTLE_K || mt == MT_CASTLE_K_KLIK;
            let is_klik = mt == MT_CASTLE_K_KLIK || mt == MT_CASTLE_Q_KLIK;
            let rank = if board.turn == WHITE { 0u8 } else { 7 };
            let rook_from = make_square(if is_kingside { 7 } else { 0 }, rank);
            let rook_to = make_square(if is_kingside { 5 } else { 3 }, rank);
            let rook_piece = if board.turn == WHITE { W_ROOK } else { B_ROOK };

            undo.modified.push((rook_from, board.squares[rook_from as usize]));
            undo.modified.push((rook_to, board.squares[rook_to as usize]));

            let king = board.squares[from_sq as usize].top();

            // Extract rook from its square
            let rook_sq_stack = &mut board.squares[rook_from as usize];
            let mut rook = rook_piece;
            for i in 0..rook_sq_stack.count {
                if rook_sq_stack.pieces[i as usize] == rook_piece {
                    rook = rook_sq_stack.remove_at(i);
                    break;
                }
            }

            // Place king
            board.squares[from_sq as usize].clear();
            board.squares[to_sq as usize] = SquareStack::single(king);

            // Place rook
            if is_klik {
                board.squares[rook_to as usize].add(rook);
            } else {
                board.squares[rook_to as usize] = SquareStack::single(rook);
            }

            board.king_sq[board.turn as usize] = to_sq;
        }

        MT_UNKLIK | MT_UNKLIK_KLIK => {
            let moving_piece = board.squares[from_sq as usize].remove_at(mv.unklik_index as u8);

            if mt == MT_UNKLIK_KLIK {
                board.squares[to_sq as usize].add(moving_piece);
            } else {
                board.squares[to_sq as usize].clear();
                board.squares[to_sq as usize] = SquareStack::single(moving_piece);
            }

            if piece_type(moving_piece) == KING {
                board.king_sq[board.turn as usize] = to_sq;
            }
        }

        MT_KLIK => {
            let old_stack = board.squares[from_sq as usize];
            board.squares[from_sq as usize].clear();
            for i in 0..old_stack.count {
                let piece = old_stack.pieces[i as usize];
                board.squares[to_sq as usize].add(piece);
                if piece_type(piece) == KING {
                    board.king_sq[board.turn as usize] = to_sq;
                }
            }
        }

        MT_EN_PASSANT => {
            let captured_sq = if board.turn == WHITE {
                to_sq.wrapping_sub(8)
            } else {
                to_sq + 8
            };
            undo.modified.push((captured_sq, board.squares[captured_sq as usize]));

            let old_stack = board.squares[from_sq as usize];
            board.squares[from_sq as usize].clear();
            board.squares[captured_sq as usize].clear();
            board.squares[to_sq as usize] = old_stack;
        }

        MT_PROMOTION | MT_PROMOTION_CAPTURE => {
            let promoted_piece = make_piece(board.turn, mv.promotion);

            if mv.unklik_index == -1 {
                // Combined promotion
                let old_stack = board.squares[from_sq as usize];
                let mut companion = NO_PIECE;
                for i in 0..old_stack.count {
                    if piece_type(old_stack.pieces[i as usize]) != PAWN {
                        companion = old_stack.pieces[i as usize];
                        break;
                    }
                }
                board.squares[from_sq as usize].clear();
                board.squares[to_sq as usize].clear();
                if companion != NO_PIECE {
                    board.squares[to_sq as usize] = SquareStack::double(companion, promoted_piece);
                } else {
                    board.squares[to_sq as usize] = SquareStack::single(promoted_piece);
                }
            } else if mv.unklik_index > 0 || from_stack.count >= 2 {
                // Unklik promotion
                board.squares[from_sq as usize].remove_at(mv.unklik_index as u8);
                board.squares[to_sq as usize].clear();
                board.squares[to_sq as usize] = SquareStack::single(promoted_piece);
            } else {
                // Simple promotion
                board.squares[from_sq as usize].clear();
                board.squares[to_sq as usize].clear();
                board.squares[to_sq as usize] = SquareStack::single(promoted_piece);
            }
        }

        _ => {
            // Normal move or capture
            let old_stack = board.squares[from_sq as usize];
            board.squares[from_sq as usize].clear();
            board.squares[to_sq as usize].clear();

            for i in 0..old_stack.count {
                let piece = old_stack.pieces[i as usize];
                board.squares[to_sq as usize].add(piece);
                if piece_type(piece) == KING {
                    board.king_sq[board.turn as usize] = to_sq;
                }
            }
        }
    }

    // Update castling rights
    if from_sq == SQ_E1 || to_sq == SQ_E1 { board.castling &= !CR_WHITE; }
    if from_sq == SQ_E8 || to_sq == SQ_E8 { board.castling &= !CR_BLACK; }
    if from_sq == SQ_A1 || to_sq == SQ_A1 { board.castling &= !CR_W_QUEENSIDE; }
    if from_sq == SQ_H1 || to_sq == SQ_H1 { board.castling &= !CR_W_KINGSIDE; }
    if from_sq == SQ_A8 || to_sq == SQ_A8 { board.castling &= !CR_B_QUEENSIDE; }
    if from_sq == SQ_H8 || to_sq == SQ_H8 { board.castling &= !CR_B_KINGSIDE; }

    // Update halfmove clock
    let is_capture = mt == MT_CAPTURE || mt == MT_EN_PASSANT || mt == MT_PROMOTION_CAPTURE;
    if moving_piece_type == PAWN || is_capture {
        board.halfmove_clock = 0;
    } else {
        board.halfmove_clock += 1;
    }

    // Update en passant square
    board.ep_square = SQ_NONE;
    if moving_piece_type == PAWN {
        let from_rank = square_rank(from_sq);
        let to_rank = square_rank(to_sq);
        if (to_rank as i8 - from_rank as i8).unsigned_abs() == 2 {
            board.ep_square = (from_sq + to_sq) / 2;
        }
    }

    // Update unmoved_pawns
    let color_moved = board.turn;
    let from_rank = square_rank(from_sq);
    let from_file = square_file(from_sq);
    if moving_piece_type == PAWN {
        if color_moved == WHITE && from_rank == 1 {
            board.unmoved_pawns[WHITE as usize] &= !(1 << from_file);
        } else if color_moved == BLACK && from_rank == 6 {
            board.unmoved_pawns[BLACK as usize] &= !(1 << from_file);
        }
    } else if mt == MT_NORMAL || mt == MT_CAPTURE || mt == MT_KLIK {
        if color_moved == WHITE && from_rank == 1 {
            board.unmoved_pawns[WHITE as usize] &= !(1 << from_file);
        } else if color_moved == BLACK && from_rank == 6 {
            board.unmoved_pawns[BLACK as usize] &= !(1 << from_file);
        }
    }

    // Switch turn
    board.turn = opposite_color(board.turn);
    if board.turn == WHITE {
        board.fullmove += 1;
    }

    // Incremental Zobrist hash update
    let zob = &*ZOBRIST;
    let mut h = undo.zobrist_hash;

    for &(msq, ref old_stack) in &undo.modified {
        for i in 0..old_stack.count {
            let piece = old_stack.pieces[i as usize];
            h ^= zob.piece_keys[piece as usize][i as usize][msq as usize];
        }
        let new_stack = &board.squares[msq as usize];
        for i in 0..new_stack.count {
            let piece = new_stack.pieces[i as usize];
            h ^= zob.piece_keys[piece as usize][i as usize][msq as usize];
        }
    }

    // Castling hash
    h ^= zob.castling_keys[undo.castling as usize] ^ zob.castling_keys[board.castling as usize];

    // EP hash
    if undo.ep_square != SQ_NONE {
        h ^= zob.ep_keys[(undo.ep_square & 7) as usize];
    }
    if board.ep_square != SQ_NONE {
        h ^= zob.ep_keys[(board.ep_square & 7) as usize];
    }

    // Toggle turn
    h ^= zob.turn_key;

    board.zobrist_hash = h;

    undo
}

pub fn unmake_move(board: &mut Board, _mv: Move, undo: &UndoInfo) {
    // Restore modified squares
    for &(sq, ref old_stack) in &undo.modified {
        board.squares[sq as usize] = *old_stack;
    }

    board.castling = undo.castling;
    board.ep_square = undo.ep_square;
    board.halfmove_clock = undo.halfmove_clock;
    board.king_sq = undo.king_sq;
    board.fullmove = undo.fullmove;
    board.unmoved_pawns = undo.unmoved_pawns;
    board.zobrist_hash = undo.zobrist_hash;
    board.turn = opposite_color(board.turn);
}
