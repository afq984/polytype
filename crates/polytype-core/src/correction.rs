//! Explicit correction choices over original UTF-16 raw-key spans.
use crate::{
    Candidate, DecodeOptions, Part,
    dictionary::{ChineseWord, Dictionary},
    japanese::{compose_with_convention, to_katakana},
    phonetic::{Syllable, read_units, utf16_len, zhuyin},
    search,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Constraint {
    pub start: usize,
    pub end: usize,
    /// Finalized output, rather than a candidate's provisional display.
    pub text: String,
    pub lang: String,
}

#[derive(Clone)]
pub(crate) struct Resolved {
    pub constraint: Constraint,
    pub parts: Vec<Part>,
    pub score: f64,
}

pub(crate) struct Plan {
    pub locks: Vec<Resolved>,
    starts: Vec<Option<usize>>,
    next: Vec<usize>,
}

pub(crate) fn units(input: &str) -> Result<Vec<u16>, String> {
    let raw: Vec<u16> = input.encode_utf16().collect();
    if raw.len() > 400 {
        return Err("Correction input must be at most 400 UTF-16 units".into());
    }
    Ok(raw)
}

pub(crate) fn boundary(raw: &[u16], at: usize) -> bool {
    at <= raw.len()
        && !(at > 0
            && at < raw.len()
            && (0xd800..=0xdbff).contains(&raw[at - 1])
            && (0xdc00..=0xdfff).contains(&raw[at]))
}

pub(crate) fn range(raw: &[u16], start: usize, end: usize) -> Result<String, String> {
    if start >= end || !boundary(raw, start) || !boundary(raw, end) {
        return Err("Expected a nonempty scalar-aligned correction span".into());
    }
    Ok(String::from_utf16_lossy(&raw[start..end]))
}

pub(crate) fn separator(unit: u16, options: &DecodeOptions) -> bool {
    unit == b' ' as u16 || search::roman_punctuation(unit, true, true, options.layout)
}

fn roman_span(raw: &[u16], start: usize, end: usize, options: &DecodeOptions) -> bool {
    // Mapped keys can start a token after converted Chinese. Source validation
    // allows that boundary; the lattice still requires the contextual punctuation
    // edge, so unsupported Zhuyin cannot gain a new language switch here.
    let boundary = |unit| {
        separator(unit, options)
            || char::from_u32(unit as u32).is_some_and(|c| "<>\"'[]{}、「」『』（）:".contains(c))
    };
    (start == 0 || boundary(raw[start - 1])) && (end == raw.len() || separator(raw[end], options))
}

pub(crate) fn syllables(
    raw: &[u16],
    start: usize,
    end: usize,
) -> Result<Vec<(usize, Syllable)>, String> {
    let mut result = Vec::new();
    let mut at = start;
    while at < end {
        let syllable = read_units(raw, at)
            .filter(|s| s.end <= end)
            .ok_or("Span does not contain complete raw Zhuyin units")?;
        at = syllable.end;
        result.push((at, syllable));
        if result.len() > 12 {
            return Err("A Chinese correction span may contain at most 12 syllables".into());
        }
    }
    Ok(result)
}

#[derive(Clone)]
pub(crate) struct Path {
    pub parts: Vec<Part>,
    pub score: f64,
}

impl Path {
    pub fn text(&self) -> String {
        self.parts
            .iter()
            .map(|p| p.commit_text.as_deref().unwrap_or(&p.text))
            .collect()
    }
}

// Local source enumeration is independent of the menu cap. Scores come from
// the same helpers as ordinary search, including frequency and discard costs.
pub(crate) fn chinese_edges(
    raw: &[u16],
    start: usize,
    syllables: &[(usize, Syllable)],
    index: usize,
    dictionary: &Dictionary,
) -> Vec<(usize, Part, f64)> {
    let mut edges = Vec::new();
    let begin = if index == 0 {
        start
    } else {
        syllables[index - 1].0
    };
    let (_, syllable) = &syllables[index];
    let values = syllable
        .complete
        .then(|| dictionary.singles.get(&syllable.key))
        .flatten();
    let fallback = vec![ChineseWord {
        text: search::chinese_fallback_text(syllable, dictionary.expanded && values.is_none()).0,
        log_frequency: Some(0.0),
    }];
    for (rank, word) in values.unwrap_or(&fallback).iter().enumerate() {
        let score = search::chinese_single_score(
            syllable,
            word,
            rank,
            values.is_some(),
            dictionary.expanded,
        ) - search::discard_cost(
            (syllable.end - begin).saturating_sub(utf16_len(&syllable.key)),
            false,
        );
        edges.push((
            index + 1,
            Part {
                raw: String::from_utf16_lossy(&raw[begin..syllable.end]),
                text: word.text.clone(),
                lang: "TW".into(),
                note: format!("{} · segment choice", zhuyin(&syllable.key)),
                slots: Some(syllable.slots.iter().map(|s| zhuyin(s)).collect()),
                changes: Some(syllable.changes.clone()),
                complete: Some(syllable.complete),
                ..Part::default()
            },
            score,
        ));
    }
    let mut keys = Vec::new();
    let mut length = 0;
    let mut penalty = 0.0;
    let mut changes = Vec::new();
    let mut previous = begin;
    for (offset, (end, syllable)) in syllables.iter().enumerate().skip(index) {
        if !syllable.complete {
            break;
        }
        keys.push(syllable.key.clone());
        length += utf16_len(&syllable.key);
        penalty += search::discard_cost(
            (end - previous).saturating_sub(utf16_len(&syllable.key)),
            false,
        );
        previous = *end;
        changes.extend(syllable.changes.clone());
        let id = keys.join("|");
        if let Some(values) = dictionary.phrases.get(&id) {
            for (rank, word) in values.iter().enumerate() {
                edges.push((
                    offset + 1,
                    Part {
                        raw: String::from_utf16_lossy(&raw[begin..*end]),
                        text: word.text.clone(),
                        lang: "TW".into(),
                        note: format!(
                            "{} · phrase segment choice",
                            keys.iter().map(|k| zhuyin(k)).collect::<Vec<_>>().join(" ")
                        ),
                        complete: Some(true),
                        changes: Some(changes.clone()),
                        ..Part::default()
                    },
                    search::chinese_phrase_score(
                        length,
                        keys.len(),
                        word,
                        rank,
                        dictionary.expanded,
                    ) - penalty,
                ));
            }
        }
        if !dictionary.prefixes.contains(&id) {
            break;
        }
    }
    edges
}

fn chinese_path(
    raw: &[u16],
    constraint: &Constraint,
    dictionary: &Dictionary,
) -> Result<Path, String> {
    let syllables = syllables(raw, constraint.start, constraint.end)?;
    // Target-directed source validation is independent of the menu/beam cap.
    let mut states = BTreeMap::from([(
        (0, 0),
        Path {
            parts: Vec::new(),
            score: 0.0,
        },
    )]);
    for index in 0..syllables.len() {
        let edges = chinese_edges(raw, constraint.start, &syllables, index, dictionary);
        let current: Vec<_> = states
            .iter()
            .filter(|((at, _), _)| *at == index)
            .map(|(key, value)| (*key, value.clone()))
            .collect();
        for ((_, matched), path) in current {
            for (next, part, score) in &edges {
                if !constraint.text[matched..].starts_with(&part.text) {
                    continue;
                }
                let key = (*next, matched + part.text.len());
                let score = path.score + score;
                if states.get(&key).is_none_or(|old| score > old.score) {
                    let mut parts = path.parts.clone();
                    parts.push(part.clone());
                    states.insert(key, Path { parts, score });
                }
            }
        }
    }
    states
        .remove(&(syllables.len(), constraint.text.len()))
        .ok_or_else(|| "Chinese choice is not reachable for this raw span".into())
}

// Japanese dictionary/rule/script scoring is shared with ordinary search too.
pub(crate) fn japanese_paths(
    raw: &[u16],
    start: usize,
    end: usize,
    dictionary: &Dictionary,
    options: &DecodeOptions,
) -> Vec<Path> {
    if !roman_span(raw, start, end, options) {
        return Vec::new();
    }
    let token = String::from_utf16_lossy(&raw[start..end]);
    if token.is_empty()
        || token
            .chars()
            .any(|c| c == ' ' || separator(c as u16, options))
    {
        return Vec::new();
    }
    let mapped = options.roman(&token, dictionary.expanded);
    let roman = mapped.to_lowercase();
    let spelling = roman.trim_end_matches(['.', ',', ';']);
    let suffix = &roman[spelling.len()..];
    let composition =
        compose_with_convention(spelling, end < raw.len() || !suffix.is_empty(), true);
    let mut paths = Vec::new();
    let has_case = mapped.chars().any(|c| c.is_ascii_uppercase());
    if let Some(texts) = dictionary.japanese(spelling, composition.as_ref(), true) {
        let kana = &composition.as_ref().unwrap().kana;
        for (rank, text) in texts.iter().enumerate() {
            paths.push(Path {
                parts: vec![Part {
                    raw: token.clone(),
                    text: format!("{text}{suffix}"),
                    lang: "JP".into(),
                    note: format!("{roman} · {kana} → Japanese segment choice"),
                    reading: Some(format!("{kana}{suffix}")),
                    ..Part::default()
                }],
                score: search::japanese_dictionary_score(
                    utf16_len(spelling) as f64,
                    rank,
                    has_case,
                    true,
                    0.0,
                ),
            });
        }
    }
    if let Some(composition) = composition {
        let resolved = if composition.pending == "n" {
            format!("{}ん", composition.kana)
        } else {
            composition.text.clone()
        };
        let score = search::japanese_rule_score(
            utf16_len(spelling) as f64,
            &composition,
            dictionary.expanded,
        );
        for script in ["Hiragana", "Katakana"] {
            let convert = |text: &str| {
                if script == "Katakana" {
                    to_katakana(text)
                } else {
                    text.to_owned()
                }
            };
            paths.push(Path {
                parts: vec![Part {
                    raw: token.clone(),
                    text: format!("{}{suffix}", convert(&composition.text)),
                    commit_text: Some(format!("{}{suffix}", convert(&resolved))),
                    lang: "JP".into(),
                    note: format!("{roman} → {script} segment choice"),
                    pending: Some(composition.pending.clone()),
                    complete: Some(composition.complete),
                    ..Part::default()
                }],
                score: search::japanese_script_score(
                    score,
                    script,
                    0.0,
                    0.0,
                    has_case,
                    composition.explicit_small_kana,
                    dictionary.expanded,
                ),
            });
        }
    }
    paths
}

pub(crate) fn english_path(
    raw: &[u16],
    start: usize,
    end: usize,
    dictionary: &Dictionary,
    options: &DecodeOptions,
) -> Option<Path> {
    if !roman_span(raw, start, end, options) {
        return None;
    }
    let input = String::from_utf16_lossy(&raw[start..end]);
    let roman_options = DecodeOptions {
        japanese: false,
        zhuyin: false,
        ..options.clone()
    };
    search::decode(&input, dictionary, &roman_options)
        .into_iter()
        .next()
        .map(|candidate| Path {
            parts: candidate.parts,
            score: candidate.score,
        })
}

pub(crate) fn punctuation_path(
    raw: &[u16],
    constraint: &Constraint,
    options: &DecodeOptions,
) -> Result<Path, String> {
    if constraint.end != constraint.start + 1 {
        return Err("Paired punctuation occupies one raw unit".into());
    }
    let (ascii, full) = search::punctuation_pair(raw[constraint.start], options.layout)
        .ok_or("Punctuation has no full-width/ASCII pair")?;
    if constraint.text != ascii && constraint.text != full {
        return Err("Punctuation choice must be one of the mapped pair".into());
    }
    Ok(Path {
        parts: vec![Part {
            raw: range(raw, constraint.start, constraint.end)?,
            text: constraint.text.clone(),
            lang: "punct".into(),
            note: "Explicit paired punctuation choice".into(),
            ..Part::default()
        }],
        score: search::punctuation_score(constraint.text == full, false),
    })
}

pub(crate) fn resolve(
    raw: &[u16],
    constraint: &Constraint,
    dictionary: &Dictionary,
    options: &DecodeOptions,
) -> Result<Resolved, String> {
    let input = range(raw, constraint.start, constraint.end)?;
    let enabled = match constraint.lang.as_str() {
        "TW" => options.zhuyin,
        "JP" => options.japanese,
        "EN" => options.english,
        "RAW" | "punct" => options.english || options.japanese || options.zhuyin,
        _ => return Err("Unknown constraint language".into()),
    };
    if !enabled {
        return Err("Constraint language is disabled".into());
    }
    let mut path = match constraint.lang.as_str() {
        "TW" => chinese_path(raw, constraint, dictionary)?,
        "punct" => punctuation_path(raw, constraint, options)?,
        "JP" => japanese_paths(raw, constraint.start, constraint.end, dictionary, options)
            .into_iter()
            .find(|path| path.text() == constraint.text)
            .ok_or("Japanese choice is not reachable for this raw span")?,
        "EN" => english_path(raw, constraint.start, constraint.end, dictionary, options)
            .filter(|path| path.text() == constraint.text)
            .ok_or("English choice is not reachable for this raw span")?,
        _ => {
            if constraint.text != input {
                return Err("Raw choice must preserve the exact physical keys".into());
            }
            Path {
                parts: vec![Part {
                    raw: input.clone(),
                    text: input,
                    lang: "RAW".into(),
                    note: "Explicit raw-key choice".into(),
                    ..Part::default()
                }],
                score: 0.0,
            }
        }
    };
    for part in &mut path.parts {
        if let Some(text) = &part.commit_text {
            part.text = text.clone();
        }
        if part.lang == "JP" && part.pending.is_some() {
            part.pending = Some(String::new());
            part.complete = Some(true);
        }
    }
    Ok(Resolved {
        constraint: constraint.clone(),
        parts: path.parts,
        score: path.score,
    })
}

impl Plan {
    pub fn prepare(
        input: &str,
        constraints: &[Constraint],
        dictionary: &Dictionary,
        options: &DecodeOptions,
    ) -> Result<Self, String> {
        if !dictionary.expanded {
            return Err("Segment correction is unavailable for the prototype profile".into());
        }
        let raw = units(input)?;
        let mut constraints = constraints.to_vec();
        constraints.sort_by_key(|c| c.start);
        let mut locks = Vec::new();
        let mut previous = 0;
        for constraint in constraints {
            if constraint.start < previous {
                return Err("Correction constraints overlap".into());
            }
            let resolved = resolve(&raw, &constraint, dictionary, options)?;
            previous = constraint.end;
            locks.push(resolved);
        }
        let mut starts = vec![None; raw.len() + 1];
        let mut next = vec![raw.len() + 1; raw.len() + 1];
        for (index, lock) in locks.iter().enumerate() {
            starts[lock.constraint.start] = Some(index);
            next[lock.constraint.start..lock.constraint.end].fill(lock.constraint.start);
        }
        let mut upcoming = raw.len() + 1;
        for at in (0..=raw.len()).rev() {
            if starts[at].is_some() {
                upcoming = at;
            }
            if next[at] > raw.len() {
                next[at] = upcoming;
            }
        }
        Ok(Self {
            locks,
            starts,
            next,
        })
    }

    pub fn at(&self, start: usize) -> Option<&Resolved> {
        self.starts[start].map(|index| &self.locks[index])
    }
    pub fn allows(&self, start: usize, end: usize) -> bool {
        end <= self.next[start]
    }
}

pub(crate) fn decode(
    input: &str,
    constraints: &[Constraint],
    dictionary: &Dictionary,
    options: &DecodeOptions,
) -> Result<Vec<Candidate>, String> {
    if constraints.is_empty() {
        return Ok(search::decode(input, dictionary, options));
    }
    let plan = Plan::prepare(input, constraints, dictionary, options)?;
    Ok(search::decode_constrained(
        input, dictionary, options, &plan,
    ))
}
