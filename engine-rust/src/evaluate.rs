/// Klikschaak Engine - Position Evaluation

use crate::types::*;
use crate::board::Board;
use crate::movegen::is_in_check;

// Piece-square tables (from White's perspective, a1=index 0)
const PAWN_TABLE: [i32; 64] = [
      0,   0,   0,   0,   0,   0,   0,   0,
     50,  50,  50,  50,  50,  50,  50,  50,
     10,  10,  20,  30,  30,  20,  10,  10,
      5,   5,  10,  25,  25,  10,   5,   5,
      0,   0,   0,  20,  20,   0,   0,   0,
      5,  -5, -10,   0,   0, -10,  -5,   5,
      5,  10,  10, -20, -20,  10,  10,   5,
      0,   0,   0,   0,   0,   0,   0,   0,
];

const KNIGHT_PST: [i32; 64] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_TABLE: [i32; 64] = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,  10,  10,   5,   0, -10,
    -10,   5,   5,  10,  10,   5,   5, -10,
    -10,   0,  10,  10,  10,  10,   0, -10,
    -10,  10,  10,  10,  10,  10,  10, -10,
    -10,   5,   0,   0,   0,   0,   5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
];

const ROOK_TABLE: [i32; 64] = [
      0,   0,   0,   0,   0,   0,   0,   0,
      5,  10,  10,  10,  10,  10,  10,   5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
      0,   0,   0,   5,   5,   0,   0,   0,
];

const QUEEN_TABLE: [i32; 64] = [
    -20, -10, -10,  -5,  -5, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,   5,   5,   5,   0, -10,
     -5,   0,   5,   5,   5,   5,   0,  -5,
      0,   0,   5,   5,   5,   5,   0,  -5,
    -10,   5,   5,   5,   5,   5,   0, -10,
    -10,   0,   5,   0,   0,   0,   0, -10,
    -20, -10, -10,  -5,  -5, -10, -10, -20,
];

const KING_MIDDLEGAME_TABLE: [i32; 64] = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
     20,  20,   0,   0,   0,   0,  20,  20,
     20,  30,  10,   0,   0,  10,  30,  20,
];

const KING_ENDGAME_TABLE: [i32; 64] = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10,   0,   0, -10, -20, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -30,   0,   0,   0,   0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
];

fn pst_value(pt: u8, sq: u8) -> i32 {
    match pt {
        PAWN => PAWN_TABLE[sq as usize],
        KNIGHT => KNIGHT_PST[sq as usize],
        BISHOP => BISHOP_TABLE[sq as usize],
        ROOK => ROOK_TABLE[sq as usize],
        QUEEN => QUEEN_TABLE[sq as usize],
        _ => 0,
    }
}

#[inline]
fn mirror_square(sq: u8) -> u8 {
    sq ^ 56
}

// Passed pawn bonus by rank advancement
const PASSED_PAWN_BONUS: [i32; 7] = [0, 10, 15, 25, 45, 75, 120];

pub const CHECKMATE_SCORE: i32 = 100000;
pub const DRAW_SCORE: i32 = 0;

pub fn evaluate(board: &Board) -> i32 {
    let mut score: i32 = 0;

    let mut queens = 0u32;
    let mut minors = 0u32;
    let mut king_sq_w: u8 = 0;
    let mut king_sq_b: u8 = 0;

    let mut w_pawn_files = [0u8; 8];
    let mut b_pawn_files = [0u8; 8];
    let mut w_pawn_sqs = Vec::with_capacity(8);
    let mut b_pawn_sqs = Vec::with_capacity(8);

    for sq in 0..64u8 {
        let stack = &board.squares[sq as usize];
        if stack.count == 0 { continue; }

        for pi in 0..stack.count {
            let piece = stack.pieces[pi as usize];
            let pval = piece;
            let is_white = pval < 8;
            let pt = pval & 7;

            // Material
            let value = PIECE_VALUES[pt as usize];
            if is_white { score += value; } else { score -= value; }

            // PST (defer king)
            if pt == KING {
                if is_white { king_sq_w = sq; } else { king_sq_b = sq; }
            } else if pt >= 1 && pt <= 5 {
                let table_sq = if is_white { sq } else { mirror_square(sq) };
                let pst = pst_value(pt, table_sq);
                if is_white { score += pst; } else { score -= pst; }
            }

            // Endgame detection
            if pt == QUEEN { queens += 1; }
            else if pt == KNIGHT || pt == BISHOP || pt == ROOK { minors += 1; }

            // Pawn tracking
            if pt == PAWN {
                let f = sq & 7;
                let r = sq >> 3;
                if is_white {
                    w_pawn_files[f as usize] |= 1 << r;
                    w_pawn_sqs.push(sq);
                } else {
                    b_pawn_files[f as usize] |= 1 << r;
                    b_pawn_sqs.push(sq);
                }
            }
        }

        // Stack evaluation (inline)
        if stack.count == 2 {
            let bottom = stack.pieces[0];
            let top = stack.pieces[1];
            let b_color = bottom < 8;
            let t_color = top < 8;
            if b_color == t_color {
                let bottom_pt = bottom & 7;
                let top_pt = top & 7;
                let mut stack_value: i32 = 0;
                if (bottom_pt == KNIGHT || bottom_pt == BISHOP) && (top_pt == KNIGHT || top_pt == BISHOP) {
                    stack_value += 15;
                }
                if (bottom_pt == KNIGHT || bottom_pt == BISHOP) && top_pt == ROOK {
                    stack_value += 20;
                }
                if top_pt == QUEEN || bottom_pt == QUEEN {
                    stack_value += 5;
                }
                if bottom_pt == PAWN {
                    stack_value += 10;
                }
                if top_pt != PAWN && bottom_pt == PAWN {
                    stack_value -= 5;
                }
                if b_color { score += stack_value; } else { score -= stack_value; }
            }
        }
    }

    // Endgame detection
    let endgame = queens == 0 || (queens == 1 && minors <= 1);
    let king_table = if endgame { &KING_ENDGAME_TABLE } else { &KING_MIDDLEGAME_TABLE };

    score += king_table[king_sq_w as usize];
    score -= king_table[mirror_square(king_sq_b) as usize];

    // King safety
    score += evaluate_king_safety(board);

    // Passed pawn evaluation
    for &sq in &w_pawn_sqs {
        let file = (sq & 7) as usize;
        let rank = sq >> 3;
        let ahead_mask = !((1u8 << (rank + 1)).wrapping_sub(1));
        let mut is_passed = true;
        for f in file.saturating_sub(1)..=(file + 1).min(7) {
            if b_pawn_files[f] & ahead_mask != 0 {
                is_passed = false;
                break;
            }
        }
        if is_passed {
            let advancement = rank as i32 - 1;
            let mut bonus = if advancement >= 0 {
                PASSED_PAWN_BONUS[advancement.min(6) as usize]
            } else { 0 };
            if board.squares[sq as usize].count >= 2 {
                bonus += 15;
            }
            score += bonus;
        }
    }

    for &sq in &b_pawn_sqs {
        let file = (sq & 7) as usize;
        let rank = sq >> 3;
        let ahead_mask = (1u8 << rank).wrapping_sub(1);
        let mut is_passed = true;
        for f in file.saturating_sub(1)..=(file + 1).min(7) {
            if w_pawn_files[f] & ahead_mask != 0 {
                is_passed = false;
                break;
            }
        }
        if is_passed {
            let advancement = 6 - rank as i32;
            let mut bonus = if advancement >= 0 {
                PASSED_PAWN_BONUS[advancement.min(6) as usize]
            } else { 0 };
            if board.squares[sq as usize].count >= 2 {
                bonus += 15;
            }
            score -= bonus;
        }
    }

    // Check bonus
    if is_in_check(board, BLACK) { score += 50; }
    if is_in_check(board, WHITE) { score -= 50; }

    score
}

fn evaluate_king_safety(board: &Board) -> i32 {
    let mut score: i32 = 0;

    for color in [WHITE, BLACK] {
        let king_sq = board.king_sq[color as usize];
        if king_sq >= 64 { continue; }

        let king_file = square_file(king_sq);
        let king_rank = square_rank(king_sq);
        let mut safety: i32 = 0;

        // Castled king bonus
        if color == WHITE {
            if king_sq == SQ_G1 || king_sq == SQ_C1 { safety += 30; }
            else if king_sq == SQ_E1 { safety -= 20; }
        } else {
            if king_sq == SQ_G8 || king_sq == SQ_C8 { safety += 30; }
            else if king_sq == SQ_E8 { safety -= 20; }
        }

        // Pawn shield
        let pawn = if color == WHITE { W_PAWN } else { B_PAWN };
        let shield_rank = if color == WHITE {
            king_rank as i8 + 1
        } else {
            king_rank as i8 - 1
        };

        if (0..8).contains(&shield_rank) {
            for df in [-1i8, 0, 1] {
                let f = king_file as i8 + df;
                if (0..8).contains(&f) {
                    let sq = make_square(f as u8, shield_rank as u8);
                    let stack = &board.squares[sq as usize];
                    for i in 0..stack.count {
                        if stack.pieces[i as usize] == pawn {
                            safety += 10;
                            break;
                        }
                    }
                }
            }
        }

        // King in stack is bad
        if board.squares[king_sq as usize].has_stack() {
            safety -= 40;
        }

        if color == WHITE { score += safety; } else { score -= safety; }
    }

    score
}
