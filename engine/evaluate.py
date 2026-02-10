"""
Klikschaak Engine - Position Evaluation
"""
from .types import (
    Color, Piece, PieceType, Square, PIECE_VALUES,
    piece_color, piece_type, square_rank, square_file
)
from .board import Board
from .movegen import is_in_check, generate_moves

# Piece-square tables (from White's perspective)
# Values are centipawns (1/100 of a pawn)

PAWN_TABLE = [
      0,   0,   0,   0,   0,   0,   0,   0,
     50,  50,  50,  50,  50,  50,  50,  50,
     10,  10,  20,  30,  30,  20,  10,  10,
      5,   5,  10,  25,  25,  10,   5,   5,
      0,   0,   0,  20,  20,   0,   0,   0,
      5,  -5, -10,   0,   0, -10,  -5,   5,
      5,  10,  10, -20, -20,  10,  10,   5,
      0,   0,   0,   0,   0,   0,   0,   0,
]

KNIGHT_TABLE = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
]

BISHOP_TABLE = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,  10,  10,   5,   0, -10,
    -10,   5,   5,  10,  10,   5,   5, -10,
    -10,   0,  10,  10,  10,  10,   0, -10,
    -10,  10,  10,  10,  10,  10,  10, -10,
    -10,   5,   0,   0,   0,   0,   5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
]

ROOK_TABLE = [
      0,   0,   0,   0,   0,   0,   0,   0,
      5,  10,  10,  10,  10,  10,  10,   5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
      0,   0,   0,   5,   5,   0,   0,   0,
]

QUEEN_TABLE = [
    -20, -10, -10,  -5,  -5, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,   5,   5,   5,   0, -10,
     -5,   0,   5,   5,   5,   5,   0,  -5,
      0,   0,   5,   5,   5,   5,   0,  -5,
    -10,   5,   5,   5,   5,   5,   0, -10,
    -10,   0,   5,   0,   0,   0,   0, -10,
    -20, -10, -10,  -5,  -5, -10, -10, -20,
]

KING_MIDDLEGAME_TABLE = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
     20,  20,   0,   0,   0,   0,  20,  20,
     20,  30,  10,   0,   0,  10,  30,  20,
]

KING_ENDGAME_TABLE = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10,   0,   0, -10, -20, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -30,   0,   0,   0,   0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
]

PST = {
    PieceType.PAWN: PAWN_TABLE,
    PieceType.KNIGHT: KNIGHT_TABLE,
    PieceType.BISHOP: BISHOP_TABLE,
    PieceType.ROOK: ROOK_TABLE,
    PieceType.QUEEN: QUEEN_TABLE,
    PieceType.KING: KING_MIDDLEGAME_TABLE,
}


def mirror_square(sq: int) -> int:
    """Mirror square for black's perspective"""
    return sq ^ 56  # Flip rank


def evaluate(board: Board) -> int:
    """
    Evaluate position from White's perspective.
    Returns score in centipawns.
    Positive = good for White, Negative = good for Black.
    Single-pass evaluation: material, PST, stacks, endgame detection all in one loop.
    """
    score = 0
    squares = board.squares

    # First pass: detect endgame + material + PST + stacks + pawn file data
    queens = 0
    minors = 0
    king_pst_w = 0
    king_pst_b = 0
    king_sq_w_local = 0
    king_sq_b_local = 0

    # Pawn file bitmasks for passed pawn eval
    w_pawn_files = [0] * 8
    b_pawn_files = [0] * 8
    w_pawn_sqs = []
    b_pawn_sqs = []

    for sq in range(64):
        pieces = squares[sq].pieces
        npieces = len(pieces)
        if npieces == 0:
            continue

        for piece in pieces:
            pval = int(piece)
            is_white = pval < 8
            pt = pval & 7  # piece_type inline

            # Material value
            value = PIECE_VALUES[pt]
            if is_white:
                score += value
            else:
                score -= value

            # PST (defer king to after endgame detection)
            if pt == 6:  # KING
                if is_white:
                    king_sq_w_local = sq
                else:
                    king_sq_b_local = sq
            elif pt <= 5 and pt >= 1:
                table = PST[pt]
                table_sq = sq if is_white else sq ^ 56
                if is_white:
                    score += table[table_sq]
                else:
                    score -= table[table_sq]

            # Endgame detection counts
            if pt == 5:  # QUEEN
                queens += 1
            elif pt in (2, 3, 4):  # KNIGHT, BISHOP, ROOK
                minors += 1

            # Pawn tracking for passed pawn eval
            if pt == 1:  # PAWN
                f = sq & 7
                r = sq >> 3
                if is_white:
                    w_pawn_files[f] |= (1 << r)
                    w_pawn_sqs.append(sq)
                else:
                    b_pawn_files[f] |= (1 << r)
                    b_pawn_sqs.append(sq)

        # Stack evaluation (inline)
        if npieces == 2:
            bottom = pieces[0]
            top = pieces[1]
            b_color = int(bottom) < 8
            t_color = int(top) < 8
            if b_color == t_color:
                bottom_pt = int(bottom) & 7
                top_pt = int(top) & 7
                stack_value = 0
                if bottom_pt in (2, 3) and top_pt in (2, 3):
                    stack_value += 15
                if bottom_pt in (2, 3) and top_pt == 4:
                    stack_value += 20
                if top_pt == 5 or bottom_pt == 5:
                    stack_value += 5
                if bottom_pt == 1:
                    stack_value += 10
                if top_pt != 1 and bottom_pt == 1:
                    stack_value -= 5
                if b_color:
                    score += stack_value
                else:
                    score -= stack_value

    # Endgame detection
    endgame = queens == 0 or (queens == 1 and minors <= 1)
    king_table = KING_ENDGAME_TABLE if endgame else KING_MIDDLEGAME_TABLE

    # Add king PST
    score += king_table[king_sq_w_local]
    score -= king_table[king_sq_b_local ^ 56]

    # King safety
    score += evaluate_king_safety(board)

    # Passed pawn evaluation (using pre-computed file data)
    for sq in w_pawn_sqs:
        file = sq & 7
        rank = sq >> 3
        ahead_mask = ~((1 << (rank + 1)) - 1) & 0xFF
        is_passed = True
        for f in range(max(0, file - 1), min(8, file + 2)):
            if b_pawn_files[f] & ahead_mask:
                is_passed = False
                break
        if is_passed:
            advancement = rank - 1
            bonus = PASSED_PAWN_BONUS[min(advancement, 6)] if advancement >= 0 else 0
            if len(squares[sq].pieces) >= 2:
                bonus += 15
            score += bonus

    for sq in b_pawn_sqs:
        file = sq & 7
        rank = sq >> 3
        ahead_mask = (1 << rank) - 1
        is_passed = True
        for f in range(max(0, file - 1), min(8, file + 2)):
            if w_pawn_files[f] & ahead_mask:
                is_passed = False
                break
        if is_passed:
            advancement = 6 - rank
            bonus = PASSED_PAWN_BONUS[min(advancement, 6)] if advancement >= 0 else 0
            if len(squares[sq].pieces) >= 2:
                bonus += 15
            score -= bonus

    # Check bonus
    if is_in_check(board, Color.BLACK):
        score += 50
    if is_in_check(board, Color.WHITE):
        score -= 50

    return score


def evaluate_stacks(board: Board) -> int:
    """
    Evaluate stacked pieces.
    Stacks can be good (protected piece, combined attack) or bad (vulnerable).
    """
    score = 0

    for sq in range(64):
        stack = board.stack_at(sq)
        if not stack.has_stack():
            continue

        bottom = stack.bottom()
        top = stack.top()
        color = piece_color(bottom)

        # Both pieces should be same color in a stack
        if piece_color(top) != color:
            continue

        bottom_pt = piece_type(bottom)
        top_pt = piece_type(top)

        # Stack value adjustments
        stack_value = 0

        # Minor piece on minor piece - slight bonus (protected)
        if bottom_pt in (PieceType.KNIGHT, PieceType.BISHOP) and \
           top_pt in (PieceType.KNIGHT, PieceType.BISHOP):
            stack_value += 15

        # Rook on minor - good for attack
        if bottom_pt in (PieceType.KNIGHT, PieceType.BISHOP) and top_pt == PieceType.ROOK:
            stack_value += 20

        # Queen in stack - risky but powerful
        if top_pt == PieceType.QUEEN or bottom_pt == PieceType.QUEEN:
            stack_value += 10  # Small bonus for combined power
            stack_value -= 5   # But slight penalty for risk

        # Pawn protecting piece
        if bottom_pt == PieceType.PAWN:
            stack_value += 10  # Pawn underneath is protective

        # Piece on pawn - less mobile
        if top_pt != PieceType.PAWN and bottom_pt == PieceType.PAWN:
            stack_value -= 5  # Slightly limits pawn push

        if color == Color.WHITE:
            score += stack_value
        else:
            score -= stack_value

    return score


# Passed pawn bonus by rank advancement (from own side)
# Index = ranks advanced (0 = starting rank, 6 = one before promotion)
PASSED_PAWN_BONUS = [0, 10, 15, 25, 45, 75, 120]


def evaluate_passed_pawns(board: Board) -> int:
    """
    Evaluate passed pawns (no enemy pawns blocking or on adjacent files ahead).
    Uses bitmask per file for fast lookup.
    """
    score = 0
    squares = board.squares

    # Build per-file pawn rank sets: white_pawns[file] = set of ranks,
    # black_pawns[file] = set of ranks
    # Use bitmask: bit i set = pawn on rank i
    w_pawn_files = [0] * 8
    b_pawn_files = [0] * 8
    w_pawn_sqs = []
    b_pawn_sqs = []

    for sq in range(64):
        for piece in squares[sq].pieces:
            if piece == Piece.W_PAWN:
                f = sq & 7
                r = sq >> 3
                w_pawn_files[f] |= (1 << r)
                w_pawn_sqs.append(sq)
            elif piece == Piece.B_PAWN:
                f = sq & 7
                r = sq >> 3
                b_pawn_files[f] |= (1 << r)
                b_pawn_sqs.append(sq)

    # Check white pawns for being passed
    for sq in w_pawn_sqs:
        file = sq & 7
        rank = sq >> 3
        # Mask of ranks ahead: bits rank+1 through 7
        ahead_mask = ~((1 << (rank + 1)) - 1) & 0xFF
        is_passed = True
        for f in range(max(0, file - 1), min(8, file + 2)):
            if b_pawn_files[f] & ahead_mask:
                is_passed = False
                break
        if is_passed:
            advancement = rank - 1
            bonus = PASSED_PAWN_BONUS[min(advancement, 6)] if advancement >= 0 else 0
            if len(squares[sq].pieces) >= 2:
                bonus += 15
            score += bonus

    # Check black pawns for being passed
    for sq in b_pawn_sqs:
        file = sq & 7
        rank = sq >> 3
        # Mask of ranks ahead (for black, lower ranks): bits 0 through rank-1
        ahead_mask = (1 << rank) - 1
        is_passed = True
        for f in range(max(0, file - 1), min(8, file + 2)):
            if w_pawn_files[f] & ahead_mask:
                is_passed = False
                break
        if is_passed:
            advancement = 6 - rank
            bonus = PASSED_PAWN_BONUS[min(advancement, 6)] if advancement >= 0 else 0
            if len(squares[sq].pieces) >= 2:
                bonus += 15
            score -= bonus

    return score


def evaluate_king_safety(board: Board) -> int:
    """Evaluate king safety"""
    score = 0

    for color in [Color.WHITE, Color.BLACK]:
        king_sq = board.king_sq[color]
        if king_sq < 0 or king_sq >= 64:
            continue

        king_file = square_file(king_sq)
        king_rank = square_rank(king_sq)
        safety = 0

        # Castled king bonus
        if color == Color.WHITE:
            if king_sq in (Square.G1, Square.C1):
                safety += 30
            elif king_sq == Square.E1:
                safety -= 20  # Uncastled penalty
        else:
            if king_sq in (Square.G8, Square.C8):
                safety += 30
            elif king_sq == Square.E8:
                safety -= 20

        # Pawn shield
        pawn = Piece.W_PAWN if color == Color.WHITE else Piece.B_PAWN
        shield_rank = king_rank + (1 if color == Color.WHITE else -1)

        if 0 <= shield_rank < 8:
            for df in [-1, 0, 1]:
                f = king_file + df
                if 0 <= f < 8:
                    sq = shield_rank * 8 + f
                    if pawn in board.stack_at(sq).pieces:
                        safety += 10

        # King in stack is bad (can't escape easily)
        if board.stack_at(king_sq).has_stack():
            safety -= 40

        if color == Color.WHITE:
            score += safety
        else:
            score -= safety

    return score


def evaluate_mobility(board: Board) -> int:
    """
    Evaluate mobility (number of legal moves).
    This is expensive, use sparingly.
    """
    # Save turn
    original_turn = board.turn

    # Count white moves
    board.turn = Color.WHITE
    white_moves = len(generate_moves(board, legal_only=False))

    # Count black moves
    board.turn = Color.BLACK
    black_moves = len(generate_moves(board, legal_only=False))

    # Restore turn
    board.turn = original_turn

    # Each move is worth about 5 centipawns
    return (white_moves - black_moves) * 5


def is_endgame(board: Board) -> bool:
    """Check if we're in endgame (for king table selection)"""
    queens = 0
    minors = 0

    for sq in range(64):
        for piece in board.stack_at(sq).pieces:
            pt = piece_type(piece)
            if pt == PieceType.QUEEN:
                queens += 1
            elif pt in (PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK):
                minors += 1

    # Endgame if no queens or only one side has queen with minimal material
    return queens == 0 or (queens == 1 and minors <= 1)


# Constants for search
CHECKMATE_SCORE = 100000
DRAW_SCORE = 0
