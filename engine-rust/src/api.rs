/// Klikschaak Engine - HTTP API (stdlib, threaded)

use std::io::{Read, Write, BufRead, BufReader};
use std::net::TcpListener;
use std::thread;

use crate::board::Board;
use crate::movegen::generate_moves;
use crate::search::{SearchEngine, compute_zobrist, MAX_DEPTH};
use crate::evaluate::CHECKMATE_SCORE;
use crate::types::move_type_name;

const PORT: u16 = 5005;

fn parse_request(stream: &mut std::net::TcpStream) -> Option<(String, String, String)> {
    let mut reader = BufReader::new(stream.try_clone().ok()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    let parts: Vec<&str> = request_line.trim().split_whitespace().collect();
    if parts.len() < 2 { return None; }
    let method = parts[0].to_string();
    let path = parts[1].to_string();

    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).ok()?;
        if line.trim().is_empty() { break; }
        let lower = line.to_lowercase();
        if lower.starts_with("content-length:") {
            content_length = lower.split(':').nth(1)?.trim().parse().unwrap_or(0);
        }
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body).ok()?;
    }

    Some((method, path, String::from_utf8_lossy(&body).to_string()))
}

fn send_response(stream: &mut std::net::TcpStream, status: u16, body: &str) {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status, status_text, body.len(), body
    );

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn handle_health(stream: &mut std::net::TcpStream) {
    send_response(stream, 200, r#"{"status":"ok"}"#);
}

fn handle_moves(stream: &mut std::net::TcpStream, body: &str) {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(body);
    let data = match parsed {
        Ok(v) => v,
        Err(e) => {
            let err = serde_json::json!({"error": e.to_string(), "count": 0, "moves": []});
            send_response(stream, 400, &err.to_string());
            return;
        }
    };

    let fen = data.get("fen").and_then(|v| v.as_str()).unwrap_or("");
    if fen.is_empty() {
        send_response(stream, 400, r#"{"error":"Missing fen field"}"#);
        return;
    }

    let result = std::panic::catch_unwind(|| {
        let mut board = Board::from_fen(fen);
        compute_zobrist(&mut board);
        let moves = generate_moves(&mut board, true, false);

        let move_list: Vec<serde_json::Value> = moves.iter().map(|m| {
            serde_json::json!({
                "uci": m.to_uci(),
                "type": move_type_name(m.move_type),
            })
        }).collect();

        serde_json::json!({
            "count": move_list.len(),
            "moves": move_list,
            "error": null,
        })
    });

    match result {
        Ok(resp) => send_response(stream, 200, &resp.to_string()),
        Err(_) => {
            let err = serde_json::json!({"error": "Internal error", "count": 0, "moves": []});
            send_response(stream, 500, &err.to_string());
        }
    }
}

fn handle_eval(stream: &mut std::net::TcpStream, body: &str) {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(body);
    let data = match parsed {
        Ok(v) => v,
        Err(e) => {
            let err = serde_json::json!({"error": e.to_string()});
            send_response(stream, 400, &err.to_string());
            return;
        }
    };

    let fen = data.get("fen").and_then(|v| v.as_str()).unwrap_or("");
    if fen.is_empty() {
        send_response(stream, 400, r#"{"error":"Missing fen field"}"#);
        return;
    }

    let depth = data.get("depth").and_then(|v| v.as_u64()).unwrap_or(4) as u32;
    let depth = depth.max(1).min(20);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut board = Board::from_fen(fen);
        let mut searcher = SearchEngine::new();
        let (best_move, info) = searcher.search(&mut board, depth, None);

        let mut score = info.score;
        let score_type = if score.abs() >= CHECKMATE_SCORE - MAX_DEPTH as i32 {
            if score > 0 {
                score = (CHECKMATE_SCORE - score + 1) / 2;
            } else {
                score = -(CHECKMATE_SCORE + score + 1) / 2;
            }
            "mate"
        } else {
            "cp"
        };

        serde_json::json!({
            "score": score,
            "scoreType": score_type,
            "bestMove": best_move.map(|m| m.to_uci()),
            "pv": info.pv.iter().map(|m| m.to_uci()).collect::<Vec<_>>(),
            "depth": info.depth,
            "nodes": info.nodes,
            "nps": info.nps,
            "time_ms": info.time_ms,
            "error": null,
        })
    }));

    match result {
        Ok(resp) => send_response(stream, 200, &resp.to_string()),
        Err(_) => {
            let err = serde_json::json!({"error": "Internal error during evaluation"});
            send_response(stream, 500, &err.to_string());
        }
    }
}

fn handle_connection(mut stream: std::net::TcpStream) {
    if let Some((method, path, body)) = parse_request(&mut stream) {
        match (method.as_str(), path.as_str()) {
            ("OPTIONS", _) => send_response(&mut stream, 200, ""),
            ("GET", "/health") => handle_health(&mut stream),
            ("POST", "/moves") => handle_moves(&mut stream, &body),
            ("POST", "/eval") => handle_eval(&mut stream, &body),
            _ => send_response(&mut stream, 404, r#"{"error":"Not found"}"#),
        }
    }
}

pub fn run_server() {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", PORT))
        .expect(&format!("Failed to bind to port {}", PORT));

    println!("Klikschaak Engine API (Rust) running on http://localhost:{}", PORT);
    println!("  GET  /health  - Health check");
    println!("  POST /moves   - Generate legal moves for a FEN position");
    println!("  POST /eval    - Evaluate position (score, best move, PV)");
    println!("Press Ctrl+C to stop.");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(move || {
                    handle_connection(stream);
                });
            }
            Err(e) => eprintln!("Connection error: {}", e),
        }
    }
}
