"""
Klikschaak Engine - Move Generation
"""
from typing import List, Optional
from .types import (
    Color, Piece, PieceType, Square, Move, MoveType, CastlingRights,
    piece_color, piece_type, make_piece, make_square, square_file, square_rank
)
from .board import Board

# Direction offsets for pieces
KNIGHT_OFFSETS = [-17, -15, -10, -6, 6, 10, 15, 17]
KING_OFFSETS = [-9, -8, -7, -1, 1, 7, 8, 9]
BISHOP_DIRECTIONS = [-9, -7, 7, 9]
ROOK_DIRECTIONS = [-8, -1, 1, 8]
QUEEN_DIRECTIONS = BISHOP_DIRECTIONS + ROOK_DIRECTIONS

# Pre-computed move tables (filled at module load)
KNIGHT_TABLE: List[List[int]] = [[] for _ in range(64)]
KING_TABLE: List[List[int]] = [[] for _ in range(64)]

def _init_move_tables():
    """Pre-compute knight and king move targets for each square."""
    for sq in range(64):
        f = sq & 7
        r = sq >> 3
        for offset in KNIGHT_OFFSETS:
            to = sq + offset
            if 0 <= to < 64:
                tf = to & 7
                tr = to >> 3
                if abs(f - tf) <= 2 and abs(r - tr) <= 2:
                    KNIGHT_TABLE[sq].append(to)
        for offset in KING_OFFSETS:
            to = sq + offset
            if 0 <= to < 64:
                tf = to & 7
                tr = to >> 3
                if abs(f - tf) <= 1 and abs(r - tr) <= 1:
                    KING_TABLE[sq].append(to)

_init_move_tables()


# Undo info for make/unmake
class UndoInfo:
    __slots__ = ['modified', 'castling', 'ep_square', 'halfmove_clock',
                 'king_sq_w', 'king_sq_b', 'fullmove',
                 'unmoved_pawns_w', 'unmoved_pawns_b']

    def __init__(self):
        self.modified = []  # list of (sq, old_pieces_list) tuples
        self.castling = 0
        self.ep_square = None
        self.halfmove_clock = 0
        self.king_sq_w = 0
        self.king_sq_b = 0
        self.fullmove = 1
        self.unmoved_pawns_w = 0xFF
        self.unmoved_pawns_b = 0xFF


def sliding_moves(board: Board, sq: int, directions: List[int]) -> List[int]:
    """Generate sliding piece moves (bishop, rook, queen)"""
    moves = []
    squares = board.squares

    for direction in directions:
        current = sq

        while True:
            prev = current
            current += direction
            if not (0 <= current < 64):
                break

            # Check for wrap-around
            if abs((current & 7) - (prev & 7)) > 1:
                break

            moves.append(current)

            # Stop if there's a piece (can capture or klik, but can't go further)
            if squares[current].pieces:
                break

    return moves


def pawn_moves(board: Board, sq: int, color: Color, captures_only: bool = False,
               include_klik: bool = True) -> List[tuple]:
    """
    Generate pawn moves.
    Returns list of (to_square, move_type) tuples.
    Includes forward klik moves (pawn kliks onto friendly piece ahead).
    Uses unmoved_pawns bitmask for double-move eligibility.
    """
    moves = []
    direction = 1 if color == Color.WHITE else -1
    start_rank = 1 if color == Color.WHITE else 6
    promo_rank = 7 if color == Color.WHITE else 0
    rank = sq >> 3
    file = sq & 7

    if not captures_only:
        # Forward move
        one_forward = sq + 8 * direction
        if 0 <= one_forward < 64:
            fwd_pieces = board.squares[one_forward].pieces
            if not fwd_pieces:
                # Empty square - normal forward move
                if (one_forward >> 3) == promo_rank:
                    moves.append((one_forward, MoveType.PROMOTION))
                else:
                    moves.append((one_forward, MoveType.NORMAL))

                    # Double move from start (only if pawn hasn't moved)
                    if rank == start_rank and (board.unmoved_pawns[color] & (1 << file)):
                        two_forward = sq + 16 * direction
                        if 0 <= two_forward < 64:
                            two_fwd_pieces = board.squares[two_forward].pieces
                            if not two_fwd_pieces:
                                moves.append((two_forward, MoveType.NORMAL))
                            elif include_klik and len(two_fwd_pieces) < 2 and \
                                 piece_color(two_fwd_pieces[-1]) == color and \
                                 piece_type(two_fwd_pieces[-1]) != PieceType.KING:
                                # Double forward klik onto friendly piece
                                moves.append((two_forward, MoveType.KLIK))

            elif include_klik and len(fwd_pieces) < 2 and \
                 piece_color(fwd_pieces[-1]) == color and \
                 piece_type(fwd_pieces[-1]) != PieceType.KING:
                # Forward klik onto friendly piece (not to promotion rank)
                if (one_forward >> 3) != promo_rank:
                    moves.append((one_forward, MoveType.KLIK))

    # Captures (diagonal)
    for df in (-1, 1):
        to_file = file + df
        if not (0 <= to_file < 8):
            continue

        to_sq = sq + 8 * direction + df
        if not (0 <= to_sq < 64):
            continue

        target_rank = to_sq >> 3

        # Normal capture
        target_pieces = board.squares[to_sq].pieces
        if target_pieces:
            target_color = piece_color(target_pieces[-1])
            if target_color != color:
                if target_rank == promo_rank:
                    moves.append((to_sq, MoveType.PROMOTION_CAPTURE))
                else:
                    moves.append((to_sq, MoveType.CAPTURE))

        # En passant
        if to_sq == board.ep_square:
            moves.append((to_sq, MoveType.EN_PASSANT))

    return moves


def generate_piece_moves(board: Board, sq: int, piece: Piece,
                         include_klik: bool = True,
                         captures_only: bool = False) -> List[Move]:
    """
    Generate all moves for a specific piece at a square.
    """
    moves = []
    color = piece_color(piece)
    pt = piece_type(piece)

    # Get raw move squares based on piece type
    if pt == PieceType.KNIGHT:
        targets = KNIGHT_TABLE[sq]
    elif pt == PieceType.BISHOP:
        targets = sliding_moves(board, sq, BISHOP_DIRECTIONS)
    elif pt == PieceType.ROOK:
        targets = sliding_moves(board, sq, ROOK_DIRECTIONS)
    elif pt == PieceType.QUEEN:
        targets = sliding_moves(board, sq, QUEEN_DIRECTIONS)
    elif pt == PieceType.KING:
        targets = KING_TABLE[sq]
    elif pt == PieceType.PAWN:
        # Pawn has special move generation
        for to_sq, move_type in pawn_moves(board, sq, color, captures_only):
            if move_type in (MoveType.PROMOTION, MoveType.PROMOTION_CAPTURE):
                for promo in (PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT):
                    moves.append(Move(sq, to_sq, move_type, promotion=promo))
            else:
                moves.append(Move(sq, to_sq, move_type))
        return moves
    else:
        return moves

    # Convert target squares to moves
    for to_sq in targets:
        target_pieces = board.squares[to_sq].pieces

        if not target_pieces:
            # Empty square - normal move
            if not captures_only:
                moves.append(Move(sq, to_sq, MoveType.NORMAL))

        elif piece_color(target_pieces[-1]) != color:
            # Enemy piece - capture
            moves.append(Move(sq, to_sq, MoveType.CAPTURE))

        elif not captures_only and include_klik and len(target_pieces) < 2:
            # Friendly piece without stack - klik (but NOT for king!)
            if pt != PieceType.KING and piece_type(target_pieces[-1]) != PieceType.KING:
                moves.append(Move(sq, to_sq, MoveType.KLIK))

    return moves


def generate_combined_moves(board: Board, sq: int, pieces: list,
                            captures_only: bool = False) -> List[Move]:
    """
    Generate moves where both stacked pieces move together as a unit.
    Target squares = union of both pieces' movement patterns.
    Restrictions:
      - Pawn can't go to own back rank (rank 0 for white, rank 7 for black)
      - Pawn can't be carried to promotion rank by non-pawn movement
      - Combined stack can't klik (would exceed 2 piece max)
    """
    moves = []
    color = piece_color(pieces[0])
    squares = board.squares

    has_pawn = False
    pawn_piece = None
    for p in pieces:
        if piece_type(p) == PieceType.PAWN:
            has_pawn = True
            pawn_piece = p
            break

    back_rank = 0 if color == Color.WHITE else 7
    promo_rank = 7 if color == Color.WHITE else 0

    # Collect target squares from all pieces, tracking which came from pawn
    all_targets = set()
    pawn_targets = set()

    for piece in pieces:
        pt = piece_type(piece)
        if pt == PieceType.PAWN:
            direction = 1 if color == Color.WHITE else -1
            start_rank = 1 if color == Color.WHITE else 6
            rank = sq >> 3
            file = sq & 7

            if not captures_only:
                # Forward move
                one_forward = sq + 8 * direction
                if 0 <= one_forward < 64 and not squares[one_forward].pieces:
                    pawn_targets.add(one_forward)
                    all_targets.add(one_forward)
                    # Double forward from start
                    if rank == start_rank and (board.unmoved_pawns[color] & (1 << file)):
                        two_forward = sq + 16 * direction
                        if 0 <= two_forward < 64 and not squares[two_forward].pieces:
                            pawn_targets.add(two_forward)
                            all_targets.add(two_forward)

            # Diagonal captures
            for df in (-1, 1):
                to_file = file + df
                if 0 <= to_file < 8:
                    to_sq = sq + 8 * direction + df
                    if 0 <= to_sq < 64:
                        target_pieces = squares[to_sq].pieces
                        if target_pieces and piece_color(target_pieces[-1]) != color:
                            pawn_targets.add(to_sq)
                            all_targets.add(to_sq)
                        # En passant
                        if to_sq == board.ep_square:
                            pawn_targets.add(to_sq)
                            all_targets.add(to_sq)

        elif pt == PieceType.KNIGHT:
            for t in KNIGHT_TABLE[sq]:
                all_targets.add(t)
        elif pt == PieceType.BISHOP:
            for t in sliding_moves(board, sq, BISHOP_DIRECTIONS):
                all_targets.add(t)
        elif pt == PieceType.ROOK:
            for t in sliding_moves(board, sq, ROOK_DIRECTIONS):
                all_targets.add(t)
        elif pt == PieceType.QUEEN:
            for t in sliding_moves(board, sq, QUEEN_DIRECTIONS):
                all_targets.add(t)
        elif pt == PieceType.KING:
            # King should never be in a stack, but handle gracefully
            for t in KING_TABLE[sq]:
                all_targets.add(t)

    # Convert targets to moves with restrictions
    for to_sq in all_targets:
        to_rank = to_sq >> 3
        target_pieces = squares[to_sq].pieces

        # Back rank restriction: pawn can't go to own back rank
        if has_pawn and to_rank == back_rank:
            continue

        # Carried-to-promo restriction: pawn can't be carried to promo rank
        # by non-pawn movement. Only allowed if target came from pawn movement.
        if has_pawn and to_rank == promo_rank:
            if to_sq not in pawn_targets:
                continue
            # Pawn reaches promo rank via own movement → combined promotion
            if not target_pieces:
                for promo in (PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT):
                    moves.append(Move(sq, to_sq, MoveType.PROMOTION,
                                      unklik_index=-1, promotion=promo))
            elif piece_color(target_pieces[-1]) != color:
                for promo in (PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT):
                    moves.append(Move(sq, to_sq, MoveType.PROMOTION_CAPTURE,
                                      unklik_index=-1, promotion=promo))
            continue

        # En passant (combined)
        if to_sq == board.ep_square and to_sq in pawn_targets:
            moves.append(Move(sq, to_sq, MoveType.EN_PASSANT, unklik_index=-1))
            continue

        if not target_pieces:
            # Empty square - normal combined move
            if not captures_only:
                moves.append(Move(sq, to_sq, MoveType.NORMAL))
        elif piece_color(target_pieces[-1]) != color:
            # Enemy piece - capture
            moves.append(Move(sq, to_sq, MoveType.CAPTURE))
        # Friendly piece: can't klik as combined (would exceed 2 piece max)

    return moves


def generate_moves(board: Board, legal_only: bool = True,
                   captures_only: bool = False) -> List[Move]:
    """
    Generate all moves for the side to move.
    If legal_only is True, filter out moves that leave king in check.
    """
    moves = []
    color = board.turn

    for sq in range(64):
        stack = board.squares[sq]
        if not stack.pieces:
            continue

        # Check if any piece belongs to side to move
        if len(stack.pieces) >= 2:
            # Stacked position
            friendly_pieces = [(idx, p) for idx, p in enumerate(stack.pieces)
                               if piece_color(p) == color]

            # Generate unklik moves for each friendly piece
            for idx, piece in friendly_pieces:
                moves.extend(generate_unklik_moves(board, sq, idx, piece, captures_only))

            # Generate combined moves if both pieces are friendly
            if len(friendly_pieces) == 2:
                moves.extend(generate_combined_moves(
                    board, sq, [p for _, p in friendly_pieces], captures_only))
        else:
            # Single piece - generate normal moves
            piece = stack.pieces[0]
            if piece_color(piece) == color:
                moves.extend(generate_piece_moves(board, sq, piece,
                                                   captures_only=captures_only))

    # Add castling moves (not during captures-only)
    if not captures_only:
        moves.extend(generate_castling_moves(board))

    if legal_only:
        moves = [m for m in moves if is_legal(board, m)]

    return moves


def generate_unklik_moves(board: Board, sq: int, piece_idx: int, piece: Piece,
                          captures_only: bool = False) -> List[Move]:
    """
    Generate unklik moves for a piece in a stack.
    """
    moves = []
    color = piece_color(piece)
    pt = piece_type(piece)

    # Get raw move squares based on piece type
    if pt == PieceType.KNIGHT:
        targets = KNIGHT_TABLE[sq]
    elif pt == PieceType.BISHOP:
        targets = sliding_moves(board, sq, BISHOP_DIRECTIONS)
    elif pt == PieceType.ROOK:
        targets = sliding_moves(board, sq, ROOK_DIRECTIONS)
    elif pt == PieceType.QUEEN:
        targets = sliding_moves(board, sq, QUEEN_DIRECTIONS)
    elif pt == PieceType.KING:
        targets = KING_TABLE[sq]
    elif pt == PieceType.PAWN:
        # Pawn unklik moves
        for to_sq, base_type in pawn_moves(board, sq, color, captures_only):
            target_pieces = board.squares[to_sq].pieces

            if base_type == MoveType.EN_PASSANT:
                moves.append(Move(sq, to_sq, MoveType.EN_PASSANT, unklik_index=piece_idx))
            elif base_type in (MoveType.PROMOTION, MoveType.PROMOTION_CAPTURE):
                is_capture = target_pieces and piece_color(target_pieces[-1]) != color
                for promo in (PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT):
                    mt = MoveType.PROMOTION_CAPTURE if is_capture else MoveType.PROMOTION
                    moves.append(Move(sq, to_sq, mt, unklik_index=piece_idx, promotion=promo))
            elif not target_pieces:
                if not captures_only:
                    moves.append(Move(sq, to_sq, MoveType.UNKLIK, unklik_index=piece_idx))
            elif piece_color(target_pieces[-1]) != color:
                moves.append(Move(sq, to_sq, MoveType.UNKLIK, unklik_index=piece_idx))
            elif not captures_only and len(target_pieces) < 2 and piece_type(target_pieces[-1]) != PieceType.KING:
                promo_rank = 7 if color == Color.WHITE else 0
                if (to_sq >> 3) != promo_rank:
                    moves.append(Move(sq, to_sq, MoveType.UNKLIK_KLIK, unklik_index=piece_idx))
        return moves
    else:
        return moves

    # Convert target squares to moves
    for to_sq in targets:
        target_pieces = board.squares[to_sq].pieces

        if not target_pieces:
            if not captures_only:
                moves.append(Move(sq, to_sq, MoveType.UNKLIK, unklik_index=piece_idx))

        elif piece_color(target_pieces[-1]) != color:
            moves.append(Move(sq, to_sq, MoveType.UNKLIK, unklik_index=piece_idx))

        elif not captures_only and len(target_pieces) < 2:
            if pt != PieceType.KING and piece_type(target_pieces[-1]) != PieceType.KING:
                moves.append(Move(sq, to_sq, MoveType.UNKLIK_KLIK, unklik_index=piece_idx))

    return moves


def _has_rook(pieces: list, rook_piece: Piece) -> bool:
    """Check if a rook is anywhere in the stack."""
    return rook_piece in pieces


def generate_castling_moves(board: Board) -> List[Move]:
    """
    Generate castling moves, including with stacked rooks.
    When rook is stacked on corner, it unkliks and moves to f/d file.
    If f/d file has a friendly piece, rook kliks there (CASTLE_K_KLIK).
    """
    moves = []
    color = board.turn
    squares = board.squares
    enemy = color.opposite()

    if color == Color.WHITE:
        king_sq = Square.E1
        rook_piece = Piece.W_ROOK
        base_rank_squares = (Square.A1, Square.B1, Square.C1, Square.D1,
                             Square.E1, Square.F1, Square.G1, Square.H1)
    else:
        king_sq = Square.E8
        rook_piece = Piece.B_ROOK
        base_rank_squares = (Square.A8, Square.B8, Square.C8, Square.D8,
                             Square.E8, Square.F8, Square.G8, Square.H8)

    # King must be at starting square (not stacked)
    king_pieces = squares[king_sq].pieces
    if not king_pieces or king_pieces[-1] != make_piece(color, PieceType.KING):
        return moves
    if len(king_pieces) > 1:
        return moves  # King can't be in a stack

    # King can't be in check
    if is_attacked(board, king_sq, enemy):
        return moves

    rook_sq_k = base_rank_squares[7]  # h1/h8
    rook_sq_q = base_rank_squares[0]  # a1/a8
    f_sq = base_rank_squares[5]  # f1/f8
    g_sq = base_rank_squares[6]  # g1/g8
    d_sq = base_rank_squares[3]  # d1/d8
    c_sq = base_rank_squares[2]  # c1/c8
    b_sq = base_rank_squares[1]  # b1/b8

    ks_rights = CastlingRights.W_KINGSIDE if color == Color.WHITE else CastlingRights.B_KINGSIDE
    qs_rights = CastlingRights.W_QUEENSIDE if color == Color.WHITE else CastlingRights.B_QUEENSIDE

    # Kingside castle
    if board.castling & ks_rights:
        rook_pieces = squares[rook_sq_k].pieces
        if rook_pieces and _has_rook(rook_pieces, rook_piece):
            # g1 must be empty (king destination)
            if not squares[g_sq].pieces:
                # f1 not attacked (king passes through)
                if not is_attacked(board, f_sq, enemy):
                    f_pieces = squares[f_sq].pieces
                    if not f_pieces:
                        # f1 empty: normal castle (rook goes to f1)
                        moves.append(Move(king_sq, g_sq, MoveType.CASTLE_K))
                    elif len(f_pieces) == 1 and piece_color(f_pieces[0]) == color and \
                         piece_type(f_pieces[0]) != PieceType.KING:
                        # f1 has friendly non-king piece: rook kliks there
                        moves.append(Move(king_sq, g_sq, MoveType.CASTLE_K_KLIK))

    # Queenside castle
    if board.castling & qs_rights:
        rook_pieces = squares[rook_sq_q].pieces
        if rook_pieces and _has_rook(rook_pieces, rook_piece):
            # c1 must be empty (king destination), b1 must be empty (passage)
            if not squares[c_sq].pieces and not squares[b_sq].pieces:
                # d1 not attacked (king passes through)
                if not is_attacked(board, d_sq, enemy):
                    d_pieces = squares[d_sq].pieces
                    if not d_pieces:
                        # d1 empty: normal castle (rook goes to d1)
                        moves.append(Move(king_sq, c_sq, MoveType.CASTLE_Q))
                    elif len(d_pieces) == 1 and piece_color(d_pieces[0]) == color and \
                         piece_type(d_pieces[0]) != PieceType.KING:
                        # d1 has friendly non-king piece: rook kliks there
                        moves.append(Move(king_sq, c_sq, MoveType.CASTLE_Q_KLIK))

    return moves


def is_attacked(board: Board, sq: int, by_color: Color) -> bool:
    """Check if a square is attacked by the given color"""
    squares = board.squares

    # Check knight attacks
    for attacker_sq in KNIGHT_TABLE[sq]:
        for piece in squares[attacker_sq].pieces:
            if piece_color(piece) == by_color and piece_type(piece) == PieceType.KNIGHT:
                return True

    # Check king attacks
    for attacker_sq in KING_TABLE[sq]:
        for piece in squares[attacker_sq].pieces:
            if piece_color(piece) == by_color and piece_type(piece) == PieceType.KING:
                return True

    # Check sliding piece attacks (bishop/queen diagonals)
    for direction in BISHOP_DIRECTIONS:
        current = sq
        while True:
            prev = current
            current += direction
            if not (0 <= current < 64):
                break
            if abs((current & 7) - (prev & 7)) > 1:
                break

            target_pieces = squares[current].pieces
            if target_pieces:
                for piece in target_pieces:
                    if piece_color(piece) == by_color:
                        pt = piece_type(piece)
                        if pt == PieceType.BISHOP or pt == PieceType.QUEEN:
                            return True
                break

    # Check sliding piece attacks (rook/queen lines)
    for direction in ROOK_DIRECTIONS:
        current = sq
        while True:
            prev = current
            current += direction
            if not (0 <= current < 64):
                break
            if abs((current & 7) - (prev & 7)) > 1:
                break

            target_pieces = squares[current].pieces
            if target_pieces:
                for piece in target_pieces:
                    if piece_color(piece) == by_color:
                        pt = piece_type(piece)
                        if pt == PieceType.ROOK or pt == PieceType.QUEEN:
                            return True
                break

    # Check pawn attacks
    pawn_direction = 1 if by_color == Color.WHITE else -1
    enemy_pawn = make_piece(by_color, PieceType.PAWN)
    sq_file = sq & 7

    for df in (-1, 1):
        attacker_sq = sq - 8 * pawn_direction + df
        if 0 <= attacker_sq < 64 and abs((attacker_sq & 7) - sq_file) == 1:
            if enemy_pawn in squares[attacker_sq].pieces:
                return True

    return False


def is_in_check(board: Board, color: Color) -> bool:
    """Check if the given color's king is in check"""
    king_sq = board.king_sq[color]
    if king_sq == Square.NONE:
        return False
    return is_attacked(board, king_sq, color.opposite())


def is_legal(board: Board, move: Move) -> bool:
    """Check if a move is legal (doesn't leave own king in check)"""
    undo = make_move(board, move)
    legal = not is_in_check(board, board.turn.opposite())
    unmake_move(board, move, undo)
    return legal


def make_move(board: Board, move: Move) -> UndoInfo:
    """
    Make a move on the board. Modifies board in place.
    Returns UndoInfo for unmake_move.
    Does NOT check legality.
    """
    from_sq = move.from_sq
    to_sq = move.to_sq
    mt = move.move_type
    squares = board.squares

    # Save undo info
    undo = UndoInfo()
    undo.castling = board.castling
    undo.ep_square = board.ep_square
    undo.halfmove_clock = board.halfmove_clock
    undo.king_sq_w = board.king_sq[0]
    undo.king_sq_b = board.king_sq[1]
    undo.fullmove = board.fullmove
    undo.unmoved_pawns_w = board.unmoved_pawns[0]
    undo.unmoved_pawns_b = board.unmoved_pawns[1]

    # Always save from and to squares
    undo.modified = [(from_sq, squares[from_sq].pieces[:]),
                     (to_sq, squares[to_sq].pieces[:])]

    # Get the moving piece info BEFORE modifying
    from_pieces = squares[from_sq].pieces
    if mt in (MoveType.UNKLIK, MoveType.UNKLIK_KLIK):
        moving_piece_type = piece_type(from_pieces[move.unklik_index]) if 0 <= move.unklik_index < len(from_pieces) else PieceType.NONE
    elif move.unklik_index == -1:
        # Combined move: check if any piece is a pawn for halfmove/ep tracking
        moving_piece_type = PieceType.NONE
        for p in from_pieces:
            if piece_type(p) == PieceType.PAWN:
                moving_piece_type = PieceType.PAWN
                break
    else:
        moving_piece_type = piece_type(from_pieces[-1]) if from_pieces else PieceType.NONE

    # Handle different move types
    if mt in (MoveType.CASTLE_K, MoveType.CASTLE_Q,
              MoveType.CASTLE_K_KLIK, MoveType.CASTLE_Q_KLIK):
        is_kingside = mt in (MoveType.CASTLE_K, MoveType.CASTLE_K_KLIK)
        is_klik = mt in (MoveType.CASTLE_K_KLIK, MoveType.CASTLE_Q_KLIK)
        rank = 0 if board.turn == Color.WHITE else 7
        rook_from = make_square(7 if is_kingside else 0, rank)
        rook_to = make_square(5 if is_kingside else 3, rank)
        rook_piece = Piece.W_ROOK if board.turn == Color.WHITE else Piece.B_ROOK

        # Save extra squares
        undo.modified.append((rook_from, squares[rook_from].pieces[:]))
        undo.modified.append((rook_to, squares[rook_to].pieces[:]))

        king = squares[from_sq].pieces[-1]

        # Find and extract rook from its square (may be in a stack)
        rook_sq_pieces = squares[rook_from].pieces
        rook_idx = None
        for i, p in enumerate(rook_sq_pieces):
            if p == rook_piece:
                rook_idx = i
                break

        if rook_idx is not None:
            rook = rook_sq_pieces.pop(rook_idx)
            # If stack had 2 pieces, one remains; if single, square is now empty
            if not rook_sq_pieces:
                squares[rook_from].pieces = []
        else:
            rook = rook_piece  # Fallback

        # Place king
        squares[from_sq].clear()
        squares[to_sq].pieces = [king]

        # Place rook (klik onto existing piece or into empty square)
        if is_klik:
            squares[rook_to].add(rook)
        else:
            squares[rook_to].pieces = [rook]

        board.king_sq[board.turn] = to_sq

    elif mt in (MoveType.UNKLIK, MoveType.UNKLIK_KLIK):
        moving_piece = squares[from_sq].remove_at(move.unklik_index)

        if mt == MoveType.UNKLIK_KLIK:
            squares[to_sq].add(moving_piece)
        else:
            squares[to_sq].clear()
            squares[to_sq].pieces = [moving_piece]

        if piece_type(moving_piece) == PieceType.KING:
            board.king_sq[board.turn] = to_sq

    elif mt == MoveType.KLIK:
        moving_pieces = squares[from_sq].pieces[:]
        squares[from_sq].clear()
        for piece in moving_pieces:
            squares[to_sq].add(piece)
            if piece_type(piece) == PieceType.KING:
                board.king_sq[board.turn] = to_sq

    elif mt == MoveType.EN_PASSANT:
        captured_sq = to_sq + (-8 if board.turn == Color.WHITE else 8)
        undo.modified.append((captured_sq, squares[captured_sq].pieces[:]))

        moving_pieces = squares[from_sq].pieces[:]
        squares[from_sq].clear()
        squares[captured_sq].clear()
        squares[to_sq].pieces = moving_pieces

    elif mt in (MoveType.PROMOTION, MoveType.PROMOTION_CAPTURE):
        promoted_piece = make_piece(board.turn, move.promotion)

        if move.unklik_index == -1:
            # Combined promotion: pawn promotes, companion piece comes along
            companion = None
            for p in squares[from_sq].pieces:
                if piece_type(p) != PieceType.PAWN:
                    companion = p
                    break
            squares[from_sq].clear()
            squares[to_sq].clear()
            if companion:
                squares[to_sq].pieces = [companion, promoted_piece]
            else:
                squares[to_sq].pieces = [promoted_piece]
        elif move.unklik_index > 0 or len(squares[from_sq].pieces) >= 2:
            # Unklik promotion: one piece leaves stack to promote
            squares[from_sq].remove_at(move.unklik_index)
            squares[to_sq].clear()
            squares[to_sq].pieces = [promoted_piece]
        else:
            # Simple single-piece promotion
            squares[from_sq].clear()
            squares[to_sq].clear()
            squares[to_sq].pieces = [promoted_piece]

    else:
        # Normal move or capture
        moving_pieces = squares[from_sq].pieces[:]
        squares[from_sq].clear()
        squares[to_sq].clear()

        for piece in moving_pieces:
            squares[to_sq].pieces.append(piece)
            if piece_type(piece) == PieceType.KING:
                board.king_sq[board.turn] = to_sq

    # Update castling rights
    if from_sq == Square.E1 or to_sq == Square.E1:
        board.castling &= ~CastlingRights.WHITE
    if from_sq == Square.E8 or to_sq == Square.E8:
        board.castling &= ~CastlingRights.BLACK
    if from_sq == Square.A1 or to_sq == Square.A1:
        board.castling &= ~CastlingRights.W_QUEENSIDE
    if from_sq == Square.H1 or to_sq == Square.H1:
        board.castling &= ~CastlingRights.W_KINGSIDE
    if from_sq == Square.A8 or to_sq == Square.A8:
        board.castling &= ~CastlingRights.B_QUEENSIDE
    if from_sq == Square.H8 or to_sq == Square.H8:
        board.castling &= ~CastlingRights.B_KINGSIDE

    # Update halfmove clock
    is_capture = mt in (MoveType.CAPTURE, MoveType.EN_PASSANT, MoveType.PROMOTION_CAPTURE)
    if moving_piece_type == PieceType.PAWN or is_capture:
        board.halfmove_clock = 0
    else:
        board.halfmove_clock += 1

    # Update en passant square
    board.ep_square = None
    if moving_piece_type == PieceType.PAWN:
        if abs((to_sq >> 3) - (from_sq >> 3)) == 2:
            board.ep_square = (from_sq + to_sq) // 2

    # Update unmoved_pawns: clear file bit when pawn moves from starting rank
    # Note: board.turn has NOT been switched yet here
    color_moved = board.turn
    from_rank = from_sq >> 3
    from_file = from_sq & 7
    if moving_piece_type == PieceType.PAWN:
        if color_moved == Color.WHITE and from_rank == 1:
            board.unmoved_pawns[Color.WHITE] &= ~(1 << from_file)
        elif color_moved == Color.BLACK and from_rank == 6:
            board.unmoved_pawns[Color.BLACK] &= ~(1 << from_file)
    # For combined moves with a stack that had a pawn
    elif mt in (MoveType.NORMAL, MoveType.CAPTURE, MoveType.KLIK):
        if color_moved == Color.WHITE and from_rank == 1:
            board.unmoved_pawns[Color.WHITE] &= ~(1 << from_file)
        elif color_moved == Color.BLACK and from_rank == 6:
            board.unmoved_pawns[Color.BLACK] &= ~(1 << from_file)

    # Switch turn
    board.turn = board.turn.opposite()
    if board.turn == Color.WHITE:
        board.fullmove += 1

    return undo


def unmake_move(board: Board, move: Move, undo: UndoInfo):
    """Unmake a move, restoring the board to its previous state."""
    # Restore modified squares
    for sq, pieces in undo.modified:
        board.squares[sq].pieces = pieces

    # Restore board state
    board.castling = undo.castling
    board.ep_square = undo.ep_square
    board.halfmove_clock = undo.halfmove_clock
    board.king_sq[0] = undo.king_sq_w
    board.king_sq[1] = undo.king_sq_b
    board.fullmove = undo.fullmove
    board.unmoved_pawns[0] = undo.unmoved_pawns_w
    board.unmoved_pawns[1] = undo.unmoved_pawns_b
    board.turn = board.turn.opposite()
