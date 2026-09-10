use crate::{
    DecodeOptions, Layout,
    dictionary::{Dictionary, LEXICON, english_tier},
    japanese::{compose_japanese, to_katakana},
    phonetic::{read_units, utf16_len, zhuyin},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Part {
    pub raw: String,
    pub text: String,
    pub lang: String,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slots: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub complete: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Candidate {
    pub text: String,
    pub score: f64,
    pub lang: Option<String>,
    pub parts: Vec<Part>,
}

impl Candidate {
    pub fn commit_text(&self) -> String {
        self.parts
            .iter()
            .map(|p| p.commit_text.as_deref().unwrap_or(&p.text))
            .collect()
    }
}

fn push(
    beams: &mut [Vec<Candidate>],
    at: usize,
    state: &Candidate,
    part: Part,
    score: f64,
    lang: Option<&str>,
) {
    let mut parts = state.parts.clone();
    let text = format!("{}{}", state.text, part.text);
    parts.push(part);
    let beam = &mut beams[at];
    beam.push(Candidate {
        text,
        score: state.score + score,
        lang: lang.map(str::to_owned),
        parts,
    });
    // Stable ordering matches JavaScript's stable sort, including tied scores.
    beam.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut seen = HashSet::new();
    beam.retain(|candidate| seen.insert((candidate.text.clone(), candidate.lang.clone())));
    beam.truncate(12);
}

fn punctuation(unit: u16, expanded: bool) -> bool {
    char::from_u32(unit as u32)
        .is_some_and(|c| "?!？！。，；：".contains(c) || (expanded && "():".contains(c)))
}

fn segment(raw: &[u16], start: usize, end: usize) -> String {
    String::from_utf16_lossy(&raw[start..end])
}

fn is_particle(spelling: &str) -> bool {
    matches!(
        spelling,
        "ha" | "ga" | "no" | "wo" | "ni" | "de" | "to" | "kara" | "made" | "mo" | "he" | "ka"
    )
}

pub(crate) fn decode(
    input: &str,
    dictionary: &Dictionary,
    options: &DecodeOptions,
) -> Vec<Candidate> {
    let mut result = decode_lattice(input, dictionary, options);
    // A bounded mixed-language beam can discard every English path before a
    // later operator arrives. Reserve a slot for an independently decoded
    // literal-English path, even when phonetic scores crowd it out.
    if dictionary.expanded && options.english && (options.japanese || options.zhuyin) {
        let literal_options = DecodeOptions {
            japanese: false,
            zhuyin: false,
            ..options.clone()
        };
        if let Some(literal) = decode_lattice(input, dictionary, &literal_options)
            .into_iter()
            .next()
            && !result
                .iter()
                .any(|candidate| candidate.text == literal.text)
        {
            result.truncate(4);
            result.push(literal);
            result.sort_by(|a, b| b.score.total_cmp(&a.score));
        }
    }
    result
}

fn decode_lattice(input: &str, dictionary: &Dictionary, options: &DecodeOptions) -> Vec<Candidate> {
    if !options.english && !options.japanese && !options.zhuyin {
        return Vec::new();
    }
    let raw: Vec<u16> = input.encode_utf16().take(400).collect();
    let mut beams = vec![Vec::new(); raw.len() + 1];
    beams[0].push(Candidate::default());
    for i in 0..raw.len() {
        for state in beams[i].clone() {
            if punctuation(raw[i], dictionary.expanded) {
                let text = segment(&raw, i, i + 1);
                push(
                    &mut beams,
                    i + 1,
                    &state,
                    Part {
                        raw: text.clone(),
                        text,
                        lang: "punct".into(),
                        note: "Literal punctuation".into(),
                        ..Part::default()
                    },
                    0.0,
                    None,
                );
                continue;
            }
            if raw[i] == b' ' as u16 {
                push(
                    &mut beams,
                    i + 1,
                    &state,
                    Part {
                        raw: " ".into(),
                        text: " ".into(),
                        lang: "space".into(),
                        note: "Literal space · language boundary".into(),
                        ..Part::default()
                    },
                    -0.1,
                    None,
                );
            }
            if options.zhuyin && (state.lang.is_none() || state.lang.as_deref() == Some("TW")) {
                let mut at = i;
                let mut keys = Vec::new();
                let mut length = 0;
                let mut readings = Vec::new();
                let mut changes = Vec::new();
                // The JS reference shares the changes array with prior phrase
                // parts. Accumulate all scanned replacements before emitting
                // phrase matches to preserve the existing trace behavior.
                let mut matches = Vec::new();
                for _ in 0..12 {
                    if at >= raw.len() {
                        break;
                    }
                    let Some(part) = read_units(&raw, at).filter(|p| p.complete) else {
                        break;
                    };
                    at = part.end;
                    length += part.key.len();
                    readings.push(zhuyin(&part.key));
                    changes.extend(part.changes);
                    keys.push(part.key);
                    let id = keys.join("|");
                    if let Some(texts) = dictionary.phrases.get(&id) {
                        matches.push((at, length, keys.len(), readings.join(" "), texts));
                    }
                    if !dictionary.prefixes.contains(&id) {
                        break;
                    }
                }
                for (at, length, syllables, reading, texts) in matches {
                    // Scores decrease with n. A 13th distinct value from this
                    // same state cannot enter a beam of 12 at this offset.
                    for (n, text) in texts.iter().take(12).enumerate() {
                        push(
                            &mut beams,
                            at,
                            &state,
                            Part {
                                raw: segment(&raw, i, at),
                                text: text.clone(),
                                lang: "TW".into(),
                                note: format!("{reading} · phrase dictionary"),
                                changes: Some(changes.clone()),
                                complete: Some(true),
                                ..Part::default()
                            },
                            (length * 2 + syllables) as f64
                                - n as f64 * 0.8
                                - if dictionary.expanded {
                                    (at - i).saturating_sub(length) as f64 * 2.0
                                } else {
                                    0.0
                                },
                            Some("TW"),
                        );
                    }
                }
                if let Some(syllable) = read_units(&raw, i) {
                    let values = if syllable.complete {
                        dictionary.singles.get(&syllable.key)
                    } else {
                        None
                    };
                    let mut note = zhuyin(&syllable.key);
                    note.push_str(if !syllable.complete {
                        " · waiting for tone"
                    } else if syllable.key.ends_with(' ') {
                        " · first tone"
                    } else {
                        " · tone entered"
                    });
                    if syllable.complete && values.is_none() {
                        note.push_str(" · outside demo dictionary");
                    }
                    let fallback = vec![zhuyin(&syllable.key)];
                    for (n, text) in values.unwrap_or(&fallback).iter().take(12).enumerate() {
                        let score = if values.is_some() {
                            syllable.key.len() as f64 * 2.0 - n as f64 * 0.8
                        } else {
                            syllable.slots.iter().filter(|s| !s.is_empty()).count() as f64 * 0.3
                        };
                        push(
                            &mut beams,
                            syllable.end,
                            &state,
                            Part {
                                raw: segment(&raw, i, syllable.end),
                                text: text.clone(),
                                lang: "TW".into(),
                                note: note.clone(),
                                slots: Some(syllable.slots.iter().map(|s| zhuyin(s)).collect()),
                                changes: Some(syllable.changes.clone()),
                                complete: Some(syllable.complete),
                                ..Part::default()
                            },
                            score
                                - if dictionary.expanded {
                                    (syllable.end - i).saturating_sub(syllable.key.len()) as f64
                                        * 2.0
                                } else {
                                    0.0
                                },
                            Some("TW"),
                        );
                    }
                }
            }
            let mut end = i;
            while end < raw.len()
                && raw[end] != b' ' as u16
                && !punctuation(raw[end], dictionary.expanded)
            {
                end += 1;
            }
            let token = segment(&raw, i, end);
            let roman = options.roman(&token).to_lowercase();
            let token_len = (end - i) as f64;
            // Period/comma/semicolon are also Zhuyin positions. Strip them
            // only inside Roman interpretations, never from the shared input.
            let spelling = if dictionary.expanded {
                roman.trim_end_matches(['.', ',', ';'])
            } else {
                &roman
            };
            let suffix = &roman[spelling.len()..];
            let spelling_len = utf16_len(spelling) as f64;
            let previous_language = state
                .parts
                .iter()
                .rev()
                .find(|p| p.lang != "space" && p.lang != "punct")
                .map(|p| p.lang.as_str());
            let transition = |lang: &str| {
                if dictionary.expanded && previous_language == Some(lang) {
                    0.75
                } else {
                    0.0
                }
            };
            let has_case = dictionary.expanded
                && options
                    .roman(&token)
                    .chars()
                    .any(|c| c.is_ascii_uppercase());
            // Context crosses up to three Latin islands, but never a hard
            // punctuation boundary. No unconditional particle bonus in English.
            let japanese_context = dictionary.expanded
                && state
                    .parts
                    .iter()
                    .rev()
                    .take_while(|p| p.lang != "punct")
                    .filter(|p| p.lang != "space")
                    .take(4)
                    .any(|p| {
                        let roman = options.roman(&p.raw).to_lowercase();
                        let word = roman.trim_end_matches(['.', ',', ';']);
                        p.lang == "JP"
                            && p.complete != Some(false)
                            && (word.len() > 2 || !is_particle(word))
                    });
            let particle = is_particle(spelling);
            let particle_bonus = if japanese_context && particle {
                3.0
            } else {
                0.0
            };
            // A possessive suffix is punctuation attached to a completed word,
            // not permission for arbitrary language switches inside a token.
            if dictionary.expanded
                && options.english
                && matches!(roman.as_str(), "'" | "’" | "'s" | "’s")
                && matches!(state.lang.as_deref(), Some("TW" | "JP"))
                && state
                    .parts
                    .last()
                    .is_some_and(|p| p.complete != Some(false))
            {
                push(
                    &mut beams,
                    end,
                    &state,
                    Part {
                        raw: token.clone(),
                        text: options.roman(&token),
                        lang: "EN".into(),
                        note: "Attached English possessive".into(),
                        ..Part::default()
                    },
                    0.0,
                    Some("EN"),
                );
            }
            if options.japanese
                && !token.is_empty()
                && (state.lang.is_none() || state.lang.as_deref() == Some("JP"))
            {
                if let Some(texts) = LEXICON.japanese.get(spelling) {
                    for (n, text) in texts.iter().enumerate() {
                        push(
                            &mut beams,
                            end,
                            &state,
                            Part {
                                raw: token.clone(),
                                text: format!("{text}{suffix}"),
                                lang: "JP".into(),
                                note: format!("{roman} → Japanese"),
                                ..Part::default()
                            },
                            spelling_len * 2.2 - n as f64 * 0.7 + transition("JP")
                                - if has_case { 2.0 } else { 0.0 },
                            Some("JP"),
                        );
                    }
                }
                if let Some(composition) =
                    compose_japanese(spelling, end < raw.len() || !suffix.is_empty())
                {
                    let resolved = if composition.pending == "n" {
                        format!("{}ん", composition.kana)
                    } else {
                        composition.text.clone()
                    };
                    let pending_len = utf16_len(&composition.pending) as f64;
                    let score = (spelling_len - pending_len) * 1.2
                        + pending_len
                            * if dictionary.expanded {
                                if composition.pending == "n" {
                                    0.4
                                } else {
                                    -1.0
                                }
                            } else {
                                0.2
                            };
                    for (script, penalty) in [("Hiragana", 0.0), ("Katakana", 0.2)] {
                        let convert = |text: &str| {
                            if script == "Katakana" {
                                to_katakana(text)
                            } else {
                                text.to_owned()
                            }
                        };
                        let wait = if composition.pending.is_empty() {
                            String::new()
                        } else {
                            format!(" · waiting for {}…", composition.pending)
                        };
                        push(
                            &mut beams,
                            end,
                            &state,
                            Part {
                                raw: token.clone(),
                                text: format!("{}{suffix}", convert(&composition.text)),
                                commit_text: Some(format!("{}{suffix}", convert(&resolved))),
                                lang: "JP".into(),
                                pending: Some(composition.pending.clone()),
                                complete: Some(composition.complete),
                                note: format!("{roman} → {script}{wait}"),
                                ..Part::default()
                            },
                            score - penalty + transition("JP") + particle_bonus
                                - if has_case { 2.0 } else { 0.0 }
                                - if dictionary.expanded {
                                    composition.explicit_small_kana as f64 * 1.5
                                } else {
                                    0.0
                                },
                            Some("JP"),
                        );
                    }
                }
            }
            if options.english
                && !token.is_empty()
                && (state.lang.is_none() || state.lang.as_deref() == Some("EN"))
            {
                let known = LEXICON.english.contains(spelling);
                let imported = dictionary
                    .expanded
                    .then(|| english_tier(spelling))
                    .flatten();
                let number_in_roman_context = !spelling.is_empty()
                    && spelling.chars().all(|c| c.is_ascii_digit())
                    && matches!(previous_language, Some("EN" | "JP"));
                push(
                    &mut beams,
                    end,
                    &state,
                    Part {
                        raw: token.clone(),
                        text: options.roman(&token),
                        lang: "EN".into(),
                        note: format!(
                            "{} · {}",
                            match options.layout {
                                Layout::Colemak => "Colemak",
                                Layout::Qwerty => "QWERTY",
                            },
                            if known {
                                "English dictionary"
                            } else if imported.is_some() {
                                "SCOWL / productive-prefix evidence"
                            } else {
                                "literal fallback"
                            }
                        ),
                        ..Part::default()
                    },
                    if known {
                        token_len * 2.0 + transition("EN")
                    } else if let Some(tier) = imported {
                        spelling_len
                            * if tier <= 35 {
                                1.8
                            } else if tier <= 50 {
                                1.5
                            } else {
                                1.3
                            }
                            + transition("EN")
                            + if has_case { 2.0 } else { 0.0 }
                    } else if dictionary.expanded && number_in_roman_context {
                        // In a Roman sentence, digits are stronger evidence
                        // for a number than a tone-completed Zhuyin syllable.
                        // Standalone and Chinese-context tone keys keep their
                        // normal competition.
                        spelling_len * 2.5
                    } else if dictionary.expanded
                        && spelling.chars().any(|c| c.is_ascii_alphabetic())
                        && spelling
                            .chars()
                            .all(|c| c.is_ascii_alphabetic() || "'-’".contains(c))
                    {
                        // Literal spelling is evidence too. A small continuity
                        // bonus helps unknown English after an English word,
                        // without requiring evaluation words in the lexicon.
                        spelling_len * 0.9 + transition("EN") + if has_case { 2.0 } else { 0.0 }
                    } else {
                        token_len * 0.1 - 2.0
                    },
                    Some("EN"),
                );
            }
        }
    }
    let mut result = beams.pop().unwrap();
    result.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut seen = HashSet::new();
    result.retain(|c| seen.insert(c.text.clone()));
    result.truncate(5);
    result
}
