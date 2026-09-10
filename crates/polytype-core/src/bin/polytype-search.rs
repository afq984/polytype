//! Native-only, bounded diagnostic transport. Never enabled in the web build.
use polytype_core::{DecodeOptions, Engine};
use serde::Deserialize;
use std::io::{self, BufRead};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    raw: String,
    #[serde(default)]
    options: DecodeOptions,
    width: usize,
}

fn main() {
    let engine = Engine::default();
    let diversity = !std::env::args().any(|arg| arg == "--baseline");
    for line in io::stdin().lock().lines() {
        let result = line.map_err(|e| e.to_string()).and_then(|line| {
            let request: Request = serde_json::from_str(&line).map_err(|e| e.to_string())?;
            engine.diagnose(&request.raw, &request.options, request.width, diversity)
        });
        match result {
            Ok(value) => println!("{}", serde_json::json!({"ok":value})),
            Err(error) => println!("{}", serde_json::json!({"error":error})),
        }
    }
}
