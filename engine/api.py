"""
Klikschaak Engine - HTTP API
Lightweight HTTP server for move generation queries.
Run with: python -m engine.api
"""
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from .board import Board
from .movegen import generate_moves


PORT = 5005


class EngineHandler(BaseHTTPRequestHandler):
    """Handle HTTP requests for the Klikschaak engine."""

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        """Health check endpoint."""
        if self.path == '/health':
            self._json_response({'status': 'ok'})
        else:
            self._json_response({'error': 'Not found'}, 404)

    def do_POST(self):
        """Handle move generation requests."""
        if self.path == '/moves':
            self._handle_moves()
        else:
            self._json_response({'error': 'Not found'}, 404)

    def _handle_moves(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            fen = data.get('fen', '')

            if not fen:
                self._json_response({'error': 'Missing fen field'}, 400)
                return

            board = Board()
            board.set_fen(fen)

            moves = generate_moves(board, legal_only=True)
            move_list = []
            for m in moves:
                move_list.append({
                    'uci': m.to_uci(),
                    'type': m.move_type.name,
                })

            self._json_response({
                'count': len(moves),
                'moves': move_list,
                'error': None,
            })

        except Exception as e:
            self._json_response({'error': str(e), 'count': 0, 'moves': []}, 500)

    def _json_response(self, data, status=200):
        self.send_response(status)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        """Suppress default logging, only log errors."""
        if args and '500' in str(args[0]):
            super().log_message(format, *args)


def main():
    server = HTTPServer(('localhost', PORT), EngineHandler)
    print(f"Klikschaak Engine API running on http://localhost:{PORT}")
    print(f"  GET  /health  - Health check")
    print(f"  POST /moves   - Generate legal moves for a FEN position")
    print(f"Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()


if __name__ == '__main__':
    main()
