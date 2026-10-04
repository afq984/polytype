use crate::phonetic::{reading_keys, utf16_len, whitespace};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::LazyLock,
};

#[derive(Deserialize)]
pub(crate) struct Lexicon {
    pub japanese: HashMap<String, Vec<String>>,
    pub english: HashSet<String>,
    pub chinese: Vec<(String, String)>,
}
pub(crate) static LEXICON: LazyLock<Lexicon> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/lexicon.json")).expect("valid bundled lexicon")
});

// The prototype bundled each word with its kana reading. Index that reading,
// not its demo romaji alias: all equivalent standard spellings share conversion.
static JAPANESE_READINGS: LazyLock<HashMap<String, Vec<String>>> = LazyLock::new(|| {
    let mut readings: HashMap<String, Vec<String>> = HashMap::new();
    let mut rows: Vec<_> = LEXICON.japanese.iter().collect();
    rows.sort_by_key(|(key, _)| *key);
    for (_, outputs) in rows {
        let reading = outputs
            .iter()
            .find(|text| {
                !text.is_empty()
                    && text
                        .chars()
                        .all(|c| ('ぁ'..='ゖ').contains(&c) || c == 'ー')
            })
            .expect("bundled Japanese word has a kana reading");
        let values = readings.entry(reading.clone()).or_default();
        for output in outputs {
            if !values.contains(output) {
                values.push(output.clone());
            }
        }
    }
    readings
});

// SCOWL coverage tiers, not probabilities; pinned source and notices accompany
// data/english.tsv. The frozen prototype does not consult this table.
static ENGLISH: LazyLock<HashMap<&'static str, u8>> = LazyLock::new(|| {
    include_str!("../../../data/english.tsv")
        .lines()
        .map(|line| {
            let (word, tier) = line.split_once('\t').expect("word and tier");
            (word, tier.parse().expect("valid SCOWL tier"))
        })
        .collect()
});

pub(crate) fn english_tier(word: &str) -> Option<u8> {
    ENGLISH.get(word).copied().or_else(|| {
        // Productive English prefixes supply weak evidence, not new entries.
        ["re", "un", "pre"].iter().find_map(|prefix| {
            word.strip_prefix(prefix)
                .filter(|stem| stem.len() >= 3)
                .and_then(|stem| ENGLISH.get(stem))
                .filter(|tier| **tier <= 35)
                .map(|_| 60)
        })
    })
}

pub(crate) fn english_size() -> usize {
    ENGLISH.len()
}

// Generated from pinned upstream inputs; see data/japanese-source.json. Rows
// are grouped by reading in ascending Mozc cost order; that order is the only
// ranking evidence taken from the upstream costs.
static JAPANESE_EXPANDED: LazyLock<HashMap<String, Vec<String>>> = LazyLock::new(|| {
    let mut readings: HashMap<String, Vec<String>> = HashMap::new();
    for line in include_str!("../../../data/japanese.tsv").lines() {
        let mut fields = line.split('\t');
        let reading = fields.next().expect("reading");
        let text = fields.next().expect("surface");
        readings
            .entry(reading.to_owned())
            .or_default()
            .push(text.to_owned());
    }
    // The prototype's hand-written words remain a fallback after imported
    // alternatives, so equivalent spellings keep sharing conversion.
    let mut fallback: Vec<_> = JAPANESE_READINGS.iter().collect();
    fallback.sort_by_key(|(reading, _)| (*reading).clone());
    for (reading, outputs) in fallback {
        let values = readings.entry(reading.clone()).or_default();
        for output in outputs {
            if !values.contains(output) {
                values.push(output.clone());
            }
        }
    }
    readings
});

pub(crate) fn japanese_size() -> usize {
    include_str!("../../../data/japanese.tsv").lines().count()
}

// Generated from pinned upstream inputs; see data/chinese-source.json.
static EXPANDED: LazyLock<Vec<(String, String, f64)>> = LazyLock::new(|| {
    include_str!("../../../data/chinese.tsv")
        .lines()
        .map(|line| {
            let mut fields = line.split('\t');
            (
                fields.next().unwrap().to_owned(),
                fields.next().unwrap().to_owned(),
                fields
                    .next()
                    .unwrap()
                    .parse::<f64>()
                    .expect("positive occurrence count")
                    .ln(),
            )
        })
        .collect()
});

pub(crate) fn expanded_size() -> usize {
    EXPANDED.len()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Entry {
    pub reading: String,
    pub text: String,
}

pub(crate) struct ChineseWord {
    pub text: String,
    // None denotes explicit user evidence, not a fabricated occurrence count.
    // Imported logs include a local offset when custom alternatives precede them.
    pub log_frequency: Option<f64>,
}

// Historical native ablations used the original 20k cut. Enlarging the default
// vocabulary must not silently change their frozen migration evidence.
#[cfg(feature = "diagnostics")]
pub(crate) static HISTORICAL: LazyLock<Dictionary> =
    LazyLock::new(|| Dictionary::with_phrase_limit(Vec::new(), true, 20_000));

#[cfg(feature = "diagnostics")]
static HISTORICAL_SINGLE_LOGS: LazyLock<HashMap<String, f64>> = LazyLock::new(|| {
    let source: serde_json::Value =
        serde_json::from_str(include_str!("../../../data/chinese-source.json")).unwrap();
    source["readingCounts"]["historicalSingleCounts"]
        .as_object()
        .expect("original single-character counts")
        .iter()
        .map(|(text, count)| (text.clone(), count.as_f64().unwrap().ln()))
        .collect()
});

pub(crate) struct Dictionary {
    pub expanded: bool,
    pub custom: Vec<Entry>,
    pub custom_english: Vec<String>,
    pub singles: HashMap<String, Vec<ChineseWord>>,
    pub phrases: HashMap<String, Vec<ChineseWord>>,
    pub prefixes: HashSet<String>,
    pub partial_syllables: HashSet<String>,
}

impl Dictionary {
    /// Modern lookup is keyed by a complete composed kana reading, so a
    /// trailing pending `n` still commits as kana until a boundary follows, as
    /// in Mozc before conversion. The frozen prototype keys demo words by spelling.
    pub(crate) fn japanese(
        &self,
        spelling: &str,
        composition: Option<&crate::japanese::Composition>,
        modern: bool,
    ) -> Option<&Vec<String>> {
        if modern {
            let composed = composition.filter(|c| c.complete)?;
            return JAPANESE_EXPANDED.get(&composed.kana);
        }
        LEXICON.japanese.get(spelling)
    }

    pub fn new(custom: Vec<Entry>, expanded: bool) -> Self {
        let mut dict = Self::with_phrase_limit(custom, expanded, usize::MAX);
        if expanded {
            for words in dict.singles.values_mut() {
                // Keep custom insertion priority; source row order stays frozen
                // for historical diagnostics, while current beam truncation
                // needs the strongest reading-conditioned alternatives first.
                let custom = words.partition_point(|word| word.log_frequency.is_none());
                words[custom..].sort_by(|a, b| {
                    b.log_frequency
                        .unwrap()
                        .total_cmp(&a.log_frequency.unwrap())
                });
            }
        }
        dict
    }

    pub(crate) fn with_phrase_limit(custom: Vec<Entry>, expanded: bool, limit: usize) -> Self {
        let mut dict = Self {
            expanded,
            custom,
            custom_english: Vec::new(),
            singles: HashMap::new(),
            phrases: HashMap::new(),
            prefixes: HashSet::new(),
            partial_syllables: HashSet::new(),
        };
        let mut phrases = 0;
        let rows = dict
            .custom
            .iter()
            .map(|e| (&e.reading, &e.text, None))
            .chain(
                EXPANDED
                    .iter()
                    .filter(|(r, _, _)| {
                        if !expanded {
                            return false;
                        }
                        if r.contains(' ') {
                            phrases += 1;
                            phrases <= limit
                        } else {
                            true
                        }
                    })
                    .map(|(r, t, f)| {
                        #[cfg(feature = "diagnostics")]
                        let f = if limit < usize::MAX {
                            HISTORICAL_SINGLE_LOGS.get(t).copied().unwrap_or(*f)
                        } else {
                            *f
                        };
                        #[cfg(not(feature = "diagnostics"))]
                        let f = *f;
                        (r, t, Some(f))
                    }),
            )
            .chain(LEXICON.chinese.iter().map(|(r, t)| (r, t, Some(0.0))));
        for (reading, text, log_frequency) in rows {
            let keys = reading_keys(reading).expect("validated dictionary reading");
            // Any subset of the three ordered slots is a valid typing prefix:
            // users can enter the slots in any physical-key order. Cache these
            // from actual readings rather than accepting impossible syllables.
            for key in &keys {
                let body = &key[..key.len() - 1];
                // The set is closed under subsets; a previously inserted body
                // already supplied all its prefixes. Most phrase readings recur.
                if dict.partial_syllables.contains(body) {
                    continue;
                }
                let body = body.as_bytes();
                for mask in 1..1 << body.len() {
                    let partial: String = body
                        .iter()
                        .enumerate()
                        .filter(|(index, _)| mask & (1 << index) != 0)
                        .map(|(_, unit)| *unit as char)
                        .collect();
                    dict.partial_syllables.insert(partial);
                }
            }
            let values = if keys.len() == 1 {
                dict.singles.entry(keys[0].clone()).or_default()
            } else {
                for length in 1..keys.len() {
                    dict.prefixes.insert(keys[..length].join("|"));
                }
                dict.phrases.entry(keys.join("|")).or_default()
            };
            if !values.iter().any(|word| word.text == *text) {
                // Keep every custom alternative ahead of imported homophones,
                // including a common single after five or more custom choices.
                // Express the old 0.8-per-custom rank offset in log units once;
                // the immutable source counts and ordinary engines are unchanged.
                let log_frequency = log_frequency.map(|log| {
                    let custom_count = values
                        .iter()
                        .take_while(|word| word.log_frequency.is_none())
                        .count();
                    log - custom_count as f64 * 0.8 / 0.7
                });
                values.push(ChineseWord {
                    text: text.clone(),
                    log_frequency,
                });
            }
        }
        dict
    }
}

pub fn validate_entries(entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
    if entries.len() > 200 {
        return Err("最多可加入 200 筆自訂詞條。".into());
    }
    entries
        .into_iter()
        .map(|e| {
            let text = e.text.trim_matches(whitespace);
            if text.is_empty() || utf16_len(&e.text) > 40 {
                return Err("詞語請填 1–40 個字元。".into());
            }
            reading_keys(&e.reading)?;
            Ok(Entry {
                reading: e.reading.trim_matches(whitespace).into(),
                text: text.into(),
            })
        })
        .collect()
}

/// Exact case-preserving spellings, independent of physical keyboard layout.
pub fn validate_english_entries(entries: Vec<String>) -> Result<Vec<String>, String> {
    if entries.len() > 200 {
        return Err("At most 200 custom English words".into());
    }
    let mut result = Vec::new();
    for word in entries {
        if word.is_empty()
            || word.len() > 40
            || !word.chars().any(|c| c.is_ascii_alphabetic())
            || !word
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "'-_".contains(c))
        {
            return Err("English words need 1–40 ASCII letters/digits, apostrophes, hyphens or underscores, including a letter".into());
        }
        if !result.contains(&word) {
            result.push(word);
        }
    }
    Ok(result)
}
