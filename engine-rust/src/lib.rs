/// Klikschaak Engine - WASM entry point

use wasm_bindgen::prelude::*;

pub mod types;
pub mod board;
pub mod movegen;
pub mod evaluate;
pub mod search;

// api and bench are native-only
#[cfg(not(target_arch = "wasm32"))]
pub mod api;
#[cfg(not(target_arch = "wasm32"))]
pub mod bench;

use board::Board;
use movegen::generate_moves;
use search::{SearchEngine, compute_zobrist, MAX_DEPTH};
use evaluate::CHECKMATE_SCORE;
use types::move_type_name;

#[wasm_bindgen]
pub fn wasm_get_moves(fen: &str) -> String {
    let mut board = Board::from_fen(fen);
    compute_zobrist(&mut board);
    let moves = generate_moves(&mut board, true, false);

    let move_list: Vec<serde_json::Value> = moves.iter().map(|m| {
        serde_json::json!({
            "uci": m.to_uci(),
            "type": move_type_name(m.move_type),
        })
    }).collect();

    serde_json::json!({
        "count": move_list.len(),
        "moves": move_list,
        "error": null,
    }).to_string()
}

#[wasm_bindgen]
pub fn wasm_eval(fen: &str, depth: u32) -> String {
    let depth = depth.max(1).min(20);

    let mut board = Board::from_fen(fen);
    let mut searcher = SearchEngine::new();
    let (best_move, info) = searcher.search(&mut board, depth, None);

    let mut score = info.score;
    let score_type = if score.abs() >= CHECKMATE_SCORE - MAX_DEPTH as i32 {
        if score > 0 {
            score = (CHECKMATE_SCORE - score + 1) / 2;
        } else {
            score = -(CHECKMATE_SCORE + score + 1) / 2;
        }
        "mate"
    } else {
        "cp"
    };

    serde_json::json!({
        "score": score,
        "scoreType": score_type,
        "bestMove": best_move.map(|m| m.to_uci()),
        "pv": info.pv.iter().map(|m| m.to_uci()).collect::<Vec<_>>(),
        "depth": info.depth,
        "nodes": info.nodes,
        "nps": info.nps,
        "time_ms": info.time_ms,
        "error": null,
    }).to_string()
}
