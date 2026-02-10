"""
Klikschaak Engine - Type Definitions
"""
from enum import IntEnum, auto
from typing import NamedTuple, Optional, List, Tuple
from dataclasses import dataclass

# Colors
class Color(IntEnum):
    WHITE = 0
    BLACK = 1

    def opposite(self) -> 'Color':
        return Color.BLACK if self == Color.WHITE else Color.WHITE

# Piece types (without color)
class PieceType(IntEnum):
    NONE = 0
    PAWN = 1
    KNIGHT = 2
    BISHOP = 3
    ROOK = 4
    QUEEN = 5
    KING = 6

# Pieces (with color encoded)
class Piece(IntEnum):
    NONE = 0
    W_PAWN = 1
    W_KNIGHT = 2
    W_BISHOP = 3
    W_ROOK = 4
    W_QUEEN = 5
    W_KING = 6
    B_PAWN = 9
    B_KNIGHT = 10
    B_BISHOP = 11
    B_ROOK = 12
    B_QUEEN = 13
    B_KING = 14

def piece_color(p: Piece) -> Optional[Color]:
    if p == Piece.NONE:
        return None
    return Color.WHITE if p < 8 else Color.BLACK

def piece_type(p: Piece) -> PieceType:
    if p == Piece.NONE:
        return PieceType.NONE
    return PieceType(p & 7)

def make_piece(color: Color, pt: PieceType) -> Piece:
    return Piece(pt + (8 if color == Color.BLACK else 0))

# Move types
class MoveType(IntEnum):
    NORMAL = 0
    CAPTURE = 1
    KLIK = 2              # Land on friendly piece (stack)
    UNKLIK = 3            # Move one piece from stack
    UNKLIK_KLIK = 4       # Unklik and land on friendly
    EN_PASSANT = 5
    CASTLE_K = 6          # Kingside castle
    CASTLE_Q = 7          # Queenside castle
    CASTLE_K_KLIK = 8     # Castle with rook klik
    CASTLE_Q_KLIK = 9
    PROMOTION = 10
    PROMOTION_CAPTURE = 11
    PROMOTION_KLIK = 12   # Promote and klik

# Square representation (0-63, a1=0, h8=63)
class Square(IntEnum):
    A1, B1, C1, D1, E1, F1, G1, H1 = range(8)
    A2, B2, C2, D2, E2, F2, G2, H2 = range(8, 16)
    A3, B3, C3, D3, E3, F3, G3, H3 = range(16, 24)
    A4, B4, C4, D4, E4, F4, G4, H4 = range(24, 32)
    A5, B5, C5, D5, E5, F5, G5, H5 = range(32, 40)
    A6, B6, C6, D6, E6, F6, G6, H6 = range(40, 48)
    A7, B7, C7, D7, E7, F7, G7, H7 = range(48, 56)
    A8, B8, C8, D8, E8, F8, G8, H8 = range(56, 64)
    NONE = 64

def square_file(sq: int) -> int:
    """File of square (0=a, 7=h)"""
    return sq & 7

def square_rank(sq: int) -> int:
    """Rank of square (0=1, 7=8)"""
    return sq >> 3

def make_square(file: int, rank: int) -> int:
    """Create square from file and rank"""
    return rank * 8 + file

def square_name(sq: int) -> str:
    """Convert square to algebraic notation"""
    if sq == Square.NONE:
        return "-"
    return chr(ord('a') + square_file(sq)) + str(square_rank(sq) + 1)

def parse_square(name: str) -> int:
    """Parse algebraic notation to square"""
    if len(name) != 2:
        return Square.NONE
    file = ord(name[0]) - ord('a')
    rank = int(name[1]) - 1
    if 0 <= file < 8 and 0 <= rank < 8:
        return make_square(file, rank)
    return Square.NONE

# Move representation
@dataclass
class Move:
    from_sq: int
    to_sq: int
    move_type: MoveType
    unklik_index: int = 0      # Which piece from stack (0=bottom, 1=top)
    promotion: PieceType = PieceType.NONE

    def __eq__(self, other):
        if not isinstance(other, Move):
            return False
        return (self.from_sq == other.from_sq and
                self.to_sq == other.to_sq and
                self.move_type == other.move_type and
                self.unklik_index == other.unklik_index and
                self.promotion == other.promotion)

    def __hash__(self):
        return hash((self.from_sq, self.to_sq, self.move_type,
                     self.unklik_index, self.promotion))

    def to_uci(self) -> str:
        """Convert to UCI-style notation with Klikschaak extensions"""
        s = square_name(self.from_sq) + square_name(self.to_sq)

        if self.promotion != PieceType.NONE:
            s += "nbrq"[self.promotion - PieceType.KNIGHT]

        if self.move_type == MoveType.KLIK:
            s += "k"
        elif self.move_type == MoveType.UNKLIK:
            s += f"u{self.unklik_index}"
        elif self.move_type == MoveType.UNKLIK_KLIK:
            s += f"U{self.unklik_index}"

        return s

    def __repr__(self):
        return f"Move({self.to_uci()})"

# Stack on a square (max 2 pieces)
@dataclass
class SquareStack:
    pieces: List[Piece]  # Bottom first, max 2

    def __init__(self, pieces: List[Piece] = None):
        self.pieces = pieces if pieces else []

    def is_empty(self) -> bool:
        return len(self.pieces) == 0

    def has_stack(self) -> bool:
        return len(self.pieces) == 2

    def count(self) -> int:
        return len(self.pieces)

    def top(self) -> Piece:
        return self.pieces[-1] if self.pieces else Piece.NONE

    def bottom(self) -> Piece:
        return self.pieces[0] if self.pieces else Piece.NONE

    def add(self, piece: Piece):
        if len(self.pieces) < 2:
            self.pieces.append(piece)

    def remove_top(self) -> Piece:
        if self.pieces:
            return self.pieces.pop()
        return Piece.NONE

    def remove_at(self, index: int) -> Piece:
        if 0 <= index < len(self.pieces):
            return self.pieces.pop(index)
        return Piece.NONE

    def clear(self):
        self.pieces = []

    def copy(self) -> 'SquareStack':
        return SquareStack(self.pieces.copy())

    def __repr__(self):
        if not self.pieces:
            return "[]"
        return f"[{', '.join(PIECE_CHARS[p] for p in self.pieces)}]"

# Castling rights
class CastlingRights(IntEnum):
    NONE = 0
    W_KINGSIDE = 1
    W_QUEENSIDE = 2
    B_KINGSIDE = 4
    B_QUEENSIDE = 8
    WHITE = W_KINGSIDE | W_QUEENSIDE
    BLACK = B_KINGSIDE | B_QUEENSIDE
    ALL = WHITE | BLACK

# Piece characters for display
PIECE_CHARS = {
    Piece.NONE: '.',
    Piece.W_PAWN: 'P', Piece.W_KNIGHT: 'N', Piece.W_BISHOP: 'B',
    Piece.W_ROOK: 'R', Piece.W_QUEEN: 'Q', Piece.W_KING: 'K',
    Piece.B_PAWN: 'p', Piece.B_KNIGHT: 'n', Piece.B_BISHOP: 'b',
    Piece.B_ROOK: 'r', Piece.B_QUEEN: 'q', Piece.B_KING: 'k',
}

CHAR_TO_PIECE = {v: k for k, v in PIECE_CHARS.items()}

# Piece values for evaluation
PIECE_VALUES = {
    PieceType.NONE: 0,
    PieceType.PAWN: 100,
    PieceType.KNIGHT: 320,
    PieceType.BISHOP: 330,
    PieceType.ROOK: 500,
    PieceType.QUEEN: 900,
    PieceType.KING: 20000,
}
