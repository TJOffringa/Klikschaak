"""
Klikschaak Engine
A chess engine for the Klikschaak variant where pieces can stack.
"""

from .types import (
    Color, Piece, PieceType, Square, Move, MoveType,
    SquareStack, CastlingRights, PIECE_VALUES,
    piece_color, piece_type, make_piece, make_square,
    square_file, square_rank, square_name, parse_square
)

from .board import Board, STARTING_FEN

from .movegen import (
    generate_moves, make_move, is_legal,
    is_in_check, is_attacked
)

from .evaluate import evaluate, CHECKMATE_SCORE

from .search import find_best_move, SearchEngine, SearchInfo

__version__ = "0.1.0"
__all__ = [
    # Types
    'Color', 'Piece', 'PieceType', 'Square', 'Move', 'MoveType',
    'SquareStack', 'CastlingRights', 'PIECE_VALUES',
    'piece_color', 'piece_type', 'make_piece', 'make_square',
    'square_file', 'square_rank', 'square_name', 'parse_square',

    # Board
    'Board', 'STARTING_FEN',

    # Move generation
    'generate_moves', 'make_move', 'is_legal', 'is_in_check', 'is_attacked',

    # Evaluation
    'evaluate', 'CHECKMATE_SCORE',

    # Search
    'find_best_move', 'SearchEngine', 'SearchInfo',
]
