use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::LazyLock,
};

static TABLE: LazyLock<HashMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/kana.json")).expect("valid bundled kana table")
});
static PREFIXES: LazyLock<HashSet<String>> = LazyLock::new(|| {
    TABLE
        .keys()
        .flat_map(|key| (1..key.len()).map(|end| key[..end].to_owned()))
        .collect()
});

#[derive(Debug, Serialize, Deserialize)]
pub struct Composition {
    #[serde(skip)]
    pub(crate) explicit_small_kana: usize,
    pub text: String,
    pub kana: String,
    pub pending: String,
    pub complete: bool,
}

pub fn to_katakana(text: &str) -> String {
    text.chars()
        .map(|c| {
            if ('ぁ'..='ゖ').contains(&c) {
                char::from_u32(c as u32 + 0x60).unwrap()
            } else {
                c
            }
        })
        .collect()
}

pub fn compose_japanese(roman: &str, final_input: bool) -> Option<Composition> {
    // All recognized romaji is ASCII. Reject other input without slicing UTF-8.
    if !roman.is_ascii() {
        return None;
    }
    let input = roman.to_ascii_lowercase();
    let mut offset = 0;
    let mut kana = String::new();
    let mut pending = String::new();
    let mut explicit_small_kana = 0;
    while offset < input.len() {
        let rest = &input[offset..];
        let bytes = rest.as_bytes();
        if bytes[0] == b'n' {
            if rest == "n" {
                if final_input {
                    kana.push('ん');
                } else {
                    pending.push('n');
                }
                break;
            }
            if bytes[1] == b'\'' {
                kana.push('ん');
                offset += 2;
                continue;
            }
            if bytes[1] == b'n' {
                kana.push('ん');
                offset += if bytes.len() > 2 && b"aiueoy".contains(&bytes[2]) {
                    1
                } else {
                    2
                };
                continue;
            }
            if bytes[1].is_ascii_lowercase() && !b"aiueoy".contains(&bytes[1]) {
                kana.push('ん');
                offset += 1;
                continue;
            }
        }
        if (bytes.len() > 1 && bytes[0] == bytes[1] && b"bcdfghjkpqrstvwxyz".contains(&bytes[0]))
            || rest.starts_with("tch")
        {
            kana.push('っ');
            offset += 1;
            continue;
        }
        if bytes[0] == b'-' && !kana.is_empty() {
            kana.push('ー');
            offset += 1;
            continue;
        }
        if let Some((length, value)) = (1..=rest.len().min(4))
            .rev()
            .find_map(|length| TABLE.get(&rest[..length]).map(|value| (length, value)))
        {
            if offset > 0 && matches!(bytes[0], b'x' | b'l') {
                explicit_small_kana += 1;
            }
            kana.push_str(value);
            offset += length;
            continue;
        }
        if PREFIXES.contains(rest) {
            pending = rest.to_owned();
            break;
        }
        return None;
    }
    Some(Composition {
        explicit_small_kana,
        text: format!("{kana}{pending}"),
        complete: pending.is_empty(),
        kana,
        pending,
    })
}
