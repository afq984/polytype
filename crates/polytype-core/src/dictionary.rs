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
static EXPANDED: LazyLock<Vec<(String, String)>> = LazyLock::new(|| {
    include_str!("../../../data/chinese.tsv")
        .lines()
        .map(|line| {
            let mut fields = line.split('\t');
            (
                fields.next().unwrap().to_owned(),
                fields.next().unwrap().to_owned(),
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

pub(crate) struct Dictionary {
    pub expanded: bool,
    pub custom: Vec<Entry>,
    pub singles: HashMap<String, Vec<String>>,
    pub phrases: HashMap<String, Vec<String>>,
    pub prefixes: HashSet<String>,
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
        let mut dict = Self {
            expanded,
            custom,
            singles: HashMap::new(),
            phrases: HashMap::new(),
            prefixes: HashSet::new(),
        };
        let rows = dict
            .custom
            .iter()
            .map(|e| (&e.reading, &e.text))
            .chain(EXPANDED.iter().filter(|_| expanded).map(|(r, t)| (r, t)))
            .chain(LEXICON.chinese.iter().map(|(r, t)| (r, t)));
        for (reading, text) in rows {
            let keys = reading_keys(reading).expect("validated dictionary reading");
            let values = if keys.len() == 1 {
                dict.singles.entry(keys[0].clone()).or_default()
            } else {
                for length in 1..keys.len() {
                    dict.prefixes.insert(keys[..length].join("|"));
                }
                dict.phrases.entry(keys.join("|")).or_default()
            };
            if !values.contains(text) {
                values.push(text.clone());
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
