/// Klikschaak Engine - Alpha-Beta Search

use std::time::Instant;
use crate::types::*;
use crate::board::Board;
use crate::movegen::{generate_moves, make_move, unmake_move, is_in_check};
use crate::evaluate::{evaluate, CHECKMATE_SCORE, DRAW_SCORE};

pub const MAX_DEPTH: usize = 64;
pub const INFINITY: i32 = 1000000;

// Capture move types
fn is_capture_type(mt: u8) -> bool {
    mt == MT_CAPTURE || mt == MT_EN_PASSANT || mt == MT_PROMOTION_CAPTURE
}

// Search info
#[derive(Clone)]
pub struct SearchInfo {
    pub nodes: u64,
    pub depth: u32,
    pub score: i32,
    pub pv: Vec<Move>,
    pub time_ms: u64,
    pub nps: u64,
}

impl SearchInfo {
    pub fn new() -> Self {
        SearchInfo { nodes: 0, depth: 0, score: 0, pv: Vec::new(), time_ms: 0, nps: 0 }
    }
}

// Transposition table
const TT_EXACT: u8 = 0;
const TT_ALPHA: u8 = 1; // Upper bound
const TT_BETA: u8 = 2;  // Lower bound

#[derive(Clone, Copy)]
struct TTEntry {
    key: u64,
    depth: i32,
    score: i32,
    flag: u8,
    best_move: Option<Move>,
}

// Zobrist hashing
pub struct ZobristKeys {
    pub piece_keys: [[[u64; 64]; 2]; 15], // [piece_val][stack_idx][sq]
    pub turn_key: u64,
    pub castling_keys: [u64; 16],
    pub ep_keys: [u64; 8],
}

impl ZobristKeys {
    fn new(seed: u64) -> Self {
        // Simple xorshift64 PRNG to match Python's Random(42) output
        // We need deterministic keys but they don't need to match Python exactly
        let mut state = seed;
        let mut next = || -> u64 {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };

        let mut piece_keys = [[[0u64; 64]; 2]; 15];
        for p in 0..15 {
            for si in 0..2 {
                for sq in 0..64 {
                    piece_keys[p][si][sq] = next();
                }
            }
        }

        let turn_key = next();

        let mut castling_keys = [0u64; 16];
        for i in 0..16 {
            castling_keys[i] = next();
        }

        let mut ep_keys = [0u64; 8];
        for i in 0..8 {
            ep_keys[i] = next();
        }

        ZobristKeys { piece_keys, turn_key, castling_keys, ep_keys }
    }
}

pub static ZOBRIST: std::sync::LazyLock<ZobristKeys> = std::sync::LazyLock::new(|| {
    ZobristKeys::new(42)
});

pub fn compute_zobrist(board: &mut Board) {
    let zob = &*ZOBRIST;
    let mut h: u64 = 0;

    for sq in 0..64u8 {
        let stack = &board.squares[sq as usize];
        for i in 0..stack.count {
            let piece = stack.pieces[i as usize];
            h ^= zob.piece_keys[piece as usize][i as usize][sq as usize];
        }
    }

    if board.turn == BLACK {
        h ^= zob.turn_key;
    }

    h ^= zob.castling_keys[board.castling as usize];

    if board.ep_square != SQ_NONE {
        h ^= zob.ep_keys[(board.ep_square & 7) as usize];
    }

    board.zobrist_hash = h;
}

pub struct SearchEngine {
    nodes: u64,
    start_time: Instant,
    max_time_ms: u64,
    stop_search: bool,

    // Transposition table (fixed size array)
    tt: Vec<Option<TTEntry>>,
    tt_size: usize,

    // Killer moves
    killers: [[Option<Move>; 2]; MAX_DEPTH],

    // History heuristic
    history: [[i32; 64]; 64],

    // Countermove heuristic
    countermove: [[Option<Move>; 64]; 64],
}

// Futility margins
const FUTILITY_MARGINS: [i32; 3] = [0, 100, 300];
const ASPIRATION_WINDOW: i32 = 50;

impl SearchEngine {
    pub fn new() -> Self {
        let tt_size = 1 << 20; // ~1M entries
        SearchEngine {
            nodes: 0,
            start_time: Instant::now(),
            max_time_ms: u64::MAX,
            stop_search: false,
            tt: vec![None; tt_size],
            tt_size,
            killers: [[None; 2]; MAX_DEPTH],
            history: [[0; 64]; 64],
            countermove: [[None; 64]; 64],
        }
    }

    pub fn clear(&mut self) {
        for entry in self.tt.iter_mut() { *entry = None; }
        self.killers = [[None; 2]; MAX_DEPTH];
        self.history = [[0; 64]; 64];
        self.countermove = [[None; 64]; 64];
    }

    fn decay_history(&mut self) {
        for i in 0..64 {
            for j in 0..64 {
                self.history[i][j] >>= 1;
            }
        }
    }

    pub fn search(&mut self, board: &mut Board, depth: u32, time_limit_ms: Option<u64>) -> (Option<Move>, SearchInfo) {
        self.nodes = 0;
        self.start_time = Instant::now();
        self.max_time_ms = time_limit_ms.unwrap_or(u64::MAX);
        self.stop_search = false;

        compute_zobrist(board);

        let mut info = SearchInfo::new();
        let mut best_move: Option<Move> = None;
        let mut prev_score = 0i32;

        for d in 1..=depth {
            if self.stop_search { break; }

            self.decay_history();

            let (score, pv) = if d <= 1 {
                self.alpha_beta(board, d as i32, -INFINITY, INFINITY, None)
            } else {
                let alpha_w = prev_score - ASPIRATION_WINDOW;
                let beta_w = prev_score + ASPIRATION_WINDOW;

                let (score, pv) = self.alpha_beta(board, d as i32, alpha_w, beta_w, None);

                if !self.stop_search && (score <= alpha_w || score >= beta_w) {
                    self.alpha_beta(board, d as i32, -INFINITY, INFINITY, None)
                } else {
                    (score, pv)
                }
            };

            if !self.stop_search {
                prev_score = score;
                info.depth = d;
                info.score = if board.turn == WHITE { score } else { -score };
                info.pv = pv.clone();
                info.nodes = self.nodes;

                if let Some(mv) = pv.first() {
                    best_move = Some(*mv);
                }

                let elapsed = self.start_time.elapsed().as_millis() as u64;
                info.time_ms = elapsed;
                info.nps = if elapsed > 0 { self.nodes * 1000 / elapsed } else { 0 };

                let pv_str: Vec<String> = pv.iter().map(|m| m.to_uci()).collect();
                println!("info depth {} score cp {} nodes {} nps {} time {} pv {}",
                    d, info.score, self.nodes, info.nps, info.time_ms, pv_str.join(" "));
            }
        }

        if best_move.is_none() {
            let moves = generate_moves(board, true, false);
            if !moves.is_empty() {
                best_move = Some(moves[0]);
            }
        }

        (best_move, info)
    }

    fn alpha_beta(&mut self, board: &mut Board, depth: i32, mut alpha: i32, beta: i32,
                  prev_move: Option<Move>) -> (i32, Vec<Move>) {
        self.nodes += 1;

        // Time check
        if self.nodes % 4096 == 0 {
            let elapsed = self.start_time.elapsed().as_millis() as u64;
            if elapsed >= self.max_time_ms {
                self.stop_search = true;
                return (0, Vec::new());
            }
        }

        if self.stop_search { return (0, Vec::new()); }

        // Leaf node
        if depth <= 0 {
            let score = self.quiescence(board, alpha, beta, 0);
            return (score, Vec::new());
        }

        // TT lookup
        let tt_key = board.zobrist_hash;
        let tt_idx = (tt_key as usize) % self.tt_size;
        let mut tt_move: Option<Move> = None;

        if let Some(entry) = &self.tt[tt_idx] {
            if entry.key == tt_key {
                if entry.depth >= depth {
                    match entry.flag {
                        TT_EXACT => return (entry.score, entry.best_move.map_or(Vec::new(), |m| vec![m])),
                        TT_ALPHA => { if entry.score <= alpha { return (alpha, Vec::new()); } }
                        TT_BETA => { if entry.score >= beta { return (beta, Vec::new()); } }
                        _ => {}
                    }
                }
                tt_move = entry.best_move;
            }
        }

        let in_check = is_in_check(board, board.turn);

        // Futility pruning
        let mut futile = false;
        if !in_check && depth <= 2 {
            let static_eval = {
                let e = evaluate(board);
                if board.turn == BLACK { -e } else { e }
            };
            if static_eval + FUTILITY_MARGINS[depth as usize] <= alpha {
                futile = true;
            }
        }

        // Generate moves
        let moves = generate_moves(board, false, false);

        if moves.is_empty() {
            return if in_check {
                (-CHECKMATE_SCORE + (MAX_DEPTH as i32 - depth), Vec::new())
            } else {
                (DRAW_SCORE, Vec::new())
            };
        }

        // Order moves
        let ordered = self.order_moves(board, &moves, depth as usize, tt_move, prev_move);

        let original_alpha = alpha;
        let mut best_score = -INFINITY;
        let mut best_move: Option<Move> = None;
        let mut best_pv = Vec::new();
        let mut legal_count = 0u32;

        for mv in &ordered {
            let mv = *mv;
            let is_cap = self.is_capture(board, mv);

            // Futility pruning
            if futile && !is_cap && !in_check && legal_count > 0 {
                continue;
            }

            let undo = make_move(board, mv);

            // Skip illegal
            if is_in_check(board, opposite_color(board.turn)) {
                unmake_move(board, mv, &undo);
                continue;
            }

            legal_count += 1;
            let gives_check = is_in_check(board, board.turn);

            let (score, child_pv) = if legal_count == 1 {
                let (s, pv) = self.alpha_beta(board, depth - 1, -beta, -alpha, Some(mv));
                (-s, pv)
            } else {
                // LMR
                let reduction = if depth >= 3 && legal_count > 3 && !is_cap && !in_check && !gives_check {
                    1
                } else {
                    0
                };

                let (s, _) = self.alpha_beta(board, depth - 1 - reduction, -alpha - 1, -alpha, Some(mv));
                let mut score = -s;

                let child_pv = if reduction > 0 && score > alpha {
                    let (s, _) = self.alpha_beta(board, depth - 1, -alpha - 1, -alpha, Some(mv));
                    score = -s;
                    Vec::new()
                } else {
                    Vec::new()
                };

                if alpha < score && score < beta {
                    let (s, pv) = self.alpha_beta(board, depth - 1, -beta, -score, Some(mv));
                    (-s, pv)
                } else {
                    (score, child_pv)
                }
            };

            unmake_move(board, mv, &undo);

            if self.stop_search { return (0, Vec::new()); }

            if score > best_score {
                best_score = score;
                best_move = Some(mv);
                best_pv = std::iter::once(mv).chain(child_pv).collect();
            }

            if score > alpha {
                alpha = score;
            }

            if alpha >= beta {
                // Beta cutoff
                if !is_cap {
                    let d = depth as usize;
                    if d < MAX_DEPTH {
                        if self.killers[d][0] != Some(mv) {
                            self.killers[d][1] = self.killers[d][0];
                            self.killers[d][0] = Some(mv);
                        }
                    }
                    self.history[mv.from_sq as usize][mv.to_sq as usize] += depth * depth;
                    if let Some(pm) = prev_move {
                        self.countermove[pm.from_sq as usize][pm.to_sq as usize] = Some(mv);
                    }
                }
                break;
            }
        }

        // No legal moves
        if legal_count == 0 {
            return if in_check {
                (-CHECKMATE_SCORE + (MAX_DEPTH as i32 - depth), Vec::new())
            } else {
                (DRAW_SCORE, Vec::new())
            };
        }

        // Store in TT
        let flag = if best_score <= original_alpha {
            TT_ALPHA
        } else if best_score >= beta {
            TT_BETA
        } else {
            TT_EXACT
        };

        self.tt[tt_idx] = Some(TTEntry {
            key: tt_key,
            depth,
            score: best_score,
            flag,
            best_move,
        });

        (best_score, best_pv)
    }

    fn quiescence(&mut self, board: &mut Board, mut alpha: i32, beta: i32, qdepth: i32) -> i32 {
        self.nodes += 1;

        // Stand pat
        let stand_pat = {
            let e = evaluate(board);
            if board.turn == BLACK { -e } else { e }
        };

        if stand_pat >= beta { return beta; }
        if alpha < stand_pat { alpha = stand_pat; }
        if qdepth >= 10 { return alpha; }

        // Captures only
        let captures = generate_moves(board, false, true);

        // Sort captures by MVV-LVA
        let mut scored: Vec<(i32, Move)> = captures.iter()
            .map(|&m| (self.mvv_lva_score(board, m), m))
            .collect();
        scored.sort_by(|a, b| b.0.cmp(&a.0));

        for (_, mv) in scored {
            let undo = make_move(board, mv);

            if is_in_check(board, opposite_color(board.turn)) {
                unmake_move(board, mv, &undo);
                continue;
            }

            let score = -self.quiescence(board, -beta, -alpha, qdepth + 1);
            unmake_move(board, mv, &undo);

            if score >= beta { return beta; }
            if score > alpha { alpha = score; }
        }

        alpha
    }

    fn is_capture(&self, board: &Board, mv: Move) -> bool {
        if is_capture_type(mv.move_type) { return true; }
        let target = &board.squares[mv.to_sq as usize];
        if target.count > 0 {
            return piece_color(target.top()) != board.turn;
        }
        false
    }

    fn mvv_lva_score(&self, board: &Board, mv: Move) -> i32 {
        let target = &board.squares[mv.to_sq as usize];
        let victim_value = if target.count == 0 {
            100 // en passant
        } else {
            let mut v = 0i32;
            for i in 0..target.count {
                let p = target.pieces[i as usize];
                if piece_color(p) != board.turn {
                    v += PIECE_VALUES[piece_type(p) as usize];
                }
            }
            v
        };

        let from_stack = &board.squares[mv.from_sq as usize];
        let attacker = if mv.unklik_index >= 0 && (mv.unklik_index as u8) < from_stack.count {
            from_stack.pieces[mv.unklik_index as usize]
        } else if from_stack.count > 0 {
            from_stack.top()
        } else {
            NO_PIECE
        };

        let attacker_value = if attacker != NO_PIECE {
            PIECE_VALUES[piece_type(attacker) as usize]
        } else { 0 };

        victim_value * 10 - attacker_value
    }

    fn order_moves(&self, board: &Board, moves: &[Move], depth: usize,
                   tt_move: Option<Move>, prev_move: Option<Move>) -> Vec<Move> {
        let cm = prev_move.and_then(|pm| self.countermove[pm.from_sq as usize][pm.to_sq as usize]);

        let mut scored: Vec<(i32, Move)> = moves.iter().map(|&mv| {
            let score = if tt_move == Some(mv) {
                10_000_000
            } else if self.is_capture(board, mv) {
                1_000_000 + self.mvv_lva_score(board, mv)
            } else if depth < MAX_DEPTH && self.killers[depth][0] == Some(mv) {
                900_000
            } else if depth < MAX_DEPTH && self.killers[depth][1] == Some(mv) {
                800_000
            } else if cm == Some(mv) {
                700_000
            } else {
                self.history[mv.from_sq as usize][mv.to_sq as usize]
            };
            (score, mv)
        }).collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0));
        scored.into_iter().map(|(_, m)| m).collect()
    }
}

pub fn find_best_move(board: &mut Board, depth: u32, time_limit_ms: Option<u64>) -> (Option<Move>, SearchInfo) {
    let mut engine = SearchEngine::new();
    engine.search(board, depth, time_limit_ms)
}
