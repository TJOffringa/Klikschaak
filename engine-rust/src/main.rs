mod types;
mod board;
mod movegen;
mod evaluate;
mod search;
mod api;
mod bench;

use board::Board;
use movegen::generate_moves;
use search::compute_zobrist;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 {
        match args[1].as_str() {
            "test" => { run_tests(); return; }
            "bench" => { bench::run_bench(); return; }
            _ => {}
        }
    }

    // Default: run HTTP server
    api::run_server();
}

fn run_tests() {
    println!("=== Klikschaak Rust Engine Tests ===\n");

    // Test 1: FEN round-trip
    print!("Test 1: FEN round-trip (startpos)... ");
    let board = Board::startpos();
    let fen = board.get_fen();
    assert_eq!(fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    println!("OK");

    // Test 2: 34 legal moves from start position
    print!("Test 2: Legal moves from start position... ");
    let mut board = Board::startpos();
    compute_zobrist(&mut board);
    let moves = generate_moves(&mut board, true, false);
    let count = moves.len();
    if count != 34 {
        println!("FAIL: expected 34, got {}", count);
        println!("Moves:");
        for m in &moves {
            println!("  {} ({})", m.to_uci(), types::move_type_name(m.move_type));
        }
    } else {
        println!("OK (34 moves)");
    }

    // Test 3: FEN with stacks
    print!("Test 3: FEN with stack notation... ");
    let board = Board::from_fen("rnbqkbnr/pppppppp/8/8/8/8/(PN)PPPPP(NP)/R1BQKB1R w KQkq - 0 1");
    let fen = board.get_fen();
    assert!(fen.contains("(PN)"), "Expected stack notation in FEN, got: {}", fen);
    println!("OK");

    // Test 4: Make/unmake consistency
    print!("Test 4: Make/unmake restores board... ");
    let mut board = Board::startpos();
    compute_zobrist(&mut board);
    let original_fen = board.get_fen();
    let original_hash = board.zobrist_hash;
    let moves = generate_moves(&mut board, true, false);
    for mv in &moves {
        let undo = movegen::make_move(&mut board, *mv);
        movegen::unmake_move(&mut board, *mv, &undo);
        let restored_fen = board.get_fen();
        assert_eq!(original_fen, restored_fen, "FEN mismatch after make/unmake {}", mv.to_uci());
        assert_eq!(original_hash, board.zobrist_hash, "Hash mismatch after make/unmake {}", mv.to_uci());
    }
    println!("OK (all {} moves)", moves.len());

    // Test 5: Evaluation
    print!("Test 5: Evaluation from startpos... ");
    let board = Board::startpos();
    let eval = evaluate::evaluate(&board);
    println!("OK (score = {})", eval);

    // Test 6: Quick search
    print!("Test 6: Search depth 4... ");
    let mut board = Board::startpos();
    let (best_move, info) = search::find_best_move(&mut board, 4, None);
    if let Some(mv) = best_move {
        println!("OK (best: {}, score: {}, nodes: {}, nps: {})",
            mv.to_uci(), info.score, info.nodes, info.nps);
    } else {
        println!("FAIL: no best move found");
    }

    println!("\n=== All tests passed! ===");
}
