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

// Unmodified, pinned upstream data; see data/japanese-source.json and notices.
static MOZC: LazyLock<HashMap<&'static str, (&'static str, &'static str)>> = LazyLock::new(|| {
    include_str!("../../../data/sources/mozc/romanji-hiragana.tsv")
        .lines()
        .map(|line| {
            let mut fields = line.split('\t');
            let key = fields.next().unwrap();
            (key, (fields.next().unwrap(), fields.next().unwrap_or("")))
        })
        .collect()
});
static MOZC_PREFIXES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    MOZC.keys()
        .flat_map(|key| (1..key.len()).map(|end| &key[..end]))
        .collect()
});

fn compose_mozc(roman: &str, final_input: bool) -> Option<Composition> {
    if !roman.is_ascii() {
        return None;
    }
    let mut rest = roman.to_ascii_lowercase();
    let mut kana = String::new();
    let mut pending = String::new();
    let mut explicit_small_kana = 0;
    let mut consumed = false;
    while !rest.is_empty() {
        // A prefix such as ny must not fall back to n until disambiguated.
        if (rest == "n" && !final_input)
            || (MOZC_PREFIXES.contains(rest.as_str()) && !MOZC.contains_key(rest.as_str()))
        {
            pending = rest;
            break;
        }
        let (length, &(output, carry)) = (1..=rest.len().min(4))
            .rev()
            .find_map(|length| MOZC.get(&rest[..length]).map(|rule| (length, rule)))?;
        if consumed
            && rest.starts_with(['x', 'l'])
            && output
                .chars()
                .any(|c| "ぁぃぅぇぉゃゅょっゎヵヶ".contains(c))
        {
            explicit_small_kana += 1;
        }
        kana.push_str(output);
        consumed = true;
        if length == rest.len() {
            // A rule's pending field is continuation, not fresh input. In
            // particular www -> w + pending ww must not recursively consume ww.
            pending = carry.to_owned();
            break;
        }
        rest = format!("{carry}{}", &rest[length..]);
    }
    Some(Composition {
        explicit_small_kana,
        text: format!("{kana}{pending}"),
        complete: pending.is_empty(),
        kana,
        pending,
    })
}

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
    compose_with_convention(roman, final_input, true)
}

// The prototype retains its historical n-onset convenience for migration parity.
// Modern input follows Mozc's nn -> ん rule with no pending second n.
pub(crate) fn compose_with_convention(
    roman: &str,
    final_input: bool,
    modern: bool,
) -> Option<Composition> {
    if modern {
        return compose_mozc(roman, final_input);
    }
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
                offset += if !modern && bytes.len() > 2 && b"aiueoy".contains(&bytes[2]) {
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn public_composer_consumes_nn_but_prototype_preserves_its_old_convention() {
        for (input, modern, legacy) in [
            ("shinnyou", "しんよう", "しんにょう"),
            ("konna", "こんあ", "こんな"),
            ("nnya", "んや", "んにゃ"),
        ] {
            assert_eq!(compose_japanese(input, true).unwrap().text, modern);
            assert_eq!(
                compose_with_convention(input, true, false).unwrap().text,
                legacy
            );
        }
    }
}
