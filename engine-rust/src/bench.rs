use crate::board::Board;
use crate::search::{find_best_move, compute_zobrist};
use crate::movegen::generate_moves;

pub fn run_bench() {
    println!("=== Klikschaak Rust Engine Benchmark ===\n");

    // Perft-like: count legal moves at depth 1 for speed
    let mut board = Board::startpos();
    compute_zobrist(&mut board);

    let start = std::time::Instant::now();
    let iters = 100_000;
    let mut total = 0usize;
    for _ in 0..iters {
        let moves = generate_moves(&mut board, true, false);
        total += moves.len();
    }
    let elapsed = start.elapsed();
    println!("Move gen: {} iterations in {:.2}ms ({:.0} gen/sec), total moves: {}",
        iters, elapsed.as_secs_f64() * 1000.0,
        iters as f64 / elapsed.as_secs_f64(), total);

    // Search benchmark
    println!("\nSearch from startpos:");
    for depth in [4, 5, 6, 7, 8] {
        let mut board = Board::startpos();
        let (best, info) = find_best_move(&mut board, depth, None);
        println!("  depth {}: {} nodes in {}ms ({} nps), best: {}",
            depth, info.nodes, info.time_ms, info.nps,
            best.map_or("-".to_string(), |m| m.to_uci()));
    }
}
