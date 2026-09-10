//! Line-delimited JSON adapter for native parity checks and local experiments.
use std::io::{self, BufRead};
fn main() {
    let mut engine = if std::env::args().any(|arg| arg == "--prototype") {
        polytype_core::Engine::prototype()
    } else {
        polytype_core::Engine::default()
    };
    for line in io::stdin().lock().lines() {
        let response = line
            .map_err(|e| e.to_string())
            .and_then(|line| engine.request(&line));
        match response {
            Ok(result) => println!("{{\"ok\":{result}}}"),
            Err(error) => println!("{}", serde_json::json!({"error": error})),
        }
    }
}
