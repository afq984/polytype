use crate::{
    DecodeOptions, Layout,
    dictionary::{ChineseWord, Dictionary, LEXICON, english_tier},
    japanese::{compose_with_convention, to_katakana},
    phonetic::{read_units, utf16_len, zhuyin},
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::ops::Deref;

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
    /// Kana reading behind an imported Japanese conversion, so callers can
    /// compare outputs at the reading level without re-deriving it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading: Option<String>,
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

#[derive(Clone, Default)]
struct BeamEntry {
    candidate: Candidate,
    family: usize,
    protected: bool,
    // Commit text is part of candidate identity when distinct outcomes share a
    // display; it is computed once here instead of on every beam update.
    commit: Option<String>,
}

#[derive(Clone, Copy)]
struct Policy {
    diversity: bool,
    floor: bool,
    discards: bool,
    identifiers: bool,
    first_tone: bool,
    legacy_romaji: bool,
    chinese_punctuation: bool,
    frequency: bool,
    chinese_parentheses: bool,
    physical_keys: bool,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            diversity: true,
            floor: true,
            discards: false,
            identifiers: false,
            first_tone: false,
            legacy_romaji: false,
            chinese_punctuation: true,
            frequency: true,
            chinese_parentheses: true,
            physical_keys: true,
        }
    }
}

fn continuation_mask(lang: Option<&str>) -> u8 {
    match lang {
        Some("EN") => 1,
        Some("JP") => 2,
        Some("TW") => 4,
        _ => 7,
    }
}

fn protect_continuations(beam: &mut [BeamEntry], enabled: u8) {
    let mut missing = enabled;
    for entry in beam {
        let mask = continuation_mask(entry.lang.as_deref());
        entry.protected = mask & missing != 0;
        missing &= !mask;
    }
}

fn discard_cost(count: usize, stronger: bool) -> f64 {
    (count * 2
        + if stronger {
            count.saturating_sub(3) * 4
        } else {
            0
        }) as f64
}

// Expanded Chinese unigram evidence: 2 * normalized key units + 5.2 * syllables
// + 0.7 * ln(count / 40,000,000), then the existing discard penalty.
// The key/syllable evidence is independent of segmentation; summing the log
// terms scores phrase vs single-character paths as a unigram lattice. The
// fixed reference mass keeps coverage cuts comparable and adds a conservative
// word cost to the original reading-count mass (29,948,651), discouraging
// over-segmentation into common characters. The 5.2-point syllable offset
// centers a single with count ~24k on the old key evidence, preserving common
// Chinese/Latin competition while penalizing rare readings (count 23: -4.86).
// Logs are cached at dictionary construction. Uncounted prototype fallbacks
// use count 1; custom entries omit the prior and retain their local rank cost.
fn chinese_frequency(word: &ChineseWord, syllables: usize, rank: usize) -> f64 {
    let score = syllables as f64 * 5.2
        + word.log_frequency.map_or(-(rank as f64) * 0.8, |log| {
            0.7 * (log - 40_000_000_f64.ln())
        });
    // Native and WASM logarithms can differ in their final bits. Quantize each
    // edge before accumulation so equal reordered Chinese paths keep the same
    // stable tie order on both targets. This retains nine decimal score places.
    (score * 1e9).round() / 1e9
}

#[cfg(feature = "diagnostics")]
fn historical_dictionary(dictionary: &Dictionary) -> Option<Dictionary> {
    (dictionary.expanded && !dictionary.custom.is_empty())
        .then(|| Dictionary::with_phrase_limit(dictionary.custom.clone(), true, 20_000))
}

impl Deref for BeamEntry {
    type Target = Candidate;
    fn deref(&self) -> &Self::Target {
        &self.candidate
    }
}

#[derive(Hash, PartialEq, Eq, Serialize)]
struct FamilyKey {
    parent: usize,
    raw: String,
    lang: String,
    text: String,
    commit_text: Option<String>,
    pending: Option<String>,
    complete: Option<bool>,
}

fn fold_kana(text: &str) -> String {
    text.chars()
        .map(|c| {
            if ('\u{30a1}'..='\u{30f6}').contains(&c) {
                char::from_u32(c as u32 - 0x60).unwrap()
            } else {
                c
            }
        })
        .collect()
}

fn family_part(parent: usize, part: &Part) -> FamilyKey {
    let kana = part.lang == "JP" && part.pending.is_some();
    FamilyKey {
        parent,
        raw: part.raw.clone(),
        lang: part.lang.clone(),
        text: if kana {
            fold_kana(&part.text)
        } else {
            part.text.clone()
        },
        commit_text: part
            .commit_text
            .as_ref()
            .map(|text| if kana { fold_kana(text) } else { text.clone() }),
        pending: part.pending.clone(),
        complete: part.complete,
    }
}

struct Lattice {
    states: Vec<Vec<BeamEntry>>,
    width: usize,
    families: Option<HashMap<FamilyKey, usize>>,
    floor: u8,
    commit_identity: bool,
    mapped_punctuation: bool,
    chinese_parentheses: bool,
}

// A soft family cap: keep spare script variants when capacity permits, but
// evict them before a genuinely different path. Sorting still uses raw scores.
fn trim_families(beam: &mut Vec<BeamEntry>, limit: usize, cap: usize) {
    while beam.len() > limit {
        let remove = (0..beam.len())
            .rev()
            .find(|&i| {
                !beam[i].protected
                    && beam
                        .iter()
                        .filter(|c| c.family == beam[i].family)
                        .take(cap + 1)
                        .count()
                        > cap
            })
            .or_else(|| beam.iter().rposition(|entry| !entry.protected))
            .expect("beam limit must accommodate protected continuations");
        beam.remove(remove);
    }
}

fn push(
    beams: &mut Lattice,
    at: usize,
    state: &BeamEntry,
    part: Part,
    score: f64,
    lang: Option<&str>,
) {
    let family = if let Some(families) = &mut beams.families {
        // Only rule-generated kana variants are equivalent. Dictionary words,
        // raw segmentation, language history, pending state and commit behavior
        // remain distinct, including across spaces and punctuation.
        let key = family_part(state.family, &part);
        let next = families.len() + 1;
        *families.entry(key).or_insert(next)
    } else {
        0
    };
    let mut parts = state.parts.clone();
    let text = format!("{}{}", state.text, part.text);
    parts.push(part);
    let candidate = Candidate {
        text,
        score: state.score + score,
        lang: lang.map(str::to_owned),
        parts,
    };
    let beam = &mut beams.states[at];
    beam.push(BeamEntry {
        family,
        protected: false,
        commit: beams.commit_identity.then(|| candidate.commit_text()),
        candidate,
    });
    // Stable ordering matches JavaScript's stable sort, including tied scores.
    beam.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut seen = HashSet::new();
    let keep: Vec<bool> = beam
        .iter()
        .map(|entry| {
            seen.insert((
                entry.text.as_str(),
                entry.lang.as_deref(),
                entry.commit.as_deref(),
            ))
        })
        .collect();
    let mut index = 0;
    beam.retain(|_| {
        index += 1;
        keep[index - 1]
    });
    if beams.floor != 0 {
        protect_continuations(beam, beams.floor);
    }
    if beams.families.is_some() {
        trim_families(beam, beams.width, 2);
    } else if beams.floor != 0 {
        trim_families(beam, beams.width, beams.width);
    } else {
        beam.truncate(beams.width);
    }
}

fn punctuation(unit: u16, expanded: bool) -> bool {
    char::from_u32(unit as u32)
        .is_some_and(|c| "?!？！。，；：".contains(c) || (expanded && "():".contains(c)))
}

// McBopomofo BPMFPunctuations.txt at the revision in chinese-source.json.
// Standard overrides win over generic entries: apostrophe is 、, quote is ；.
// See docs/PUNCTUATION.md for source lines and the deliberately limited subset.
fn chinese_punctuation(unit: u16, parentheses: bool) -> Option<&'static str> {
    match char::from_u32(unit as u32)? {
        '<' => Some("，"),
        '>' => Some("。"),
        '?' => Some("？"),
        '!' => Some("！"),
        ':' => Some("："),
        '\'' => Some("、"),
        '"' => Some("；"),
        '[' => Some("「"),
        ']' => Some("」"),
        '{' => Some("『"),
        '}' => Some("』"),
        '(' if parentheses => Some("（"),
        ')' if parentheses => Some("）"),
        _ => None,
    }
}

// Tone completion alone is not a Chinese word. In particular, an unsupported
// reading of an English token must not gain a new punctuation/language boundary.
// Phrase parts have dictionary evidence; single parts retain slots even when
// they fall back to raw Zhuyin, so check their exact normalized dictionary key.
fn converted_chinese(part: &Part, dictionary: &Dictionary) -> bool {
    if part.lang != "TW" || part.complete != Some(true) {
        return false;
    }
    if part.slots.is_none() {
        return true;
    }
    let raw: Vec<u16> = part.raw.encode_utf16().collect();
    read_units(&raw, 0).is_some_and(|syllable| {
        dictionary
            .singles
            .get(&syllable.key)
            .is_some_and(|values| values.iter().any(|word| word.text == part.text))
    })
}

// Roman tokens keep their existing segmentation and exact ASCII scores. A
// trailing mapped key also has a weaker Chinese-punctuation interpretation.
// Checking rendered text avoids turning romaji n' or a possessive into a mark.
fn push_roman(
    beams: &mut Lattice,
    at: usize,
    state: &BeamEntry,
    part: Part,
    score: f64,
    lang: &str,
) {
    let alternative = if beams.mapped_punctuation {
        part.raw.chars().last().and_then(|key| {
            let full =
                chinese_punctuation(u16::try_from(key as u32).ok()?, beams.chinese_parentheses)?;
            part.text.strip_suffix(key)?;
            let mut alternative = part.clone();
            alternative.text = format!("{}{full}", part.text.strip_suffix(key)?);
            if let Some(commit) = &part.commit_text {
                alternative.commit_text = Some(format!("{}{full}", commit.strip_suffix(key)?));
            }
            if let Some(reading) = &part.reading {
                alternative.reading = Some(format!("{}{full}", reading.strip_suffix(key)?));
            }
            alternative
                .note
                .push_str(" · Chinese punctuation alternative");
            Some(alternative)
        })
    } else {
        None
    };
    push(beams, at, state, part, score, Some(lang));
    if let Some(part) = alternative {
        push(beams, at, state, part, score - 0.25, Some(lang));
    }
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
    decode_configured(input, dictionary, options, 12, 5, Policy::default())
}

fn decode_configured(
    input: &str,
    dictionary: &Dictionary,
    options: &DecodeOptions,
    width: usize,
    limit: usize,
    policy: Policy,
) -> Vec<Candidate> {
    let mut result = decode_lattice(input, dictionary, options, width, limit, policy);
    // A bounded mixed-language beam can discard every English path before a
    // later operator arrives. Reserve a slot for an independently decoded
    // literal-English path, even when phonetic scores crowd it out.
    if dictionary.expanded && options.english && (options.japanese || options.zhuyin) {
        let literal_options = DecodeOptions {
            japanese: false,
            zhuyin: false,
            ..options.clone()
        };
        if let Some(literal) =
            decode_lattice(input, dictionary, &literal_options, width, limit, policy)
                .into_iter()
                .next()
            && !result
                .iter()
                .any(|candidate| candidate.text == literal.text)
        {
            result.truncate(limit.saturating_sub(1));
            result.push(literal);
            result.sort_by(|a, b| b.score.total_cmp(&a.score));
        }
    }
    result
}

#[cfg(feature = "diagnostics")]
pub(crate) fn diagnose(
    input: &str,
    dictionary: &Dictionary,
    options: &DecodeOptions,
    width: usize,
    diversity: bool,
) -> serde_json::Value {
    let historical = (!diversity)
        .then(|| historical_dictionary(dictionary))
        .flatten();
    let dictionary = if !diversity && dictionary.expanded {
        historical
            .as_ref()
            .unwrap_or(&crate::dictionary::HISTORICAL)
    } else {
        dictionary
    };
    let policy = Policy {
        diversity,
        floor: diversity,
        legacy_romaji: !diversity,
        chinese_punctuation: diversity,
        frequency: diversity,
        chinese_parentheses: diversity,
        physical_keys: diversity,
        ..Policy::default()
    };
    let candidates = decode_configured(input, dictionary, options, width, 5, policy);
    let displayed_families = candidates
        .iter()
        .map(diagnostic_family)
        .collect::<HashSet<_>>()
        .len();
    serde_json::json!({
        "candidates": candidates,
        "displayedFamilies": displayed_families,
        "lattice": decode_lattice(input, dictionary, options, width, width, policy).iter().map(|c| {
            serde_json::json!({"text":c.commit_text(),"score":c.score,"family":diagnostic_family(c)})
        }).collect::<Vec<_>>(),
    })
}

#[cfg(feature = "diagnostics")]
pub(crate) fn experiment(
    input: &str,
    dictionary: &Dictionary,
    options: &DecodeOptions,
    name: &str,
) -> Result<Vec<Candidate>, String> {
    let current = name
        .split('+')
        .any(|flag| matches!(flag, "current" | "no-frequency"));
    let mut policy = if current {
        Policy::default()
    } else {
        Policy {
            floor: false,
            // These named ablations reproduce the frozen family-v1 experiment.
            legacy_romaji: true,
            chinese_punctuation: false,
            frequency: false,
            chinese_parentheses: false,
            physical_keys: false,
            ..Policy::default()
        }
    };
    for flag in name.split('+') {
        match flag {
            "baseline" => {}
            "floor" => policy.floor = true,
            "punctuation" => policy.chinese_punctuation = true,
            "parentheses" => policy.chinese_parentheses = true,
            "no-punctuation" => policy.chinese_punctuation = false,
            "no-parentheses" => policy.chinese_parentheses = false,
            "no-physical-keys" => policy.physical_keys = false,
            "discards" => policy.discards = true,
            "identifiers" => policy.identifiers = true,
            "first-tone" => policy.first_tone = true,
            "current" => {}
            "no-frequency" => policy.frequency = false,
            "frequency" => policy.frequency = true,
            _ => return Err("Unknown search experiment".into()),
        }
    }
    let historical = (!current)
        .then(|| historical_dictionary(dictionary))
        .flatten();
    let dictionary = if !current && dictionary.expanded {
        historical
            .as_ref()
            .unwrap_or(&crate::dictionary::HISTORICAL)
    } else {
        dictionary
    };
    Ok(decode_configured(input, dictionary, options, 12, 5, policy))
}

#[cfg(feature = "diagnostics")]
fn diagnostic_family(candidate: &Candidate) -> String {
    serde_json::to_string(
        &candidate
            .parts
            .iter()
            .map(|part| family_part(0, part))
            .collect::<Vec<_>>(),
    )
    .unwrap()
}

fn decode_lattice(
    input: &str,
    dictionary: &Dictionary,
    options: &DecodeOptions,
    width: usize,
    limit: usize,
    policy: Policy,
) -> Vec<Candidate> {
    if !options.english && !options.japanese && !options.zhuyin {
        return Vec::new();
    }
    let raw: Vec<u16> = input.encode_utf16().take(400).collect();
    let modern_romaji = dictionary.expanded && !policy.legacy_romaji;
    let mapped_punctuation = dictionary.expanded && policy.chinese_punctuation;
    let physical_keys = dictionary.expanded && policy.physical_keys;
    let roman = |value: &str| options.roman(value, physical_keys);
    let roman_colon = physical_keys && matches!(options.layout, Layout::Colemak);
    let is_punctuation = |unit| {
        if roman_colon && unit == b':' as u16 {
            false
        } else if roman_colon && unit == b'P' as u16 {
            true
        } else {
            punctuation(unit, dictionary.expanded)
        }
    };
    let mut beams = Lattice {
        states: vec![Vec::new(); raw.len() + 1],
        width,
        commit_identity: modern_romaji,
        mapped_punctuation,
        chinese_parentheses: policy.chinese_parentheses,
        families: (policy.diversity && dictionary.expanded && options.japanese).then(HashMap::new),
        floor: if policy.floor && dictionary.expanded {
            u8::from(options.english)
                | (u8::from(options.japanese) << 1)
                | (u8::from(options.zhuyin) << 2)
        } else {
            0
        },
    };
    beams.states[0].push(BeamEntry::default());
    for i in 0..raw.len() {
        for mut state in beams.states[i].clone() {
            // Diagnostic-only: consume first-tone Space once, without inserting
            // a literal output space or modifying the completed Chinese part.
            if policy.first_tone
                && dictionary.expanded
                && state.lang.as_deref() == Some("TW")
                && state
                    .parts
                    .last()
                    .is_some_and(|p| p.complete == Some(true) && p.raw.ends_with(' '))
            {
                state.candidate.lang = None;
            }
            let full = mapped_punctuation
                .then(|| {
                    chinese_punctuation(
                        if roman_colon && raw[i] == b'P' as u16 {
                            b':' as u16
                        } else {
                            raw[i]
                        },
                        policy.chinese_parentheses,
                    )
                })
                .flatten();
            let chinese_context = full.is_some()
                && state
                    .parts
                    .iter()
                    .rev()
                    .find(|p| p.lang != "space" && p.lang != "punct")
                    .is_some_and(|p| converted_chinese(p, dictionary));
            // Preserve the existing attached-English-possessive interpretation.
            let possessive = raw[i] == b'\'' as u16
                && raw
                    .get(i + 1)
                    .is_some_and(|&c| roman(&segment(&[c], 0, 1)) == "s")
                && (i + 2 == raw.len() || raw[i + 2] == b' ' as u16 || is_punctuation(raw[i + 2]));
            if is_punctuation(raw[i])
                || (mapped_punctuation
                    && ("、「」『』".contains(char::from_u32(raw[i] as u32).unwrap_or_default())
                        || (policy.chinese_parentheses
                            && "（）".contains(char::from_u32(raw[i] as u32).unwrap_or_default()))))
                || (chinese_context && full.is_some() && !possessive)
            {
                // Raw ':' still has the physical Zhuyin colon interpretation
                // after Chinese; its literal punctuation alternative stays ':'.
                let text = if roman_colon && raw[i] == b'P' as u16 {
                    ":".into()
                } else {
                    segment(&raw, i, i + 1)
                };
                for (text, score, note) in
                    std::iter::once((text.clone(), 0.0, "Literal punctuation")).chain(full.map(
                        |full| {
                            (
                                full.into(),
                                if chinese_context { 0.25 } else { -0.25 },
                                "Chinese punctuation",
                            )
                        },
                    ))
                {
                    push(
                        &mut beams,
                        i + 1,
                        &state,
                        Part {
                            raw: segment(&raw, i, i + 1),
                            text,
                            lang: "punct".into(),
                            note: note.into(),
                            ..Part::default()
                        },
                        score,
                        None,
                    );
                }
                // A standalone physical colon after Chinese keeps its default.
                // Following Roman letters may instead form an uppercase-O word
                // after a literal-space language boundary (e.g. Chinese + OK).
                let starts_roman_word = roman_colon
                    && raw[i] == b':' as u16
                    && raw.get(i + 1).is_some_and(|&unit| {
                        !is_punctuation(unit)
                            && (unit == b':' as u16
                                || unit == b'\'' as u16
                                || char::from_u32(unit as u32)
                                    .is_some_and(|c| c.is_ascii_alphabetic()))
                    });
                if !starts_roman_word {
                    continue;
                }
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
                let mut discard_penalty = 0.0;
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
                    discard_penalty += discard_cost(
                        (part.end - at).saturating_sub(part.key.len()),
                        policy.discards,
                    );
                    at = part.end;
                    length += part.key.len();
                    readings.push(zhuyin(&part.key));
                    changes.extend(part.changes);
                    keys.push(part.key);
                    let id = keys.join("|");
                    if let Some(texts) = dictionary.phrases.get(&id) {
                        matches.push((
                            at,
                            length,
                            keys.len(),
                            readings.join(" "),
                            texts,
                            discard_penalty,
                        ));
                    }
                    if !dictionary.prefixes.contains(&id) {
                        break;
                    }
                }
                for (at, length, syllables, reading, texts, discard_penalty) in matches {
                    // Imported counts decrease with n. Values beyond this beam width
                    // from the same state cannot survive at this offset.
                    for (n, word) in texts.iter().take(width).enumerate() {
                        push(
                            &mut beams,
                            at,
                            &state,
                            Part {
                                raw: segment(&raw, i, at),
                                text: word.text.clone(),
                                lang: "TW".into(),
                                note: format!("{reading} · phrase dictionary"),
                                changes: Some(changes.clone()),
                                complete: Some(true),
                                ..Part::default()
                            },
                            (length * 2) as f64
                                + if dictionary.expanded && policy.frequency {
                                    chinese_frequency(word, syllables, n)
                                } else {
                                    syllables as f64 - n as f64 * 0.8
                                }
                                - if dictionary.expanded {
                                    discard_penalty
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
                    let fallback = vec![ChineseWord {
                        text: zhuyin(&syllable.key),
                        log_frequency: Some(0.0),
                    }];
                    for (n, word) in values.unwrap_or(&fallback).iter().take(width).enumerate() {
                        let score = if values.is_some() {
                            syllable.key.len() as f64 * 2.0
                                + if dictionary.expanded && policy.frequency {
                                    chinese_frequency(word, 1, n)
                                } else {
                                    -(n as f64) * 0.8
                                }
                        } else {
                            syllable.slots.iter().filter(|s| !s.is_empty()).count() as f64 * 0.3
                        };
                        push(
                            &mut beams,
                            syllable.end,
                            &state,
                            Part {
                                raw: segment(&raw, i, syllable.end),
                                text: word.text.clone(),
                                lang: "TW".into(),
                                note: note.clone(),
                                slots: Some(syllable.slots.iter().map(|s| zhuyin(s)).collect()),
                                changes: Some(syllable.changes.clone()),
                                complete: Some(syllable.complete),
                                ..Part::default()
                            },
                            score
                                - if dictionary.expanded {
                                    discard_cost(
                                        (syllable.end - i).saturating_sub(syllable.key.len()),
                                        policy.discards,
                                    )
                                } else {
                                    0.0
                                },
                            Some("TW"),
                        );
                    }
                }
            }
            let mut end = i;
            while end < raw.len() && raw[end] != b' ' as u16 && !is_punctuation(raw[end]) {
                end += 1;
            }
            let token = segment(&raw, i, end);
            let roman_text = roman(&token);
            let roman = roman_text.to_lowercase();
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
            let has_case =
                dictionary.expanded && roman_text.chars().any(|c| c.is_ascii_uppercase());
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
                        let roman = options.roman(&p.raw, physical_keys).to_lowercase();
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
                        text: roman_text.clone(),
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
                let final_input = end < raw.len() || !suffix.is_empty();
                // One composition serves both the dictionary lookup and the kana path.
                let composition = compose_with_convention(spelling, final_input, modern_romaji);
                if let Some(texts) =
                    dictionary.japanese(spelling, composition.as_ref(), modern_romaji)
                {
                    let kana = composition
                        .as_ref()
                        .map(|c| c.kana.as_str())
                        .unwrap_or_default();
                    // Imported evidence stays below common English spelling
                    // evidence (1.8 per character through SCOWL tier 35) and
                    // above rule kana (1.2), so a large dictionary cannot claim
                    // ordinary English words; context bonuses decide the rest.
                    // Capitalization is Latin-script evidence: a capitalized
                    // token keeps only the rule-kana rate on top of the
                    // existing case penalty, so names such as Tanaka stay
                    // Latin. The frozen prototype keeps its demo-word rate.
                    let rate = if !modern_romaji {
                        2.2
                    } else if has_case {
                        1.2
                    } else {
                        1.45
                    };
                    for (n, text) in texts.iter().take(width).enumerate() {
                        push_roman(
                            &mut beams,
                            end,
                            &state,
                            Part {
                                raw: token.clone(),
                                text: format!("{text}{suffix}"),
                                lang: "JP".into(),
                                note: if modern_romaji {
                                    format!("{roman} · {kana} → Japanese")
                                } else {
                                    format!("{roman} → Japanese")
                                },
                                reading: modern_romaji.then(|| format!("{kana}{suffix}")),
                                ..Part::default()
                            },
                            spelling_len * rate - n as f64 * 0.7 + transition("JP")
                                - if has_case { 2.0 } else { 0.0 },
                            "JP",
                        );
                    }
                }
                if let Some(composition) = composition {
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
                        push_roman(
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
                            "JP",
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
                push_roman(
                    &mut beams,
                    end,
                    &state,
                    Part {
                        raw: token.clone(),
                        text: roman_text.clone(),
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
                    } else if policy.identifiers
                        && dictionary.expanded
                        && spelling.chars().any(|c| c.is_ascii_alphabetic())
                        && spelling.chars().any(|c| c.is_ascii_digit())
                        && spelling.chars().all(|c| c.is_ascii_alphanumeric())
                        && read_units(&raw, i).is_some_and(|s| !s.changes.is_empty())
                    {
                        spelling_len * 0.9 + transition("EN")
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
                    "EN",
                );
            }
        }
    }
    let mut result = beams.states.pop().unwrap();
    for entry in &mut result {
        entry.protected = false;
    }
    result.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut seen = HashSet::new();
    result.retain(|c| seen.insert((c.text.clone(), modern_romaji.then(|| c.commit_text()))));
    if beams.families.is_some() {
        trim_families(&mut result, limit, 1);
    } else {
        result.truncate(limit);
    }
    result.into_iter().map(|entry| entry.candidate).collect()
}

#[cfg(test)]
mod diversity_tests {
    use super::*;

    #[test]
    fn retention_preserves_continuations_within_the_same_budget() {
        let entry = |lang: Option<&str>, family| BeamEntry {
            candidate: Candidate {
                lang: lang.map(str::to_owned),
                ..Candidate::default()
            },
            family,
            ..BeamEntry::default()
        };
        let mut beam = vec![
            entry(Some("TW"), 1),
            entry(Some("TW"), 2),
            entry(Some("TW"), 3),
            entry(Some("EN"), 4),
            entry(Some("JP"), 5),
        ];
        protect_continuations(&mut beam, 7);
        trim_families(&mut beam, 3, 2);
        assert_eq!(beam.len(), 3);
        assert_eq!(
            beam.iter().map(|c| c.lang.as_deref()).collect::<Vec<_>>(),
            [Some("TW"), Some("EN"), Some("JP")]
        );
        let mut beam = vec![entry(None, 1), entry(Some("TW"), 2), entry(Some("EN"), 3)];
        protect_continuations(&mut beam, 7);
        assert_eq!(beam.iter().filter(|c| c.protected).count(), 1);
        protect_continuations(&mut beam, 0);
        assert!(beam.iter().all(|c| !c.protected));
    }

    #[test]
    fn discard_experiment_is_per_syllable_and_preserves_small_corrections() {
        for n in 0..=3 {
            assert_eq!(discard_cost(n, true), discard_cost(n, false));
        }
        assert_eq!(discard_cost(4, true), 12.0);
        assert_eq!(discard_cost(2, true) + discard_cost(2, true), 8.0);
    }

    #[test]
    fn spare_variants_survive_but_do_not_evict_distinct_families() {
        let mut beam = vec![
            BeamEntry {
                family: 1,
                ..BeamEntry::default()
            },
            BeamEntry {
                family: 1,
                ..BeamEntry::default()
            },
            BeamEntry {
                family: 1,
                ..BeamEntry::default()
            },
            BeamEntry {
                family: 2,
                ..BeamEntry::default()
            },
        ];
        trim_families(&mut beam, 4, 1);
        assert_eq!(beam.len(), 4);
        trim_families(&mut beam, 3, 2);
        assert_eq!(beam.iter().map(|e| e.family).collect::<Vec<_>>(), [1, 1, 2]);
        trim_families(&mut beam, 2, 1);
        assert_eq!(beam.iter().map(|e| e.family).collect::<Vec<_>>(), [1, 2]);
    }

    #[test]
    fn families_preserve_history_boundaries_and_commit_state() {
        let hira = Part {
            raw: "kan".into(),
            text: "かn".into(),
            lang: "JP".into(),
            pending: Some("n".into()),
            commit_text: Some("かん".into()),
            complete: Some(false),
            ..Part::default()
        };
        let kata = Part {
            text: "カn".into(),
            commit_text: Some("カン".into()),
            ..hira.clone()
        };
        assert!(family_part(1, &hira) == family_part(1, &kata));
        assert!(family_part(1, &hira) != family_part(2, &kata));
        for changed in [
            Part {
                raw: "kan ".into(),
                ..kata.clone()
            },
            Part {
                complete: Some(true),
                ..kata.clone()
            },
            Part {
                commit_text: Some("カ".into()),
                ..kata.clone()
            },
            Part {
                pending: None,
                ..kata.clone()
            },
            Part {
                lang: "EN".into(),
                ..kata
            },
        ] {
            assert!(family_part(1, &hira) != family_part(1, &changed));
        }
    }
}
