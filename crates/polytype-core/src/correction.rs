//! Explicit correction choices over original UTF-16 raw-key spans.
use crate::{
    Candidate, DecodeOptions, Part,
    dictionary::{ChineseWord, Dictionary},
    japanese::{compose_with_convention, to_katakana},
    phonetic::{Syllable, read_units, utf16_len, zhuyin},
    search,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RawEdit {
    pub start: usize,
    pub end: usize,
    pub inserted: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct RebasedConstraints {
    pub constraints: Vec<Constraint>,
    pub removed: Vec<Constraint>,
    pub edit: RawEdit,
}

pub(crate) fn rebase(
    input: &str,
    next_input: &str,
    constraints: &[Constraint],
    options: &DecodeOptions,
    edit: Option<&RawEdit>,
    dictionary: &Dictionary,
) -> Result<RebasedConstraints, String> {
    if !dictionary.expanded {
        return Err("Segment correction is unavailable for the prototype profile".into());
    }
    let old = units(input)?;
    let next = units(next_input)?;
    let infer_origin = edit.is_none();
    let inferred;
    let edit = if let Some(edit) = edit {
        edit
    } else {
        let mut start = old.iter().zip(&next).take_while(|(a, b)| a == b).count();
        while !boundary(&old, start) || !boundary(&next, start) {
            start -= 1;
        }
        let mut suffix = old[start..]
            .iter()
            .rev()
            .zip(next[start..].iter().rev())
            .take_while(|(a, b)| a == b)
            .count();
        while !boundary(&old, old.len() - suffix) || !boundary(&next, next.len() - suffix) {
            suffix -= 1;
        }
        inferred = RawEdit {
            start,
            end: old.len() - suffix,
            inserted: String::from_utf16_lossy(&next[start..next.len() - suffix]),
        };
        &inferred
    };
    if edit.start > edit.end || !boundary(&old, edit.start) || !boundary(&old, edit.end) {
        return Err("Invalid raw edit range".into());
    }
    let inserted: Vec<_> = edit.inserted.encode_utf16().collect();
    let mut expected = old[..edit.start].to_vec();
    expected.extend(&inserted);
    expected.extend(&old[edit.end..]);
    if expected != next {
        return Err("Raw edit does not match the updated input".into());
    }
    let deleted = edit.end - edit.start;
    let delta = inserted.len() as isize - deleted as isize;
    // Unknown edit origins can be ambiguous in repeated text. Detect alternate
    // equally small splices and release only locks whose alignment can differ.
    let mut origins = vec![edit.start];
    if infer_origin && old != next {
        for start in 0..=old.len() - deleted {
            let end = start + deleted;
            let next_end = start + inserted.len();
            if next_end <= next.len()
                && boundary(&old, start)
                && boundary(&old, end)
                && boundary(&next, start)
                && boundary(&next, next_end)
                && old[..start] == next[..start]
                && old[end..] == next[next_end..]
            {
                origins.push(start);
            }
        }
        origins.sort_unstable();
    }
    let mut kept = Vec::new();
    let mut removed = Vec::new();
    let mut ordered = constraints.to_vec();
    ordered.sort_by_key(|c| c.start);
    let mut previous = 0;
    for constraint in ordered {
        range(&old, constraint.start, constraint.end)?;
        if constraint.start < previous {
            return Err("Correction constraints overlap".into());
        }
        previous = constraint.end;
        let overlap = old != next && edit.start < constraint.end && edit.end > constraint.start;
        let inside = old != next
            && deleted == 0
            && edit.start > constraint.start
            && edit.start < constraint.end;
        let ambiguous = old != next
            && origins[0] < constraint.end
            && origins[origins.len() - 1] > constraint.start;
        if overlap || inside || ambiguous {
            removed.push(constraint);
            continue;
        }
        let mut shifted = constraint.clone();
        if edit.end <= constraint.start {
            shifted.start = (constraint.start as isize + delta) as usize;
            shifted.end = (constraint.end as isize + delta) as usize;
        }
        if resolve(&next, &shifted, dictionary, options).is_ok() {
            kept.push(shifted);
        } else {
            removed.push(constraint);
        }
    }
    Ok(RebasedConstraints {
        constraints: kept,
        removed,
        edit: edit.clone(),
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub start: usize,
    pub end: usize,
    pub raw: String,
    pub text: Option<String>,
    pub lang: String,
    pub part_index: usize,
    pub locked: bool,
    pub splits: Vec<Span>,
    /// Chosen Chinese local score minus the best different finalized output.
    /// None for locks, other languages, or spans without a competitor.
    pub confidence_margin: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentView {
    pub input_length: usize,
    pub candidate: Option<Candidate>,
    pub segments: Vec<Segment>,
    pub units: Vec<Segment>,
    /// Exactly the ranges reachable by the correction UI, including merges.
    pub spans: Vec<Span>,
}

pub(crate) fn segments(
    input: &str,
    options: &DecodeOptions,
    constraints: &[Constraint],
    candidate_index: usize,
    dictionary: &Dictionary,
) -> Result<SegmentView, String> {
    if !dictionary.expanded {
        return Err("Segment correction is unavailable for the prototype profile".into());
    }
    let raw = units(input)?;
    let candidates = decode(input, constraints, dictionary, options)?;
    let candidate = if candidates.is_empty() && candidate_index == 0 {
        None
    } else {
        Some(
            candidates
                .get(candidate_index)
                .ok_or("Candidate index is out of range")?
                .clone(),
        )
    };
    let mut segments = Vec::new();
    let mut leaves = Vec::new();
    let mut spans = Vec::new();
    if let Some(candidate) = &candidate {
        let mut start = 0;
        let mut index = 0;
        while index < candidate.parts.len() {
            let first = &candidate.parts[index];
            let lock = constraints.iter().find(|c| c.start == start);
            let end = lock.map_or(start + utf16_len(&first.raw), |c| c.end);
            let mut text = String::new();
            let mut at = start;
            let owner = index;
            while index < candidate.parts.len() && at < end {
                let part = &candidate.parts[index];
                text.push_str(&part.text);
                at += utf16_len(&part.raw);
                index += 1;
            }
            if at != end {
                return Err("Candidate parts do not align with correction spans".into());
            }
            let paired = end == start + 1
                && search::punctuation_pair(raw[start], options.layout)
                    .is_some_and(|(ascii, full)| text == ascii || text == full);
            let lang = if paired {
                "punct".into()
            } else {
                lock.map_or_else(|| first.lang.clone(), |c| c.lang.clone())
            };
            let unpaired_punctuation = !paired && text.chars().all(|c| c.is_ascii_punctuation());
            let editable = lang != "space" && (lang != "punct" || paired) && !unpaired_punctuation;
            let split = if lang == "TW" && lock.is_none() {
                syllables(&raw, start, end)
                    .unwrap_or_default()
                    .into_iter()
                    .scan(start, |at, (end, _)| {
                        let span = Span { start: *at, end };
                        *at = end;
                        Some(span)
                    })
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            };
            let confidence_margin = if editable && lang == "TW" && lock.is_none() {
                let span = Span { start, end };
                let choice = Constraint {
                    start,
                    end,
                    text: text.clone(),
                    lang: lang.clone(),
                };
                chinese_path(&raw, &choice, dictionary)
                    .ok()
                    .and_then(|chosen| {
                        chinese_paths(&raw, span, dictionary)
                            .into_iter()
                            .filter(|path| path.text() != text)
                            .map(|path| path.score)
                            .max_by(f64::total_cmp)
                            .map(|runner_up| chosen.score - runner_up)
                    })
            } else {
                None
            };
            let segment = Segment {
                start,
                end,
                raw: range(&raw, start, end)?,
                text: Some(text),
                lang,
                part_index: owner,
                locked: lock.is_some(),
                splits: split.clone(),
                confidence_margin,
            };
            if editable {
                spans.push(Span { start, end });
                if split.len() > 1 {
                    for span in split {
                        spans.push(span);
                        leaves.push(Segment {
                            start: span.start,
                            end: span.end,
                            raw: range(&raw, span.start, span.end)?,
                            text: None,
                            confidence_margin: None,
                            splits: Vec::new(),
                            ..segment.clone()
                        });
                    }
                } else {
                    leaves.push(segment.clone());
                }
            }
            segments.push(segment);
            start = end;
        }
        if start != raw.len() {
            return Err("Candidate does not cover the complete raw buffer".into());
        }
    }
    for (index, unit) in leaves.iter().enumerate() {
        if unit.lang != "TW" || unit.locked {
            continue;
        }
        let mut end = unit.end;
        for next in leaves.iter().skip(index + 1).take(11) {
            if next.start != end || next.lang != "TW" || next.locked {
                break;
            }
            end = next.end;
            spans.push(Span {
                start: unit.start,
                end,
            });
        }
    }
    let mut seen = HashSet::new();
    spans.retain(|span| seen.insert(*span));
    Ok(SegmentView {
        input_length: raw.len(),
        candidate,
        segments,
        units: leaves,
        spans,
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Alternative {
    pub text: String,
    pub commit_text: String,
    pub lang: String,
    pub kind: String,
    pub parts: Vec<Part>,
    pub score: f64,
    pub constraint: Constraint,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlternativePage {
    pub start: usize,
    pub end: usize,
    pub raw: String,
    pub items: Vec<Alternative>,
    pub actions: Vec<Alternative>,
    pub truncated: bool,
    pub search_bounded: bool,
}

fn chinese_paths(raw: &[u16], span: Span, dictionary: &Dictionary) -> Vec<Path> {
    let Ok(syllables) = syllables(raw, span.start, span.end) else {
        return Vec::new();
    };
    let mut states = vec![Vec::new(); syllables.len() + 1];
    states[0].push(Path {
        parts: Vec::new(),
        score: 0.0,
    });
    let mut result = Vec::new();
    for index in 0..syllables.len() {
        let edges = chinese_edges(raw, span.start, &syllables, index, dictionary);
        for path in states[index].clone() {
            for (next, part, score) in &edges {
                let mut parts = path.parts.clone();
                parts.push(part.clone());
                let next_path = Path {
                    parts,
                    score: path.score + score,
                };
                if *next == syllables.len() {
                    result.push(next_path);
                } else {
                    let beam = &mut states[*next];
                    beam.push(next_path);
                    beam.sort_by(|a, b| b.score.total_cmp(&a.score));
                    let mut seen = HashSet::new();
                    beam.retain(|path| seen.insert(path.text()));
                    beam.truncate(12);
                }
            }
        }
    }
    result
}

fn alternative(path: Path, span: Span, lang: &str, kind: &str) -> Alternative {
    let commit_text = path.text();
    Alternative {
        text: path.parts.iter().map(|p| p.text.as_str()).collect(),
        commit_text: commit_text.clone(),
        lang: lang.into(),
        kind: kind.into(),
        parts: path.parts,
        score: path.score,
        constraint: Constraint {
            start: span.start,
            end: span.end,
            text: commit_text,
            lang: lang.into(),
        },
    }
}

pub(crate) fn alternatives(
    input: &str,
    options: &DecodeOptions,
    constraints: &[Constraint],
    candidate_index: usize,
    span: Span,
    dictionary: &Dictionary,
) -> Result<AlternativePage, String> {
    let view = segments(input, options, constraints, candidate_index, dictionary)?;
    if !view.spans.contains(&span) {
        return Err("Span is not an editable segment or Chinese syllable selection".into());
    }
    let raw = units(input)?;
    let text = range(&raw, span.start, span.end)?;
    if view
        .units
        .iter()
        .any(|unit| unit.start == span.start && unit.end == span.end && unit.lang == "punct")
    {
        let (ascii, full) = search::punctuation_pair(raw[span.start], options.layout).unwrap();
        let candidate = view.candidate.as_ref().unwrap();
        let mut end = 0;
        let previous = candidate
            .parts
            .iter()
            .take_while(|part| {
                end += utf16_len(&part.raw);
                end <= span.start
            })
            .filter(|part| part.lang != "space" && part.lang != "punct")
            .last();
        let chinese_context =
            previous.is_some_and(|part| search::converted_chinese(part, dictionary));
        let mut items = Vec::new();
        for choice in [full, ascii] {
            let constraint = Constraint {
                start: span.start,
                end: span.end,
                text: choice.into(),
                lang: "punct".into(),
            };
            let mut path = punctuation_path(&raw, &constraint, options)?;
            path.score = search::punctuation_score(choice == full, chinese_context);
            items.push(alternative(path, span, "punct", "punctuation"));
        }
        items.sort_by(|a, b| b.score.total_cmp(&a.score));
        return Ok(AlternativePage {
            start: span.start,
            end: span.end,
            raw: text,
            items,
            actions: Vec::new(),
            truncated: false,
            search_bounded: false,
        });
    }
    let mut items = Vec::new();
    let mut actions = Vec::new();
    if options.zhuyin {
        items.extend(
            chinese_paths(&raw, span, dictionary)
                .into_iter()
                .map(|path| alternative(path, span, "TW", "conversion")),
        );
    }
    if options.japanese {
        for path in japanese_paths(&raw, span.start, span.end, dictionary, options) {
            let note = &path.parts[0].note;
            let kind = if note.contains("→ Hiragana") {
                "hiragana"
            } else if note.contains("→ Katakana") {
                "katakana"
            } else {
                "conversion"
            };
            let item = alternative(path, span, "JP", kind);
            if kind == "conversion" {
                items.push(item);
            } else {
                actions.push(item);
            }
        }
    }
    if options.english
        && let Some(path) = english_path(&raw, span.start, span.end, dictionary, options)
    {
        actions.push(alternative(path, span, "EN", "english"));
    }
    if options.english || options.japanese || options.zhuyin {
        actions.push(alternative(
            Path {
                parts: vec![Part {
                    raw: text.clone(),
                    text: text.clone(),
                    lang: "RAW".into(),
                    note: "Explicit raw-key choice".into(),
                    ..Part::default()
                }],
                score: 0.0,
            },
            span,
            "RAW",
            "raw",
        ));
    }
    items.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut seen = HashSet::new();
    items.retain(|item| seen.insert((item.commit_text.clone(), item.lang.clone())));
    let truncated = items.len() > 9;
    items.truncate(9);
    Ok(AlternativePage {
        start: span.start,
        end: span.end,
        raw: text,
        items,
        actions,
        truncated,
        search_bounded: true,
    })
}
