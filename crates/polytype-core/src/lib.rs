//! Shared, local-only Polytype decoder. No browser or OS dependencies.
mod dictionary;
mod japanese;
mod phonetic;
mod search;

pub use dictionary::Entry;
use dictionary::{Dictionary, LEXICON, english_size, expanded_size, validate_entries};
pub use japanese::{Composition, compose_japanese, to_katakana};
pub use phonetic::{Syllable, colemak, encode, read_zhuyin, reading_keys, zhuyin};
pub use search::{Candidate, Part};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Layout {
    #[default]
    Colemak,
    Qwerty,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct DecodeOptions {
    pub layout: Layout,
    pub english: bool,
    pub japanese: bool,
    pub zhuyin: bool,
}

impl Default for DecodeOptions {
    fn default() -> Self {
        Self {
            layout: Layout::Colemak,
            english: true,
            japanese: true,
            zhuyin: true,
        }
    }
}

impl DecodeOptions {
    fn roman(&self, raw: &str) -> String {
        match self.layout {
            Layout::Colemak => colemak(raw),
            Layout::Qwerty => raw.to_owned(),
        }
    }
}

pub struct Engine {
    dictionary: Dictionary,
}

impl Default for Engine {
    fn default() -> Self {
        Self {
            dictionary: Dictionary::new(Vec::new(), true),
        }
    }
}

impl Engine {
    /// Frozen vocabulary profile for migration checks and evaluation baselines.
    pub fn prototype() -> Self {
        Self {
            dictionary: Dictionary::new(Vec::new(), false),
        }
    }
    pub fn decode(&self, raw: &str) -> Vec<Candidate> {
        self.decode_with_options(raw, &DecodeOptions::default())
    }

    pub fn decode_with_options(&self, raw: &str, options: &DecodeOptions) -> Vec<Candidate> {
        search::decode(raw, &self.dictionary, options)
    }

    /// Replace entries atomically. Validation never mutates the active dictionary.
    pub fn set_custom_entries(&mut self, entries: Vec<Entry>) -> Result<Vec<Entry>, String> {
        let entries = validate_entries(entries)?;
        self.dictionary = Dictionary::new(entries.clone(), self.dictionary.expanded);
        Ok(entries)
    }

    pub fn dictionary_size(&self) -> Value {
        let mut size = json!({"builtIn": LEXICON.chinese.len(), "imported": if self.dictionary.expanded { expanded_size() } else { 0 }, "custom": self.dictionary.custom.len()});
        if self.dictionary.expanded {
            size["englishImported"] = json!(english_size());
        }
        size
    }

    /// Versioned JSON transport shared by WASM and the native parity runner.
    /// Native Rust consumers can use the typed methods directly.
    pub fn request(&mut self, request: &str) -> Result<String, String> {
        let value: Value = serde_json::from_str(request).map_err(|e| e.to_string())?;
        if value["version"] != 1 {
            return Err("Unsupported Polytype protocol version".into());
        }
        let input = || {
            value["input"]
                .as_str()
                .ok_or_else(|| "Expected string input".to_owned())
        };
        let result = match value["op"].as_str().ok_or("Expected operation")? {
            "decode" => {
                let options = value
                    .get("options")
                    .map(|v| serde_json::from_value::<DecodeOptions>(v.clone()))
                    .transpose()
                    .map_err(|e| e.to_string())?
                    .unwrap_or_default();
                json!(self.decode_with_options(input()?, &options))
            }
            "colemak" => json!(colemak(input()?)),
            "encode" => json!(encode(input()?)),
            "zhuyin" => json!(zhuyin(input()?)),
            "readZhuyin" => json!(read_zhuyin(
                input()?,
                value["start"].as_u64().unwrap_or(0) as usize
            )),
            "readingKeys" => json!(reading_keys(
                value["input"]
                    .as_str()
                    .ok_or("請輸入注音讀音（最多 180 字元）。")?
            )?),
            "composeJapanese" => json!(compose_japanese(
                input()?,
                value["final"].as_bool().unwrap_or(false)
            )),
            "toKatakana" => json!(to_katakana(input()?)),
            "dictionarySize" => self.dictionary_size(),
            "setCustomEntries" => {
                let rows = value["entries"]
                    .as_array()
                    .filter(|a| a.len() <= 200)
                    .ok_or("最多可加入 200 筆自訂詞條。")?;
                let entries = rows
                    .iter()
                    .map(|row| {
                        Ok(Entry {
                            text: row["text"].as_str().ok_or("詞語請填 1–40 個字元。")?.into(),
                            reading: row["reading"]
                                .as_str()
                                .ok_or("請輸入注音讀音（最多 180 字元）。")?
                                .into(),
                        })
                    })
                    .collect::<Result<Vec<_>, String>>()?;
                json!(self.set_custom_entries(entries)?)
            }
            "commitCandidate" => {
                let candidate: Candidate = serde_json::from_value(value["candidate"].clone())
                    .map_err(|e| e.to_string())?;
                json!(candidate.commit_text())
            }
            _ => return Err("Unknown Polytype operation".into()),
        };
        serde_json::to_string(&result).map_err(|e| e.to_string())
    }
}
