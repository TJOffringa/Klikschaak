"""
Klikschaak Engine - Board Representation
"""
from typing import List, Optional, Iterator, Tuple
from .types import (
    Color, Piece, PieceType, Square, SquareStack, CastlingRights,
    piece_color, piece_type, make_piece, make_square, square_file, square_rank,
    square_name, PIECE_CHARS, CHAR_TO_PIECE
)

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class Board:
    """
    Klikschaak board representation.
    Supports stacking up to 2 pieces per square.
    """

    def __init__(self):
        # Board is array of SquareStack
        self.squares: List[SquareStack] = [SquareStack() for _ in range(64)]

        # Side to move
        self.turn: Color = Color.WHITE

        # Castling rights
        self.castling: int = CastlingRights.ALL

        # En passant target square (or None)
        self.ep_square: Optional[int] = None

        # Halfmove clock (for 50 move rule)
        self.halfmove_clock: int = 0

        # Fullmove number
        self.fullmove: int = 1

        # King positions for quick lookup
        self.king_sq: List[int] = [Square.E1, Square.E8]

        # Unmoved pawns bitmask per color [WHITE, BLACK]
        # Bit X set = pawn on file X hasn't moved from starting rank
        self.unmoved_pawns: List[int] = [0xFF, 0xFF]

        # Zobrist hash (updated incrementally by make/unmake)
        self.zobrist_hash: int = 0

        # Move history for undo
        self.history: List[dict] = []

    def copy(self) -> 'Board':
        """Create a deep copy of the board"""
        b = Board()
        b.squares = [sq.copy() for sq in self.squares]
        b.turn = self.turn
        b.castling = self.castling
        b.ep_square = self.ep_square
        b.halfmove_clock = self.halfmove_clock
        b.fullmove = self.fullmove
        b.king_sq = self.king_sq.copy()
        b.unmoved_pawns = self.unmoved_pawns.copy()
        b.zobrist_hash = self.zobrist_hash
        return b

    def reset(self):
        """Reset to starting position"""
        self.set_fen(STARTING_FEN)

    def clear(self):
        """Clear the board"""
        self.squares = [SquareStack() for _ in range(64)]
        self.turn = Color.WHITE
        self.castling = CastlingRights.NONE
        self.ep_square = None
        self.halfmove_clock = 0
        self.fullmove = 1
        self.king_sq = [Square.NONE, Square.NONE]
        self.unmoved_pawns = [0x00, 0x00]
        self.zobrist_hash = 0
        self.history = []

    # -------------------------------------------------------------------------
    # Piece access
    # -------------------------------------------------------------------------

    def piece_at(self, sq: int) -> Piece:
        """Get the top piece at a square"""
        return self.squares[sq].top()

    def stack_at(self, sq: int) -> SquareStack:
        """Get the full stack at a square"""
        return self.squares[sq]

    def is_empty(self, sq: int) -> bool:
        """Check if square is empty"""
        return self.squares[sq].is_empty()

    def has_stack(self, sq: int) -> bool:
        """Check if square has a stack (2 pieces)"""
        return self.squares[sq].has_stack()

    def put_piece(self, sq: int, piece: Piece):
        """Put a single piece on an empty square"""
        self.squares[sq] = SquareStack([piece])
        if piece_type(piece) == PieceType.KING:
            self.king_sq[piece_color(piece)] = sq

    def add_to_stack(self, sq: int, piece: Piece):
        """Add piece to stack (klik move)"""
        self.squares[sq].add(piece)

    def remove_piece(self, sq: int) -> SquareStack:
        """Remove all pieces from square, return the stack"""
        stack = self.squares[sq].copy()
        self.squares[sq].clear()
        return stack

    def remove_from_stack(self, sq: int, index: int) -> Piece:
        """Remove specific piece from stack (unklik move)"""
        return self.squares[sq].remove_at(index)

    # -------------------------------------------------------------------------
    # Piece iteration
    # -------------------------------------------------------------------------

    def pieces(self, color: Color = None, pt: PieceType = None) -> Iterator[Tuple[int, Piece]]:
        """
        Iterate over pieces on the board.
        Yields (square, piece) tuples.
        For stacks, yields each piece separately with same square.
        """
        for sq in range(64):
            for piece in self.squares[sq].pieces:
                if color is not None and piece_color(piece) != color:
                    continue
                if pt is not None and piece_type(piece) != pt:
                    continue
                yield sq, piece

    def piece_squares(self, color: Color, pt: PieceType) -> List[int]:
        """Get list of squares with specific piece type"""
        result = []
        for sq in range(64):
            for piece in self.squares[sq].pieces:
                if piece_color(piece) == color and piece_type(piece) == pt:
                    result.append(sq)
                    break  # Only count square once even if stacked
        return result

    # -------------------------------------------------------------------------
    # FEN parsing/generation
    # -------------------------------------------------------------------------

    def set_fen(self, fen: str):
        """Set position from FEN string (extended for Klikschaak stacks)"""
        self.clear()

        parts = fen.split()
        if len(parts) < 4:
            raise ValueError(f"Invalid FEN: {fen}")

        # Board
        rank = 7
        file = 0
        i = 0
        board_str = parts[0]

        while i < len(board_str):
            c = board_str[i]

            if c == '/':
                rank -= 1
                file = 0
            elif c.isdigit():
                file += int(c)
            elif c == '(':
                # Stack notation: (Np) = Knight on top of pawn
                i += 1
                pieces = []
                while i < len(board_str) and board_str[i] != ')':
                    if board_str[i] in CHAR_TO_PIECE:
                        pieces.append(CHAR_TO_PIECE[board_str[i]])
                    i += 1
                sq = make_square(file, rank)
                self.squares[sq] = SquareStack(pieces)
                for p in pieces:
                    if piece_type(p) == PieceType.KING:
                        self.king_sq[piece_color(p)] = sq
                file += 1
            elif c in CHAR_TO_PIECE:
                sq = make_square(file, rank)
                piece = CHAR_TO_PIECE[c]
                self.put_piece(sq, piece)
                file += 1

            i += 1

        # Side to move
        self.turn = Color.WHITE if parts[1] == 'w' else Color.BLACK

        # Castling rights
        self.castling = CastlingRights.NONE
        if 'K' in parts[2]:
            self.castling |= CastlingRights.W_KINGSIDE
        if 'Q' in parts[2]:
            self.castling |= CastlingRights.W_QUEENSIDE
        if 'k' in parts[2]:
            self.castling |= CastlingRights.B_KINGSIDE
        if 'q' in parts[2]:
            self.castling |= CastlingRights.B_QUEENSIDE

        # En passant
        if parts[3] != '-':
            file = ord(parts[3][0]) - ord('a')
            rank = int(parts[3][1]) - 1
            self.ep_square = make_square(file, rank)

        # Halfmove clock and fullmove number
        if len(parts) > 4:
            self.halfmove_clock = int(parts[4])
        if len(parts) > 5:
            self.fullmove = int(parts[5])

        # Initialize unmoved_pawns based on pawns on starting ranks
        self.unmoved_pawns = [0x00, 0x00]
        for f in range(8):
            # White pawns on rank 1 (index 1)
            sq_w = make_square(f, 1)
            for p in self.squares[sq_w].pieces:
                if p == Piece.W_PAWN:
                    self.unmoved_pawns[Color.WHITE] |= (1 << f)
                    break
            # Black pawns on rank 6 (index 6)
            sq_b = make_square(f, 6)
            for p in self.squares[sq_b].pieces:
                if p == Piece.B_PAWN:
                    self.unmoved_pawns[Color.BLACK] |= (1 << f)
                    break

    def get_fen(self) -> str:
        """Get FEN string for current position"""
        fen_parts = []

        # Board
        board_str = ""
        for rank in range(7, -1, -1):
            empty = 0
            for file in range(8):
                sq = make_square(file, rank)
                stack = self.squares[sq]

                if stack.is_empty():
                    empty += 1
                else:
                    if empty > 0:
                        board_str += str(empty)
                        empty = 0

                    if stack.has_stack():
                        # Stack notation
                        board_str += '('
                        for p in stack.pieces:
                            board_str += PIECE_CHARS[p]
                        board_str += ')'
                    else:
                        board_str += PIECE_CHARS[stack.top()]

            if empty > 0:
                board_str += str(empty)
            if rank > 0:
                board_str += '/'

        fen_parts.append(board_str)

        # Side to move
        fen_parts.append('w' if self.turn == Color.WHITE else 'b')

        # Castling
        castling_str = ""
        if self.castling & CastlingRights.W_KINGSIDE:
            castling_str += 'K'
        if self.castling & CastlingRights.W_QUEENSIDE:
            castling_str += 'Q'
        if self.castling & CastlingRights.B_KINGSIDE:
            castling_str += 'k'
        if self.castling & CastlingRights.B_QUEENSIDE:
            castling_str += 'q'
        fen_parts.append(castling_str or '-')

        # En passant
        fen_parts.append(square_name(self.ep_square) if self.ep_square else '-')

        # Halfmove clock and fullmove
        fen_parts.append(str(self.halfmove_clock))
        fen_parts.append(str(self.fullmove))

        return ' '.join(fen_parts)

    # -------------------------------------------------------------------------
    # Display
    # -------------------------------------------------------------------------

    def __str__(self) -> str:
        """Pretty print the board"""
        lines = []
        lines.append("  +-----------------+")

        for rank in range(7, -1, -1):
            line = f"{rank + 1} | "
            for file in range(8):
                sq = make_square(file, rank)
                stack = self.squares[sq]

                if stack.is_empty():
                    line += ". "
                elif stack.has_stack():
                    # Show stack as two chars
                    line += PIECE_CHARS[stack.bottom()] + PIECE_CHARS[stack.top()].lower()
                else:
                    line += PIECE_CHARS[stack.top()] + " "

            line += "|"
            lines.append(line)

        lines.append("  +-----------------+")
        lines.append("    a b c d e f g h")
        lines.append(f"\nTurn: {'White' if self.turn == Color.WHITE else 'Black'}")
        lines.append(f"FEN: {self.get_fen()}")

        return '\n'.join(lines)

    def __repr__(self):
        return f"Board('{self.get_fen()}')"
