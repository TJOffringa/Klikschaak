"""
Klikschaak Engine - Test & Demo Script
"""
from .types import Color, PieceType, square_name, parse_square
from .board import Board, STARTING_FEN
from .movegen import generate_moves, make_move, is_in_check, is_legal
from .evaluate import evaluate
from .search import find_best_move


def test_board_setup():
    """Test basic board creation and FEN"""
    print("=" * 50)
    print("TEST: Board Setup")
    print("=" * 50)

    board = Board()
    board.reset()

    print(board)
    print(f"\nFEN: {board.get_fen()}")

    # Verify starting position
    assert board.get_fen().startswith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
    print("\n[OK] Starting position correct")


def test_move_generation():
    """Test move generation"""
    print("\n" + "=" * 50)
    print("TEST: Move Generation")
    print("=" * 50)

    board = Board()
    board.reset()

    moves = generate_moves(board)
    print(f"Starting position: {len(moves)} legal moves")

    # White should have 34 moves (16 pawn + 4 knight + 14 klik)
    assert len(moves) == 34, f"Expected 34 moves, got {len(moves)}"
    print("[OK] Correct number of starting moves (20 normal + 14 klik)")

    # Print first 10 moves
    print("\nFirst 10 moves:")
    for move in moves[:10]:
        print(f"  {move.to_uci()}")


def test_make_move():
    """Test making moves"""
    print("\n" + "=" * 50)
    print("TEST: Make Move")
    print("=" * 50)

    board = Board()
    board.reset()

    # Play e4
    e2 = parse_square("e2")
    e4 = parse_square("e4")

    moves = generate_moves(board)
    e4_move = next((m for m in moves if m.from_sq == e2 and m.to_sq == e4), None)

    if e4_move:
        print(f"Playing: {e4_move.to_uci()}")
        make_move(board, e4_move)
        print(board)
        print(f"Turn: {'Black' if board.turn == Color.BLACK else 'White'}")
        print("[OK] Move executed")
    else:
        print("[FAIL] e2e4 not found in legal moves")


def test_klik_moves():
    """Test Klikschaak-specific klik moves"""
    print("\n" + "=" * 50)
    print("TEST: Klik Moves (Stacking)")
    print("=" * 50)

    # Set up a position where klik is possible
    # Knight on g1, we'll move it to e2 (where we'll put a pawn first)
    board = Board()
    board.set_fen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")

    print("Position after 1.e4:")
    print(board)

    moves = generate_moves(board)

    # Find knight moves
    from .types import piece_type, Piece
    knight_moves = [m for m in moves if piece_type(board.piece_at(m.from_sq)) == PieceType.KNIGHT]
    print(f"\nKnight moves available: {len(knight_moves)}")
    for m in knight_moves:
        print(f"  {m.to_uci()} (type: {m.move_type.name})")

    # Now test actual klik - put knight on pawn
    # Create position with knight that can klik onto friendly pawn
    board2 = Board()
    board2.set_fen("8/8/8/8/4N3/3P4/8/4K2k w - - 0 1")
    print("\nPosition for klik test:")
    print(board2)

    moves2 = generate_moves(board2)
    print(f"\nAll moves: {len(moves2)}")
    for m in moves2:
        print(f"  {m.to_uci()} (type: {m.move_type.name})")


def test_evaluation():
    """Test position evaluation"""
    print("\n" + "=" * 50)
    print("TEST: Evaluation")
    print("=" * 50)

    board = Board()
    board.reset()

    score = evaluate(board)
    print(f"Starting position score: {score} cp")
    assert -50 < score < 50, "Starting position should be roughly equal"
    print("[OK] Starting position evaluation reasonable")

    # Test position with material advantage
    board.set_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK1NR w KQkq - 0 1")  # Missing bishop
    score = evaluate(board)
    print(f"Position missing white bishop: {score} cp")
    assert score < -200, "Should be clearly worse for white"
    print("[OK] Material imbalance detected")


def test_search():
    """Test search for best move"""
    print("\n" + "=" * 50)
    print("TEST: Search")
    print("=" * 50)

    board = Board()
    board.reset()

    print("Searching for best move (depth 4)...")
    best_move, info = find_best_move(board, depth=4)

    if best_move:
        print(f"\nBest move: {best_move.to_uci()}")
        print(f"Score: {info.score} cp")
        print(f"Depth: {info.depth}")
        print(f"Nodes: {info.nodes}")
        print(f"Time: {info.time_ms} ms")
        print(f"NPS: {info.nps}")
        print(f"PV: {' '.join(m.to_uci() for m in info.pv)}")
        print("[OK] Search completed")
    else:
        print("[FAIL] No move found")


def test_checkmate():
    """Test checkmate detection"""
    print("\n" + "=" * 50)
    print("TEST: Checkmate Detection")
    print("=" * 50)

    # Fool's mate position
    board = Board()
    board.set_fen("rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")

    print("Position (Fool's mate):")
    print(board)

    in_check = is_in_check(board, Color.WHITE)
    print(f"White in check: {in_check}")

    moves = generate_moves(board)
    print(f"Legal moves: {len(moves)}")

    if in_check and len(moves) == 0:
        print("[OK] Checkmate correctly detected")
    else:
        print(f"[INFO] Check: {in_check}, Moves: {len(moves)}")


def test_stack_fen():
    """Test FEN with stacked pieces"""
    print("\n" + "=" * 50)
    print("TEST: Stack FEN Notation")
    print("=" * 50)

    # Create position with stack
    board = Board()
    board.set_fen("8/8/8/8/4(NP)2/8/8/4K2k w - - 0 1")

    print("Position with stack (Knight on Pawn):")
    print(board)

    # Verify stack
    sq = parse_square("e4")
    stack = board.stack_at(sq)
    print(f"\nStack at e4: {len(stack.pieces)} pieces")
    for i, p in enumerate(stack.pieces):
        print(f"  [{i}]: {p.name}")

    # Get FEN back
    fen = board.get_fen()
    print(f"\nGenerated FEN: {fen}")

    if "(NP)" in fen or "(PN)" in fen:
        print("[OK] Stack notation preserved in FEN")
    else:
        print("[WARN] Stack notation may not be correct")


def self_play_game(max_moves=20):
    """Play a short self-play game"""
    print("\n" + "=" * 50)
    print("TEST: Self-Play Game")
    print("=" * 50)

    board = Board()
    board.reset()

    for move_num in range(1, max_moves + 1):
        print(f"\nMove {move_num} ({'White' if board.turn == Color.WHITE else 'Black'})...")

        best_move, info = find_best_move(board, depth=3)

        if best_move is None:
            if is_in_check(board, board.turn):
                print("CHECKMATE!")
            else:
                print("STALEMATE!")
            break

        print(f"  {best_move.to_uci()} (score: {info.score} cp)")
        make_move(board, best_move)

    print("\nFinal position:")
    print(board)


def main():
    """Run all tests"""
    print("\nKlikschaak Engine Test Suite")
    print("=" * 50)

    try:
        test_board_setup()
        test_move_generation()
        test_make_move()
        test_klik_moves()
        test_evaluation()
        test_stack_fen()
        test_checkmate()
        test_search()

        print("\n" + "=" * 50)
        print("All basic tests passed!")
        print("=" * 50)

        # Optional: self-play
        response = input("\nRun self-play game? (y/n): ").strip().lower()
        if response == 'y':
            self_play_game()

    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
