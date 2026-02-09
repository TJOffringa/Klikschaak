"""
Klikschaak Engine - Alpha-Beta Search
"""
import time
import random
from typing import Optional, Tuple, List
from dataclasses import dataclass
from .types import Color, Move, MoveType, PieceType, piece_type, piece_color, PIECE_VALUES
from .board import Board
from .movegen import generate_moves, make_move, unmake_move, is_in_check
from .evaluate import evaluate, CHECKMATE_SCORE, DRAW_SCORE

# Search constants
MAX_DEPTH = 64
INFINITY = 1000000

# Capture move types for fast checking
_CAPTURE_TYPES = frozenset({
    MoveType.CAPTURE, MoveType.EN_PASSANT, MoveType.PROMOTION_CAPTURE
})


@dataclass
class SearchInfo:
    """Information about the search"""
    nodes: int = 0
    depth: int = 0
    score: int = 0
    pv: List[Move] = None
    time_ms: int = 0
    nps: int = 0

    def __post_init__(self):
        if self.pv is None:
            self.pv = []


class TranspositionEntry:
    """Entry in transposition table"""
    __slots__ = ['key', 'depth', 'score', 'flag', 'best_move']
    EXACT = 0
    ALPHA = 1  # Upper bound
    BETA = 2   # Lower bound

    def __init__(self, key: int, depth: int, score: int, flag: int, best_move: Optional[Move]):
        self.key = key
        self.depth = depth
        self.score = score
        self.flag = flag
        self.best_move = best_move


# Zobrist hashing
class ZobristKeys:
    """Pre-computed random keys for Zobrist hashing."""

    def __init__(self, seed: int = 42):
        rng = random.Random(seed)

        # piece_keys[piece_value][stack_index][square]
        # piece values: 0-14, stack_index: 0-1, square: 0-63
        self.piece_keys = [[[rng.getrandbits(64) for _ in range(64)]
                            for _ in range(2)]
                           for _ in range(15)]

        self.turn_key = rng.getrandbits(64)

        # Castling keys for each of the 16 possible states
        self.castling_keys = [rng.getrandbits(64) for _ in range(16)]

        # En passant file keys
        self.ep_keys = [rng.getrandbits(64) for _ in range(8)]  # 8 files


ZOBRIST = ZobristKeys()


def compute_zobrist(board: Board) -> int:
    """Compute full Zobrist hash for a position."""
    h = 0
    piece_keys = ZOBRIST.piece_keys

    for sq in range(64):
        pieces = board.squares[sq].pieces
        for i, piece in enumerate(pieces):
            h ^= piece_keys[int(piece)][i][sq]

    if board.turn == Color.BLACK:
        h ^= ZOBRIST.turn_key

    h ^= ZOBRIST.castling_keys[board.castling]

    if board.ep_square is not None:
        h ^= ZOBRIST.ep_keys[board.ep_square & 7]

    return h


class SearchEngine:
    """
    Alpha-beta search engine for Klikschaak.
    """

    def __init__(self):
        self.nodes = 0
        self.start_time = 0
        self.max_time_ms = 0
        self.stop_search = False

        # Transposition table
        self.tt: dict[int, TranspositionEntry] = {}
        self.tt_size = 1000000

        # Killer moves (moves that caused beta cutoffs)
        self.killers: List[List[Optional[Move]]] = [[None, None] for _ in range(MAX_DEPTH)]

        # History heuristic
        self.history: List[List[int]] = [[0] * 64 for _ in range(64)]

    def clear(self):
        """Clear search state"""
        self.tt.clear()
        self.killers = [[None, None] for _ in range(MAX_DEPTH)]
        self.history = [[0] * 64 for _ in range(64)]

    def search(self, board: Board, depth: int = 6,
               time_limit_ms: int = None) -> Tuple[Move, SearchInfo]:
        """
        Search for the best move using iterative deepening.
        """
        self.nodes = 0
        self.start_time = time.time() * 1000
        self.max_time_ms = time_limit_ms or float('inf')
        self.stop_search = False

        info = SearchInfo()
        best_move = None

        # Iterative deepening
        for d in range(1, depth + 1):
            if self.stop_search:
                break

            score, pv = self.alpha_beta(board, d, -INFINITY, INFINITY, [])

            if not self.stop_search:
                info.depth = d
                info.score = score if board.turn == Color.WHITE else -score
                info.pv = pv[:]
                info.nodes = self.nodes

                if pv:
                    best_move = pv[0]

                elapsed = time.time() * 1000 - self.start_time
                info.time_ms = int(elapsed)
                info.nps = int(self.nodes / (elapsed / 1000)) if elapsed > 0 else 0

                print(f"info depth {d} score cp {info.score} nodes {self.nodes} "
                      f"nps {info.nps} time {info.time_ms} pv {' '.join(m.to_uci() for m in pv)}")

        if best_move is None:
            moves = generate_moves(board)
            if moves:
                best_move = moves[0]

        return best_move, info

    def alpha_beta(self, board: Board, depth: int, alpha: int, beta: int,
                   pv: List[Move]) -> Tuple[int, List[Move]]:
        """
        Alpha-beta search with PV tracking.
        Uses make/unmake instead of board.copy() for performance.
        """
        self.nodes += 1

        # Time check
        if self.nodes % 4096 == 0:
            elapsed = time.time() * 1000 - self.start_time
            if elapsed >= self.max_time_ms:
                self.stop_search = True
                return 0, []

        if self.stop_search:
            return 0, []

        # Leaf node - evaluate via quiescence
        if depth <= 0:
            score = self.quiescence(board, alpha, beta)
            return score, []

        # TT lookup
        tt_key = compute_zobrist(board)
        tt_entry = self.tt.get(tt_key)
        tt_move = None

        if tt_entry and tt_entry.key == tt_key:
            if tt_entry.depth >= depth:
                if tt_entry.flag == TranspositionEntry.EXACT:
                    return tt_entry.score, [tt_entry.best_move] if tt_entry.best_move else []
                elif tt_entry.flag == TranspositionEntry.ALPHA:
                    if tt_entry.score <= alpha:
                        return alpha, []
                elif tt_entry.flag == TranspositionEntry.BETA:
                    if tt_entry.score >= beta:
                        return beta, []
            tt_move = tt_entry.best_move

        # Generate pseudo-legal moves
        moves = generate_moves(board, legal_only=False)

        if not moves:
            if is_in_check(board, board.turn):
                return -CHECKMATE_SCORE + (MAX_DEPTH - depth), []
            else:
                return DRAW_SCORE, []

        # Move ordering
        moves = self.order_moves(board, moves, depth, tt_move)

        original_alpha = alpha
        best_score = -INFINITY
        best_move = None
        best_pv = []
        legal_count = 0

        for i, move in enumerate(moves):
            # Make move on the board (in-place)
            undo = make_move(board, move)

            # Skip illegal moves (king left in check)
            if is_in_check(board, board.turn.opposite()):
                unmake_move(board, move, undo)
                continue

            legal_count += 1

            # Search
            if legal_count == 1:
                # Full window search for first legal move
                score, child_pv = self.alpha_beta(board, depth - 1,
                                                   -beta, -alpha, [])
                score = -score
            else:
                # Null window search
                score, _ = self.alpha_beta(board, depth - 1,
                                           -alpha - 1, -alpha, [])
                score = -score

                # Re-search if necessary
                if alpha < score < beta:
                    score, child_pv = self.alpha_beta(board, depth - 1,
                                                       -beta, -score, [])
                    score = -score
                else:
                    child_pv = []

            # Unmake
            unmake_move(board, move, undo)

            if self.stop_search:
                return 0, []

            if score > best_score:
                best_score = score
                best_move = move
                best_pv = [move] + child_pv

            if score > alpha:
                alpha = score

            if alpha >= beta:
                # Beta cutoff - update killers and history
                if move not in self.killers[depth]:
                    self.killers[depth][1] = self.killers[depth][0]
                    self.killers[depth][0] = move
                self.history[move.from_sq][move.to_sq] += depth * depth
                break

        # No legal moves found
        if legal_count == 0:
            if is_in_check(board, board.turn):
                return -CHECKMATE_SCORE + (MAX_DEPTH - depth), []
            else:
                return DRAW_SCORE, []

        # Store in TT
        flag = TranspositionEntry.EXACT
        if best_score <= original_alpha:
            flag = TranspositionEntry.ALPHA
        elif best_score >= beta:
            flag = TranspositionEntry.BETA

        if len(self.tt) < self.tt_size:
            self.tt[tt_key] = TranspositionEntry(tt_key, depth, best_score, flag, best_move)

        return best_score, best_pv

    def quiescence(self, board: Board, alpha: int, beta: int, qdepth: int = 0) -> int:
        """
        Quiescence search - only search captures to avoid horizon effect.
        Uses captures-only move generation and make/unmake.
        """
        self.nodes += 1

        # Stand pat
        stand_pat = evaluate(board)
        if board.turn == Color.BLACK:
            stand_pat = -stand_pat

        if stand_pat >= beta:
            return beta

        if alpha < stand_pat:
            alpha = stand_pat

        # Depth limit
        if qdepth >= 10:
            return alpha

        # Generate captures only
        captures = generate_moves(board, legal_only=False, captures_only=True)

        # Order captures by MVV-LVA
        if captures:
            captures.sort(key=lambda m: self.mvv_lva_score(board, m), reverse=True)

        for move in captures:
            undo = make_move(board, move)

            # Skip illegal moves
            if is_in_check(board, board.turn.opposite()):
                unmake_move(board, move, undo)
                continue

            score = -self.quiescence(board, -beta, -alpha, qdepth + 1)

            unmake_move(board, move, undo)

            if score >= beta:
                return beta

            if score > alpha:
                alpha = score

        return alpha

    def is_capture(self, board: Board, move: Move) -> bool:
        """Check if move is a capture"""
        if move.move_type in _CAPTURE_TYPES:
            return True

        target_pieces = board.squares[move.to_sq].pieces
        if target_pieces:
            return piece_color(target_pieces[-1]) != board.turn

        return False

    def mvv_lva_score(self, board: Board, move: Move) -> int:
        """Most Valuable Victim - Least Valuable Attacker score."""
        # Victim value
        target_pieces = board.squares[move.to_sq].pieces
        if not target_pieces:
            victim_value = 100  # en passant
        else:
            victim_value = sum(PIECE_VALUES[piece_type(p)] for p in target_pieces
                               if piece_color(p) != board.turn)

        # Attacker value
        from_pieces = board.squares[move.from_sq].pieces
        if move.unklik_index is not None and 0 <= move.unklik_index < len(from_pieces):
            attacker = from_pieces[move.unklik_index]
        else:
            attacker = from_pieces[-1] if from_pieces else None

        attacker_value = PIECE_VALUES[piece_type(attacker)] if attacker else 0

        return victim_value * 10 - attacker_value

    def order_moves(self, board: Board, moves: List[Move], depth: int,
                    tt_move: Optional[Move]) -> List[Move]:
        """Order moves for better pruning"""
        scored_moves = []

        for move in moves:
            score = 0

            # TT move first
            if tt_move and move == tt_move:
                score = 10000000
            # Captures by MVV-LVA
            elif self.is_capture(board, move):
                score = 1000000 + self.mvv_lva_score(board, move)
            # Killers
            elif depth < MAX_DEPTH and move == self.killers[depth][0]:
                score = 900000
            elif depth < MAX_DEPTH and move == self.killers[depth][1]:
                score = 800000
            # History heuristic
            else:
                score = self.history[move.from_sq][move.to_sq]

            scored_moves.append((score, move))

        scored_moves.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored_moves]


# Global engine instance
engine = SearchEngine()


def find_best_move(board: Board, depth: int = 6,
                   time_limit_ms: int = None) -> Tuple[Move, SearchInfo]:
    """Find the best move in a position."""
    return engine.search(board, depth, time_limit_ms)
