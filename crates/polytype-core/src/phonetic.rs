use serde::{Deserialize, Serialize};

const ZKEYS: &str = "1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-";
const ZVALS: &str = "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ";
const QWERTY: &str = "qwertyuiopasdfghjkl;zxcvbnm";
const COLEMAK: &str = "qwfpgjluy;arstdhneiozxcvbkm";

pub fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

pub fn colemak(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            QWERTY.find(c.to_ascii_lowercase()).map_or(c, |index| {
                let mapped = COLEMAK.as_bytes()[index] as char;
                if c.is_ascii_uppercase() {
                    mapped.to_ascii_uppercase()
                } else {
                    mapped
                }
            })
        })
        .collect()
}

pub fn encode(value: &str) -> String {
    value
        .chars()
        .map(|c| COLEMAK.find(c).map_or(c, |i| QWERTY.as_bytes()[i] as char))
        .collect()
}

pub fn zhuyin(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '6' => 'ˊ',
            '3' => 'ˇ',
            '4' => 'ˋ',
            '7' => '˙',
            ' ' => 'ˉ',
            _ => ZKEYS
                .find(c)
                .and_then(|i| ZVALS.chars().nth(i))
                .unwrap_or(c),
        })
        .collect()
}

fn category(index: usize) -> usize {
    if index < 21 {
        0
    } else if index < 24 {
        1
    } else {
        2
    }
}

// ECMAScript whitespace, also used for custom-entry normalization.
pub fn whitespace(c: char) -> bool {
    (c.is_whitespace() && c != '\u{0085}') || c == '\u{feff}'
}

pub fn reading_keys(reading: &str) -> Result<Vec<String>, String> {
    if utf16_len(reading) > 180 {
        return Err("請輸入注音讀音（最多 180 字元）。".into());
    }
    let syllables: Vec<&str> = reading
        .split(whitespace)
        .filter(|s| !s.is_empty())
        .collect();
    if syllables.is_empty() || syllables.len() > 12 {
        return Err("請輸入 1–12 個音節，以空格分隔。".into());
    }
    syllables
        .into_iter()
        .map(|syllable| {
            let mut tone = ' ';
            let mut body: Vec<char> = syllable.chars().collect();
            if body.first() == Some(&'˙') {
                tone = '7';
                body.remove(0);
            }
            if let Some(last) = body.last() {
                let key = match last {
                    'ˊ' => Some('6'),
                    'ˇ' => Some('3'),
                    'ˋ' => Some('4'),
                    '˙' => Some('7'),
                    'ˉ' => Some(' '),
                    _ => None,
                };
                if let Some(key) = key {
                    if tone != ' ' {
                        return Err("每個音節只能有一個聲調。".into());
                    }
                    tone = key;
                    body.pop();
                }
            }
            if body.is_empty() {
                return Err("音節不能只有聲調。".into());
            }
            let mut slots = [String::new(), String::new(), String::new()];
            for symbol in body {
                let index = ZVALS
                    .chars()
                    .position(|c| c == symbol)
                    .ok_or("請使用注音符號，例如：ㄘˊ ㄎㄨˋ")?;
                let slot = &mut slots[category(index)];
                if !slot.is_empty() {
                    return Err("詞條讀音的每個音節只能有一個聲母、介音及韻母。".into());
                }
                slot.push(ZKEYS.as_bytes()[index] as char);
            }
            Ok(format!("{}{tone}", slots.join("")))
        })
        .collect()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Syllable {
    pub end: usize,
    pub key: String,
    pub slots: [String; 3],
    pub changes: Vec<String>,
    pub complete: bool,
}

pub fn read_zhuyin(raw: &str, start: usize) -> Option<Syllable> {
    read_units(&raw.encode_utf16().collect::<Vec<_>>(), start)
}

pub(crate) fn read_units(raw: &[u16], start: usize) -> Option<Syllable> {
    let mut slots = [String::new(), String::new(), String::new()];
    let mut changes = Vec::new();
    for (end, unit) in raw.iter().enumerate().skip(start) {
        let key = char::from_u32(*unit as u32)?;
        if "6347 ".contains(key) {
            return slots.iter().any(|s| !s.is_empty()).then(|| Syllable {
                end: end + 1,
                key: format!("{}{key}", slots.join("")),
                slots,
                changes,
                complete: true,
            });
        }
        let index = ZKEYS.find(key)?;
        let category = category(index);
        let slot = &mut slots[category];
        if !slot.is_empty() && slot != &key.to_string() {
            changes.push(format!(
                "{}: {} → {}",
                ["聲母", "介音", "韻母"][category],
                zhuyin(slot),
                zhuyin(&key.to_string())
            ));
        }
        *slot = key.to_string();
    }
    slots.iter().any(|s| !s.is_empty()).then(|| Syllable {
        end: raw.len(),
        key: slots.join(""),
        slots,
        changes,
        complete: false,
    })
}
