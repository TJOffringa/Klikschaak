"""
Klikschaak Engine - Comprehensive Rule Tests
Tests all Klikschaak-specific rules and standard chess rules.
"""
from .types import (
    Color, Piece, PieceType, Square, Move, MoveType, CastlingRights,
    piece_color, piece_type, make_piece, parse_square, square_name
)
from .board import Board, STARTING_FEN
from .movegen import generate_moves, make_move, unmake_move, is_in_check, is_legal

passed = 0
failed = 0


def assert_eq(actual, expected, msg=""):
    global passed, failed
    if actual == expected:
        passed += 1
    else:
        failed += 1
        print(f"  [FAIL] {msg}: expected {expected}, got {actual}")


def assert_true(cond, msg=""):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print(f"  [FAIL] {msg}")


def find_moves(moves, from_sq=None, to_sq=None, move_type=None, unklik_index=None, promotion=None):
    """Filter moves by criteria."""
    result = []
    for m in moves:
        if from_sq is not None and m.from_sq != from_sq:
            continue
        if to_sq is not None and m.to_sq != to_sq:
            continue
        if move_type is not None and m.move_type != move_type:
            continue
        if unklik_index is not None and m.unklik_index != unklik_index:
            continue
        if promotion is not None and m.promotion != promotion:
            continue
        result.append(m)
    return result


def sq(name):
    return parse_square(name)


# =========================================================================
# 1. BASIC RULES
# =========================================================================

def test_starting_position():
    """Starting position should have 34 legal moves (20 normal + 14 klik)."""
    print("\n--- Starting Position ---")
    b = Board()
    b.reset()
    moves = generate_moves(b)
    assert_eq(len(moves), 34, "Starting position move count")

    # Count move types
    normal = [m for m in moves if m.move_type == MoveType.NORMAL]
    klik = [m for m in moves if m.move_type == MoveType.KLIK]
    assert_eq(len(normal), 20, "Normal moves (16 pawn + 4 knight)")
    assert_eq(len(klik), 14, "Klik moves (pieces klik onto back-rank pieces)")


def test_check_detection():
    """King in check should be detected."""
    print("\n--- Check Detection ---")
    b = Board()
    # White king on e1, black rook on e8
    b.set_fen("4r3/8/8/8/8/8/8/4K3 w - - 0 1")
    assert_true(is_in_check(b, Color.WHITE), "White should be in check from rook")
    assert_true(not is_in_check(b, Color.BLACK), "Black should not be in check")


def test_checkmate():
    """Checkmate = in check + no legal moves."""
    print("\n--- Checkmate ---")
    b = Board()
    # Back rank mate
    b.set_fen("6rk/5ppp/8/8/8/8/8/R3K3 w Q - 0 1")
    moves_w = generate_moves(b)
    # White should have moves (including Ra8#)
    ra8 = find_moves(moves_w, from_sq=sq("a1"), to_sq=sq("a8"))
    assert_true(len(ra8) > 0, "Ra8 should be available")

    # Set up actual mate position: fool's mate
    b.set_fen("rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")
    assert_true(is_in_check(b, Color.WHITE), "White in check")
    moves_b = generate_moves(b)
    assert_eq(len(moves_b), 0, "Checkmate: no legal moves")


def test_stalemate():
    """Stalemate = not in check + no legal moves."""
    print("\n--- Stalemate ---")
    b = Board()
    b.set_fen("k7/8/1K6/8/8/8/8/8 b - - 0 1")
    # Black king on a8, white king on b6. Not stalemate (a7 is available)
    moves = generate_moves(b)
    assert_true(len(moves) > 0, "Not stalemate: a7 available")

    # Real stalemate: black king cornered
    b.set_fen("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1")
    assert_true(not is_in_check(b, Color.BLACK), "Black NOT in check (stalemate)")
    moves = generate_moves(b)
    assert_eq(len(moves), 0, "Stalemate: no legal moves")


def test_cant_move_into_check():
    """King can't move to a square attacked by enemy."""
    print("\n--- Can't Move Into Check ---")
    b = Board()
    # Black queen on e3 attacks e2, d2, f2 (diagonals and file)
    b.set_fen("4k3/8/8/8/8/4q3/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    e1e2 = find_moves(moves, from_sq=sq("e1"), to_sq=sq("e2"))
    assert_eq(len(e1e2), 0, "King can't move to e2 (attacked by queen)")
    e1d2 = find_moves(moves, from_sq=sq("e1"), to_sq=sq("d2"))
    assert_eq(len(e1d2), 0, "King can't move to d2 (attacked by queen)")
    e1f2 = find_moves(moves, from_sq=sq("e1"), to_sq=sq("f2"))
    assert_eq(len(e1f2), 0, "King can't move to f2 (attacked by queen)")
    # d1 and f1 should be safe
    e1d1 = find_moves(moves, from_sq=sq("e1"), to_sq=sq("d1"))
    e1f1 = find_moves(moves, from_sq=sq("e1"), to_sq=sq("f1"))
    assert_eq(len(e1d1), 1, "King can move to d1 (safe)")
    assert_eq(len(e1f1), 1, "King can move to f1 (safe)")


def test_must_escape_check():
    """When in check, must make a move that escapes check."""
    print("\n--- Must Escape Check ---")
    b = Board()
    # White king on e1, black queen on e8, pawn on d2
    b.set_fen("4q3/8/8/8/8/8/3P4/4K3 w - - 0 1")
    assert_true(is_in_check(b, Color.WHITE), "White in check")
    moves = generate_moves(b)
    # All moves must escape check
    for m in moves:
        undo = make_move(b, m)
        assert_true(not is_in_check(b, Color.WHITE.opposite()),
                    f"Move {m.to_uci()} should escape check")
        unmake_move(b, m, undo)


# =========================================================================
# 2. KLIK RULES
# =========================================================================

def test_klik_basic():
    """Non-king piece can klik onto friendly non-king single piece."""
    print("\n--- Klik Basic ---")
    b = Board()
    # Knight on e4, pawn on d3 (both white)
    b.set_fen("4k3/8/8/8/4N3/3P4/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_d3 = find_moves(moves, from_sq=sq("e4"), to_sq=sq("d3"), move_type=MoveType.KLIK)
    assert_true(len(klik_d3) == 0, "Knight on e4 can't reach d3 (not valid knight move)")

    # Knight on d5 CAN klik to e3 (valid knight move, friendly pawn there)
    b.set_fen("4k3/8/8/3N4/8/4P3/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_e3 = find_moves(moves, from_sq=sq("d5"), to_sq=sq("e3"), move_type=MoveType.KLIK)
    assert_eq(len(klik_e3), 1, "Knight d5 can klik to e3 (friendly pawn)")

    # Knight on c4, pawn on d2 -> knight CAN klik to d2
    b.set_fen("4k3/8/8/8/2N5/8/3P4/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_d2 = find_moves(moves, from_sq=sq("c4"), to_sq=sq("d2"), move_type=MoveType.KLIK)
    assert_eq(len(klik_d2), 1, "Knight should klik to d2")


def test_klik_not_onto_king():
    """Can't klik onto a king."""
    print("\n--- Klik Not Onto King ---")
    b = Board()
    # Knight on c2, king on e1 -> knight can't klik to e1
    b.set_fen("4k3/8/8/8/8/8/2N5/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_e1 = find_moves(moves, from_sq=sq("c2"), to_sq=sq("e1"), move_type=MoveType.KLIK)
    assert_eq(len(klik_e1), 0, "Can't klik onto king")


def test_king_cant_klik():
    """King can never make a klik move."""
    print("\n--- King Can't Klik ---")
    b = Board()
    # King on e1, pawn on d2
    b.set_fen("4k3/8/8/8/8/8/3P4/4K3 w - - 0 1")
    moves = generate_moves(b)
    king_kliks = find_moves(moves, from_sq=sq("e1"), move_type=MoveType.KLIK)
    assert_eq(len(king_kliks), 0, "King can't klik")


def test_klik_not_onto_full_stack():
    """Can't klik onto a square that already has 2 pieces."""
    print("\n--- Klik Not Onto Full Stack ---")
    b = Board()
    # Bishop on a3, stack (NP) on c1 -> bishop goes to c1? No, already 2 pieces
    b.set_fen("4k3/8/8/8/8/B7/8/2(NP)1K3 w - - 0 1")
    moves = generate_moves(b)
    klik_c1 = find_moves(moves, from_sq=sq("a3"), to_sq=sq("c1"), move_type=MoveType.KLIK)
    assert_eq(len(klik_c1), 0, "Can't klik onto full stack")


def test_klik_not_onto_enemy():
    """Klik is only for friendly pieces. Enemy = capture."""
    print("\n--- Klik Not Onto Enemy ---")
    b = Board()
    # White knight on c4, black pawn on d2
    b.set_fen("4k3/8/8/8/2N5/8/3p4/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_d2 = find_moves(moves, from_sq=sq("c4"), to_sq=sq("d2"), move_type=MoveType.KLIK)
    capture_d2 = find_moves(moves, from_sq=sq("c4"), to_sq=sq("d2"), move_type=MoveType.CAPTURE)
    assert_eq(len(klik_d2), 0, "Can't klik onto enemy")
    assert_eq(len(capture_d2), 1, "Should be a capture")


# =========================================================================
# 3. PAWN FORWARD KLIK
# =========================================================================

def test_pawn_forward_klik_one_square():
    """Pawn can klik 1 square forward onto friendly non-king piece."""
    print("\n--- Pawn Forward Klik (1 square) ---")
    b = Board()
    # White pawn on e4, white knight on e5
    b.set_fen("4k3/8/8/4N3/4P3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik = find_moves(moves, from_sq=sq("e4"), to_sq=sq("e5"), move_type=MoveType.KLIK)
    assert_eq(len(klik), 1, "Pawn should klik forward to e5")


def test_pawn_forward_klik_two_squares():
    """Pawn can klik 2 squares forward from start onto friendly piece."""
    print("\n--- Pawn Forward Klik (2 squares) ---")
    b = Board()
    # White pawn on e2 (unmoved), e3 empty, white knight on e4
    b.set_fen("4k3/8/8/8/4N3/8/4P3/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik = find_moves(moves, from_sq=sq("e2"), to_sq=sq("e4"), move_type=MoveType.KLIK)
    assert_eq(len(klik), 1, "Pawn should double-klik forward to e4")


def test_pawn_forward_klik_blocked():
    """Pawn can't double-klik if intermediate square is occupied."""
    print("\n--- Pawn Forward Klik Blocked ---")
    b = Board()
    # White pawn on e2, white bishop on e3 (blocks), white knight on e4
    b.set_fen("4k3/8/8/8/4N3/4B3/4P3/4K3 w - - 0 1")
    moves = generate_moves(b)
    # e2 can klik to e3 (bishop), but NOT double to e4 (e3 occupied)
    klik_e3 = find_moves(moves, from_sq=sq("e2"), to_sq=sq("e3"), move_type=MoveType.KLIK)
    klik_e4 = find_moves(moves, from_sq=sq("e2"), to_sq=sq("e4"), move_type=MoveType.KLIK)
    assert_eq(len(klik_e3), 1, "Pawn can klik to e3")
    assert_eq(len(klik_e4), 0, "Pawn can't double-klik when e3 occupied")


def test_pawn_forward_klik_not_onto_king():
    """Pawn can't klik forward onto a king."""
    print("\n--- Pawn Forward Klik Not Onto King ---")
    b = Board()
    # White pawn on e4, white king on e5 (wrong position but tests rule)
    b.set_fen("4k3/8/8/4K3/4P3/8/8/8 w - - 0 1")
    moves = generate_moves(b)
    klik = find_moves(moves, from_sq=sq("e4"), to_sq=sq("e5"), move_type=MoveType.KLIK)
    assert_eq(len(klik), 0, "Pawn can't klik onto king")


def test_pawn_forward_klik_not_diagonal():
    """Pawn klik is straight forward only, not diagonal."""
    print("\n--- Pawn Forward Klik Not Diagonal ---")
    b = Board()
    # White pawn on e4, white knight on d5 and f5
    b.set_fen("4k3/8/8/3N1N2/4P3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_d5 = find_moves(moves, from_sq=sq("e4"), to_sq=sq("d5"), move_type=MoveType.KLIK)
    klik_f5 = find_moves(moves, from_sq=sq("e4"), to_sq=sq("f5"), move_type=MoveType.KLIK)
    assert_eq(len(klik_d5), 0, "Pawn can't klik diagonally to d5")
    assert_eq(len(klik_f5), 0, "Pawn can't klik diagonally to f5")


def test_pawn_klik_not_to_promo_rank():
    """Pawn klik can't go to promotion rank (would need to promote)."""
    print("\n--- Pawn Klik Not To Promo Rank ---")
    b = Board()
    # White pawn on e7, white knight on e8 -> can't klik to promo rank
    b.set_fen("4Nk2/4P3/8/8/8/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_e8 = find_moves(moves, from_sq=sq("e7"), to_sq=sq("e8"), move_type=MoveType.KLIK)
    assert_eq(len(klik_e8), 0, "Pawn can't klik to promotion rank")
    # But promotion should exist
    promo = find_moves(moves, from_sq=sq("e7"), to_sq=sq("e8"), move_type=MoveType.PROMOTION)
    assert_true(len(promo) == 0, "Can't promote either (e8 occupied by friendly)")


def test_pawn_double_move_unmoved_only():
    """Pawn double move only when pawn hasn't moved (unmoved_pawns bit set)."""
    print("\n--- Pawn Double Move Unmoved Only ---")
    b = Board()
    b.set_fen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")
    # Clear e-file bit to simulate moved pawn
    b.unmoved_pawns[Color.WHITE] &= ~(1 << 4)
    moves = generate_moves(b)
    double = find_moves(moves, from_sq=sq("e2"), to_sq=sq("e4"), move_type=MoveType.NORMAL)
    single = find_moves(moves, from_sq=sq("e2"), to_sq=sq("e3"), move_type=MoveType.NORMAL)
    assert_eq(len(double), 0, "Can't double-move with cleared bit")
    assert_eq(len(single), 1, "Single forward still works")


# =========================================================================
# 4. UNKLIK RULES
# =========================================================================

def test_unklik_basic():
    """Each piece in a stack can unklik independently."""
    print("\n--- Unklik Basic ---")
    b = Board()
    # Stack (NP) on e4 - knight bottom (idx 0), pawn top (idx 1)
    b.set_fen("4k3/8/8/8/4(NP)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    knight_unklik = find_moves(moves, from_sq=sq("e4"), unklik_index=0,
                                move_type=MoveType.UNKLIK)
    pawn_unklik = find_moves(moves, from_sq=sq("e4"), unklik_index=1,
                              move_type=MoveType.UNKLIK)
    assert_eq(len(knight_unklik), 8, "Knight should have 8 unklik targets")
    assert_eq(len(pawn_unklik), 1, "Pawn should have 1 unklik target (e5)")


def test_unklik_capture():
    """Unklik piece can capture enemy."""
    print("\n--- Unklik Capture ---")
    b = Board()
    # Stack (NP) on e4, black pawn on d6
    b.set_fen("4k3/8/3p4/8/4(NP)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    # Knight unklik can capture d6
    capture = find_moves(moves, from_sq=sq("e4"), to_sq=sq("d6"),
                          unklik_index=0, move_type=MoveType.UNKLIK)
    assert_eq(len(capture), 1, "Knight unklik should capture on d6")


def test_unklik_klik():
    """Unklik piece can klik onto another friendly piece."""
    print("\n--- Unklik Klik ---")
    b = Board()
    # Stack (NP) on e4, white bishop on c3
    b.set_fen("4k3/8/8/8/4(NP)3/2B5/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    unklik_klik = find_moves(moves, from_sq=sq("e4"), to_sq=sq("c3"),
                              unklik_index=0, move_type=MoveType.UNKLIK_KLIK)
    assert_eq(len(unklik_klik), 1, "Knight unklik-klik to c3 (onto bishop)")


# =========================================================================
# 5. COMBINED STACK MOVES
# =========================================================================

def test_combined_moves_union():
    """Combined moves = union of both pieces' movement patterns."""
    print("\n--- Combined Moves Union ---")
    b = Board()
    # Stack (NP) on e4 - knight + pawn
    b.set_fen("4k3/8/8/8/4(NP)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    # Combined = NORMAL moves from e4 (not unklik)
    combined = find_moves(moves, from_sq=sq("e4"), move_type=MoveType.NORMAL)
    combined_targets = {m.to_sq for m in combined}

    # Knight targets: d2, f2, c3, g3, c5, g5, d6, f6
    knight_targets = {sq("d2"), sq("f2"), sq("c3"), sq("g3"),
                      sq("c5"), sq("g5"), sq("d6"), sq("f6")}
    # Pawn target: e5
    pawn_targets = {sq("e5")}
    expected = knight_targets | pawn_targets

    assert_eq(combined_targets, expected,
              f"Combined targets should be union of knight+pawn moves")


def test_combined_cant_klik():
    """Combined stack can't klik (would exceed 2 piece max)."""
    print("\n--- Combined Can't Klik ---")
    b = Board()
    # Stack (NP) on e4, white bishop on c5
    b.set_fen("4k3/8/8/2B5/4(NP)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    # Combined to c5 should NOT exist (c5 has friendly piece, can't stack 3)
    combined_c5 = find_moves(moves, from_sq=sq("e4"), to_sq=sq("c5"),
                              move_type=MoveType.NORMAL)
    klik_c5 = find_moves(moves, from_sq=sq("e4"), to_sq=sq("c5"),
                           move_type=MoveType.KLIK)
    assert_eq(len(combined_c5), 0, "Combined can't go to occupied friendly square")
    assert_eq(len(klik_c5), 0, "Combined can't klik")


def test_combined_capture():
    """Combined stack can capture enemy pieces."""
    print("\n--- Combined Capture ---")
    b = Board()
    # Stack (NP) on e4, black pawn on d6
    b.set_fen("4k3/8/3p4/8/4(NP)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    combined_capture = find_moves(moves, from_sq=sq("e4"), to_sq=sq("d6"),
                                   move_type=MoveType.CAPTURE)
    assert_eq(len(combined_capture), 1, "Combined should capture on d6")

    # Make the capture and verify both pieces moved
    cap_move = combined_capture[0]
    undo = make_move(b, cap_move)
    d6_stack = b.stack_at(sq("d6"))
    assert_eq(len(d6_stack.pieces), 2, "Both pieces should be on d6 after capture")
    e4_stack = b.stack_at(sq("e4"))
    assert_eq(len(e4_stack.pieces), 0, "e4 should be empty")
    unmake_move(b, cap_move, undo)


def test_combined_back_rank_restriction():
    """Pawn can't go to own back rank in combined moves."""
    print("\n--- Combined Back Rank Restriction ---")
    b = Board()
    # Stack (NP) on b2 (white). Knight targets include d1 (back rank)
    b.set_fen("4k3/8/8/8/8/8/1(NP)6/4K3 w - - 0 1")
    moves = generate_moves(b)
    combined_d1 = find_moves(moves, from_sq=sq("b2"), to_sq=sq("d1"),
                              move_type=MoveType.NORMAL)
    assert_eq(len(combined_d1), 0, "Combined with pawn can't go to back rank")

    # Knight unklik to d1 should still work
    unklik_d1 = find_moves(moves, from_sq=sq("b2"), to_sq=sq("d1"),
                            move_type=MoveType.UNKLIK)
    assert_eq(len(unklik_d1), 1, "Knight unklik to d1 is fine")

    # Also test for black
    b.set_fen("4k3/1(np)6/8/8/8/8/8/4K3 b - - 0 1")
    moves_b = generate_moves(b)
    # Knight from b7: targets a5, c5, d6, d8 (back rank for black)
    combined_d8 = find_moves(moves_b, from_sq=sq("b7"), to_sq=sq("d8"),
                              move_type=MoveType.NORMAL)
    assert_eq(len(combined_d8), 0, "Black combined with pawn can't go to rank 8")


def test_combined_carried_to_promo():
    """Non-pawn movement can't carry pawn to promotion rank."""
    print("\n--- Combined Carried-to-Promo Restriction ---")
    b = Board()
    # Stack (NP) on e6. Knight targets include d8, f8 (promo rank for white)
    b.set_fen("4k3/8/4(NP)3/8/8/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    combined_d8 = find_moves(moves, from_sq=sq("e6"), to_sq=sq("d8"),
                              move_type=MoveType.NORMAL)
    combined_f8 = find_moves(moves, from_sq=sq("e6"), to_sq=sq("f8"),
                              move_type=MoveType.NORMAL)
    assert_eq(len(combined_d8), 0, "Can't carry pawn to d8 via knight")
    assert_eq(len(combined_f8), 0, "Can't carry pawn to f8 via knight")

    # But e7 (pawn forward, not promo rank) should work
    combined_e7 = find_moves(moves, from_sq=sq("e6"), to_sq=sq("e7"),
                              move_type=MoveType.NORMAL)
    assert_eq(len(combined_e7), 1, "Combined to e7 via pawn movement is fine")


def test_combined_promotion():
    """Pawn in stack promotes via own movement, companion comes along."""
    print("\n--- Combined Promotion ---")
    b = Board()
    # Stack (NP) on e7. Pawn can promote to e8 (empty)
    b.set_fen("8/4(NP)3/8/8/8/8/8/4K2k w - - 0 1")
    moves = generate_moves(b)
    combined_promo = find_moves(moves, from_sq=sq("e7"), to_sq=sq("e8"),
                                 move_type=MoveType.PROMOTION, unklik_index=-1)
    assert_eq(len(combined_promo), 4, "4 combined promotion options (Q,R,B,N)")

    # Make queen promotion
    queen_promo = [m for m in combined_promo if m.promotion == PieceType.QUEEN][0]
    undo = make_move(b, queen_promo)
    e8 = b.stack_at(sq("e8"))
    assert_eq(len(e8.pieces), 2, "e8 should have 2 pieces (companion + promoted)")
    assert_eq(piece_type(e8.pieces[0]), PieceType.KNIGHT, "Bottom: knight (companion)")
    assert_eq(piece_type(e8.pieces[1]), PieceType.QUEEN, "Top: queen (promoted)")
    unmake_move(b, queen_promo, undo)
    assert_eq(len(b.stack_at(sq("e7")).pieces), 2, "Undo restores e7 stack")


def test_combined_promotion_capture():
    """Combined promotion with capture."""
    print("\n--- Combined Promotion Capture ---")
    b = Board()
    # Stack (NP) on d7. Black rook on e8. Pawn can capture-promote diag.
    b.set_fen("4rk2/3(NP)4/8/8/8/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    promo_cap = find_moves(moves, from_sq=sq("d7"), to_sq=sq("e8"),
                            move_type=MoveType.PROMOTION_CAPTURE, unklik_index=-1)
    assert_eq(len(promo_cap), 4, "4 combined promotion-capture options")


def test_combined_en_passant():
    """Combined en passant: stack captures en passant pawn."""
    print("\n--- Combined En Passant ---")
    b = Board()
    # Stack (BP) on e5, black just played d7-d5 (ep square = d6)
    b.set_fen("4k3/8/8/3p(BP)2/8/8/8/4K3 w - d6 0 1")
    moves = generate_moves(b)
    combined_ep = find_moves(moves, from_sq=sq("e5"), to_sq=sq("d6"),
                              move_type=MoveType.EN_PASSANT, unklik_index=-1)
    assert_eq(len(combined_ep), 1, "Combined en passant should be available")

    # Make the move and verify
    ep_move = combined_ep[0]
    undo = make_move(b, ep_move)
    d6 = b.stack_at(sq("d6"))
    d5 = b.stack_at(sq("d5"))
    assert_eq(len(d6.pieces), 2, "Stack moved to d6")
    assert_eq(len(d5.pieces), 0, "Captured pawn on d5 removed")
    unmake_move(b, ep_move, undo)


def test_combined_without_pawn_no_restriction():
    """Combined stack without pawn has no back-rank or promo restrictions."""
    print("\n--- Combined Without Pawn No Restriction ---")
    b = Board()
    # Stack (NB) on e4 - knight + bishop, no pawn
    b.set_fen("4k3/8/8/8/4(NB)3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    # Knight targets: d2, f2, c3, g3, c5, g5, d6, f6
    # Bishop targets: d3, f3, d5, f5, c2, g2, b1, h1, c6, g6, b7, h7, a8
    combined = find_moves(moves, from_sq=sq("e4"), move_type=MoveType.NORMAL)
    combined_targets = {m.to_sq for m in combined}
    # d2 is back rank for white but no pawn → should be allowed
    assert_true(sq("d2") in combined_targets, "d2 allowed (no pawn in stack)")


# =========================================================================
# 6. CASTLING
# =========================================================================

def test_castling_normal():
    """Normal kingside and queenside castling."""
    print("\n--- Normal Castling ---")
    b = Board()
    b.set_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1")
    moves = generate_moves(b)
    castle_k = find_moves(moves, move_type=MoveType.CASTLE_K)
    castle_q = find_moves(moves, move_type=MoveType.CASTLE_Q)
    assert_eq(len(castle_k), 1, "Kingside castle available")
    assert_eq(len(castle_q), 1, "Queenside castle available")


def test_castling_blocked():
    """Can't castle when pieces are in the way."""
    print("\n--- Castling Blocked ---")
    b = Board()
    b.set_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/RN2K1NR w KQkq - 0 1")
    moves = generate_moves(b)
    castle_k = find_moves(moves, move_type=MoveType.CASTLE_K)
    castle_q = find_moves(moves, move_type=MoveType.CASTLE_Q)
    assert_eq(len(castle_k), 0, "Kingside blocked by knight")
    assert_eq(len(castle_q), 0, "Queenside blocked by knight")


def test_castling_in_check():
    """Can't castle while in check."""
    print("\n--- Castling In Check ---")
    b = Board()
    b.set_fen("r3k2r/pppp1ppp/8/4q3/8/8/PPPP1PPP/R3K2R w KQkq - 0 1")
    # White king is not in check yet... let me use a proper position
    b.set_fen("4k3/8/8/8/4r3/8/8/R3K2R w KQ - 0 1")
    assert_true(is_in_check(b, Color.WHITE), "White in check from rook")
    moves = generate_moves(b)
    castle_k = find_moves(moves, move_type=MoveType.CASTLE_K)
    castle_q = find_moves(moves, move_type=MoveType.CASTLE_Q)
    assert_eq(len(castle_k), 0, "Can't castle while in check")
    assert_eq(len(castle_q), 0, "Can't castle while in check")


def test_castling_through_check():
    """Can't castle through an attacked square."""
    print("\n--- Castling Through Check ---")
    b = Board()
    # Black rook on f8 attacks f1 -> kingside blocked
    b.set_fen("5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1")
    moves = generate_moves(b)
    castle_k = find_moves(moves, move_type=MoveType.CASTLE_K)
    assert_eq(len(castle_k), 0, "Can't castle kingside (f1 attacked)")
    # Queenside: d1 attacked?
    # Rook on f8 doesn't attack d1, so queenside should work
    castle_q = find_moves(moves, move_type=MoveType.CASTLE_Q)
    assert_eq(len(castle_q), 1, "Queenside castle ok (d1 not attacked)")


def test_castling_stacked_rook():
    """Castling with rook in a stack: rook unklik, companion stays."""
    print("\n--- Castling With Stacked Rook ---")
    b = Board()
    # Rook+Bishop stack on h1
    b.set_fen("4k3/8/8/8/8/8/8/4K2(RB) w K - 0 1")
    moves = generate_moves(b)
    castle_k = find_moves(moves, move_type=MoveType.CASTLE_K)
    assert_eq(len(castle_k), 1, "Castle with stacked rook available")

    # Make the castle move
    undo = make_move(b, castle_k[0])
    assert_eq(b.stack_at(sq("g1")).pieces, [Piece.W_KING], "King on g1")
    assert_eq(b.stack_at(sq("f1")).pieces, [Piece.W_ROOK], "Rook on f1")
    assert_eq(b.stack_at(sq("h1")).pieces, [Piece.W_BISHOP], "Bishop stays on h1")
    unmake_move(b, castle_k[0], undo)


def test_castling_klik():
    """Castling where rook kliks onto friendly piece at f1/d1."""
    print("\n--- Castling Klik ---")
    b = Board()
    # Rook on h1, pawn on f1, g1 empty
    b.set_fen("4k3/8/8/8/8/8/8/4KP1R w K - 0 1")
    moves = generate_moves(b)
    castle_klik = find_moves(moves, move_type=MoveType.CASTLE_K_KLIK)
    assert_eq(len(castle_klik), 1, "Castle klik available")

    # No normal castle (f1 occupied)
    castle_normal = find_moves(moves, move_type=MoveType.CASTLE_K)
    assert_eq(len(castle_normal), 0, "Normal castle not available (f1 occupied)")

    # Make castle klik
    undo = make_move(b, castle_klik[0])
    assert_eq(b.stack_at(sq("g1")).pieces, [Piece.W_KING], "King on g1")
    f1 = b.stack_at(sq("f1"))
    assert_eq(len(f1.pieces), 2, "Rook klikked onto pawn at f1")
    assert_true(Piece.W_ROOK in f1.pieces, "Rook is on f1")
    assert_true(Piece.W_PAWN in f1.pieces, "Pawn still on f1")
    unmake_move(b, castle_klik[0], undo)


def test_castling_queenside_klik():
    """Queenside castle with rook klik."""
    print("\n--- Queenside Castling Klik ---")
    b = Board()
    # Rook on a1, pawn on d1, b1 and c1 empty
    b.set_fen("4k3/8/8/8/8/8/8/R2PK3 w Q - 0 1")
    moves = generate_moves(b)
    castle_q_klik = find_moves(moves, move_type=MoveType.CASTLE_Q_KLIK)
    assert_eq(len(castle_q_klik), 1, "Queenside castle klik available")

    undo = make_move(b, castle_q_klik[0])
    assert_eq(b.stack_at(sq("c1")).pieces, [Piece.W_KING], "King on c1")
    d1 = b.stack_at(sq("d1"))
    assert_eq(len(d1.pieces), 2, "Rook klikked onto pawn at d1")
    unmake_move(b, castle_q_klik[0], undo)


def test_castling_rights_updated():
    """Castling rights update after king or rook moves."""
    print("\n--- Castling Rights Updated ---")
    b = Board()
    b.set_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1")

    # Move king
    king_move = find_moves(generate_moves(b), from_sq=sq("e1"), to_sq=sq("f1"),
                            move_type=MoveType.NORMAL)
    assert_true(len(king_move) > 0, "King can move to f1")
    undo = make_move(b, king_move[0])
    assert_eq(b.castling & CastlingRights.WHITE, 0, "White lost castling rights")
    assert_true(b.castling & CastlingRights.BLACK != 0, "Black still has rights")
    unmake_move(b, king_move[0], undo)
    assert_eq(b.castling, CastlingRights.ALL, "Rights restored after undo")


# =========================================================================
# 7. EN PASSANT
# =========================================================================

def test_en_passant_basic():
    """Basic en passant capture."""
    print("\n--- En Passant Basic ---")
    b = Board()
    # White pawn on e5, black just played d7-d5
    b.set_fen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
    moves = generate_moves(b)
    ep = find_moves(moves, from_sq=sq("e5"), to_sq=sq("d6"), move_type=MoveType.EN_PASSANT)
    assert_eq(len(ep), 1, "En passant available")

    undo = make_move(b, ep[0])
    assert_eq(len(b.stack_at(sq("d6")).pieces), 1, "Pawn on d6")
    assert_eq(len(b.stack_at(sq("d5")).pieces), 0, "Captured pawn removed from d5")
    assert_eq(len(b.stack_at(sq("e5")).pieces), 0, "e5 empty")
    unmake_move(b, ep[0], undo)


def test_en_passant_square_set():
    """En passant square set after double pawn move."""
    print("\n--- En Passant Square Set ---")
    b = Board()
    b.set_fen("4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1")
    # White plays e2-e4
    e2e4 = find_moves(generate_moves(b), from_sq=sq("e2"), to_sq=sq("e4"),
                       move_type=MoveType.NORMAL)
    assert_eq(len(e2e4), 1, "e2-e4 available")
    undo = make_move(b, e2e4[0])
    assert_eq(b.ep_square, sq("e3"), "EP square set to e3")
    unmake_move(b, e2e4[0], undo)
    assert_eq(b.ep_square, None, "EP square restored to None")


def test_en_passant_unklik():
    """En passant from unklik position (pawn in stack)."""
    print("\n--- En Passant Unklik ---")
    b = Board()
    # Stack (NP) on e5, black pawn just did d7-d5
    b.set_fen("4k3/8/8/3p(NP)2/8/8/8/4K3 w - d6 0 1")
    moves = generate_moves(b)
    # Pawn (idx 1) can unklik to d6 with en passant
    ep_unklik = find_moves(moves, from_sq=sq("e5"), to_sq=sq("d6"),
                            move_type=MoveType.EN_PASSANT, unklik_index=1)
    assert_eq(len(ep_unklik), 1, "En passant unklik available")


# =========================================================================
# 8. PROMOTION
# =========================================================================

def test_promotion_basic():
    """Basic pawn promotion (4 choices)."""
    print("\n--- Promotion Basic ---")
    b = Board()
    b.set_fen("8/4P3/8/8/8/8/8/4K2k w - - 0 1")
    moves = generate_moves(b)
    promos = find_moves(moves, from_sq=sq("e7"), to_sq=sq("e8"),
                          move_type=MoveType.PROMOTION)
    assert_eq(len(promos), 4, "4 promotion choices")
    promo_types = {m.promotion for m in promos}
    assert_eq(promo_types, {PieceType.QUEEN, PieceType.ROOK,
                            PieceType.BISHOP, PieceType.KNIGHT},
              "All promotion types available")


def test_promotion_capture():
    """Promotion with capture."""
    print("\n--- Promotion Capture ---")
    b = Board()
    b.set_fen("3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    promo_cap = find_moves(moves, from_sq=sq("e7"), to_sq=sq("d8"),
                            move_type=MoveType.PROMOTION_CAPTURE)
    assert_eq(len(promo_cap), 4, "4 promotion-capture choices")


def test_unklik_promotion():
    """Pawn unklik from stack to promote."""
    print("\n--- Unklik Promotion ---")
    b = Board()
    # Stack (NP) on e7, pawn idx 1. Black king away from e8.
    b.set_fen("7k/4(NP)3/8/8/8/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    unklik_promo = find_moves(moves, from_sq=sq("e7"), to_sq=sq("e8"),
                               move_type=MoveType.PROMOTION, unklik_index=1)
    assert_eq(len(unklik_promo), 4, "4 unklik promotion choices")

    # Make queen promotion (unklik)
    queen = [m for m in unklik_promo if m.promotion == PieceType.QUEEN][0]
    undo = make_move(b, queen)
    e7 = b.stack_at(sq("e7"))
    e8 = b.stack_at(sq("e8"))
    assert_eq(len(e7.pieces), 1, "Knight stays on e7")
    assert_eq(piece_type(e7.pieces[0]), PieceType.KNIGHT, "Knight remains")
    assert_eq(len(e8.pieces), 1, "Queen on e8")
    assert_eq(piece_type(e8.pieces[0]), PieceType.QUEEN, "Promoted to queen")
    unmake_move(b, queen, undo)


# =========================================================================
# 9. MAKE/UNMAKE CONSISTENCY
# =========================================================================

def test_make_unmake_all_move_types():
    """Make/unmake should fully restore board state for all move types."""
    print("\n--- Make/Unmake Consistency ---")

    test_positions = [
        ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Starting"),
        ("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", "Castling"),
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "En passant"),
        ("4k3/4P3/8/8/8/8/8/4K3 w - - 0 1", "Promotion"),
        ("4k3/8/8/8/4(NP)3/8/8/4K3 w - - 0 1", "Stacked"),
        ("8/4(NP)3/8/8/8/8/8/4K2k w - - 0 1", "Combined promo"),
        ("4k3/8/8/8/8/8/8/4KP1R w K - 0 1", "Castle klik"),
        ("4k3/8/8/8/4N3/8/4P3/4K3 w - - 0 1", "Pawn klik"),
    ]

    for fen, name in test_positions:
        b = Board()
        b.set_fen(fen)
        original_fen = b.get_fen()
        original_unmoved = b.unmoved_pawns[:]

        moves = generate_moves(b)
        for m in moves:
            undo = make_move(b, m)
            unmake_move(b, m, undo)
            restored_fen = b.get_fen()
            if restored_fen != original_fen:
                assert_true(False, f"{name}: FEN mismatch after {m.to_uci()}: "
                           f"got {restored_fen}")
            if b.unmoved_pawns != original_unmoved:
                assert_true(False, f"{name}: unmoved_pawns mismatch after {m.to_uci()}")

        assert_true(True, f"{name}: all {len(moves)} moves OK")


# =========================================================================
# 10. EDGE CASES AND INTERACTIONS
# =========================================================================

def test_klik_then_unklik():
    """After klik, the stacked piece can unklik on next turn."""
    print("\n--- Klik Then Unklik ---")
    b = Board()
    # White knight kliks onto pawn at d2
    b.set_fen("4k3/8/8/8/2N5/8/3P4/4K3 w - - 0 1")
    klik_move = find_moves(generate_moves(b), from_sq=sq("c4"), to_sq=sq("d2"),
                            move_type=MoveType.KLIK)[0]
    make_move(b, klik_move)
    # Now it's black's turn. Black passes (move a king)
    bk_move = generate_moves(b)[0]
    make_move(b, bk_move)
    # Now white can unklik from d2
    moves = generate_moves(b)
    unklik_from_d2 = [m for m in moves if m.from_sq == sq("d2") and
                      m.move_type in (MoveType.UNKLIK, MoveType.UNKLIK_KLIK)]
    assert_true(len(unklik_from_d2) > 0, "Can unklik from stack after klik")


def test_double_klik_not_allowed():
    """Can't klik onto a square that already has 2 pieces."""
    print("\n--- Double Klik Not Allowed ---")
    b = Board()
    # Stack (NP) on d2, bishop on c4 trying to klik to d2
    b.set_fen("4k3/8/8/8/2B5/8/3(NP)4/4K3 w - - 0 1")
    moves = generate_moves(b)
    klik_d2 = find_moves(moves, from_sq=sq("c4"), to_sq=sq("d2"),
                           move_type=MoveType.KLIK)
    assert_eq(len(klik_d2), 0, "Can't klik onto full stack")


def test_pinned_piece():
    """A pinned piece can't move off the pin line."""
    print("\n--- Pinned Piece ---")
    b = Board()
    # White king on e1, white rook on e4, black rook on e8
    # White rook is pinned on e-file: can move along e-file but not off it
    b.set_fen("4r2k/8/8/8/4R3/8/8/4K3 w - - 0 1")
    moves = generate_moves(b)
    # Rook can move along e-file (e2, e3, e5, e6, e7, e8 capture)
    rook_on_efile = [m for m in moves if m.from_sq == sq("e4") and (m.to_sq & 7) == 4]
    rook_off_efile = [m for m in moves if m.from_sq == sq("e4") and (m.to_sq & 7) != 4]
    assert_true(len(rook_on_efile) > 0, "Rook can move along e-file")
    assert_eq(len(rook_off_efile), 0, "Rook can't move off e-file (pinned)")

    # Stack unklik: after unklik from stack, remaining piece still blocks
    b2 = Board()
    b2.set_fen("4r2k/8/8/8/8/8/4(RP)3/4K3 w - - 0 1")
    moves2 = generate_moves(b2)
    # Rook CAN unklik horizontally because pawn remains blocking
    rook_horiz = [m for m in moves2 if m.from_sq == sq("e2") and
                   m.unklik_index == 0 and (m.to_sq & 7) != 4]
    assert_true(len(rook_horiz) > 0,
                "Rook CAN unklik off e-file (pawn remains blocking)")


def test_self_play_no_crash():
    """Play a short self-play game to test no crashes with new rules."""
    print("\n--- Self-Play No Crash ---")
    from .search import find_best_move

    b = Board()
    b.reset()

    for i in range(10):
        best_move, info = find_best_move(b, depth=2)
        if best_move is None:
            assert_true(True, f"Game ended after {i} moves")
            return
        make_move(b, best_move)

    assert_true(True, "10 half-moves without crash")


# =========================================================================
# MAIN
# =========================================================================

def run_all_tests():
    global passed, failed

    print("=" * 60)
    print("Klikschaak Engine - Comprehensive Rule Tests")
    print("=" * 60)

    # Basic rules
    test_starting_position()
    test_check_detection()
    test_checkmate()
    test_stalemate()
    test_cant_move_into_check()
    test_must_escape_check()

    # Klik rules
    test_klik_basic()
    test_klik_not_onto_king()
    test_king_cant_klik()
    test_klik_not_onto_full_stack()
    test_klik_not_onto_enemy()

    # Pawn forward klik
    test_pawn_forward_klik_one_square()
    test_pawn_forward_klik_two_squares()
    test_pawn_forward_klik_blocked()
    test_pawn_forward_klik_not_onto_king()
    test_pawn_forward_klik_not_diagonal()
    test_pawn_klik_not_to_promo_rank()
    test_pawn_double_move_unmoved_only()

    # Unklik
    test_unklik_basic()
    test_unklik_capture()
    test_unklik_klik()

    # Combined stack moves
    test_combined_moves_union()
    test_combined_cant_klik()
    test_combined_capture()
    test_combined_back_rank_restriction()
    test_combined_carried_to_promo()
    test_combined_promotion()
    test_combined_promotion_capture()
    test_combined_en_passant()
    test_combined_without_pawn_no_restriction()

    # Castling
    test_castling_normal()
    test_castling_blocked()
    test_castling_in_check()
    test_castling_through_check()
    test_castling_stacked_rook()
    test_castling_klik()
    test_castling_queenside_klik()
    test_castling_rights_updated()

    # En passant
    test_en_passant_basic()
    test_en_passant_square_set()
    test_en_passant_unklik()

    # Promotion
    test_promotion_basic()
    test_promotion_capture()
    test_unklik_promotion()

    # Make/unmake consistency
    test_make_unmake_all_move_types()

    # Edge cases
    test_klik_then_unklik()
    test_double_klik_not_allowed()
    test_pinned_piece()

    # Self play (no crash)
    test_self_play_no_crash()

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    return 0 if failed == 0 else 1
