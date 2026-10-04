use polytype_core::{
    Candidate, Constraint, DecodeOptions, Engine, Entry, Layout, compose_japanese, encode,
    read_zhuyin, reading_keys,
};
use serde_json::Value;

// Kana-annotated fixtures accept an imported conversion of the same reading;
// kanji choice follows dictionary order and is evaluated separately.
fn reading_level(candidate: &Candidate) -> String {
    candidate
        .parts
        .iter()
        .map(|p| {
            p.reading
                .as_deref()
                .or(p.commit_text.as_deref())
                .unwrap_or(&p.text)
        })
        .collect()
}

#[test]
fn empty_constraints_preserve_every_acceptance_fixture_in_both_layouts() {
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("../../../tests/fixtures/acceptance.json")).unwrap();
    for engine in [Engine::default(), Engine::prototype()] {
        for layout in [Layout::Colemak, Layout::Qwerty] {
            let options = DecodeOptions {
                layout,
                ..DecodeOptions::default()
            };
            for fixture in &fixtures {
                let raw = fixture["raw"]
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| encode(fixture["roman"].as_str().unwrap()));
                assert_eq!(
                    serde_json::to_string(&engine.decode_with_options(&raw, &options)).unwrap(),
                    serde_json::to_string(&engine.decode_constrained(&raw, &options, &[]).unwrap())
                        .unwrap()
                );
            }
        }
    }
}

#[test]
fn raw_span_constraints_are_hard_and_source_validated() {
    let engine = Engine::default();
    let options = DecodeOptions {
        layout: Layout::Qwerty,
        ..DecodeOptions::default()
    };
    let lock = |start, end, text: &str, lang: &str| Constraint {
        start,
        end,
        text: text.into(),
        lang: lang.into(),
    };
    let choices = [lock(0, 3, "再", "TW"), lock(4, 7, "再", "TW")];
    let candidates = engine
        .decode_constrained("y94 y94 hello", &options, &choices)
        .unwrap();
    assert!(!candidates.is_empty());
    assert_eq!(candidates[0].commit_text(), "再 再 hello");
    for candidate in candidates {
        assert!(candidate.commit_text().starts_with("再 再 "));
    }
    assert!(
        engine
            .decode_constrained("y94", &options, &[lock(0, 3, "你好", "TW")])
            .is_err()
    );
    assert!(
        engine
            .decode_constrained(
                "y94",
                &options,
                &[lock(0, 3, "再", "TW"), lock(0, 3, "在", "TW")]
            )
            .is_err()
    );
    assert!(
        Engine::prototype()
            .decode_constrained("y94", &options, &[choices[0].clone()])
            .is_err()
    );
    assert!(
        engine
            .decode_constrained("😀", &options, &[lock(0, 1, "😀", "RAW")])
            .is_err()
    );
    assert!(
        engine
            .decode_constrained(&" ".repeat(401), &options, &[lock(0, 1, " ", "RAW")])
            .is_err()
    );
    let off = DecodeOptions {
        english: false,
        japanese: false,
        zhuyin: false,
        ..options.clone()
    };
    assert!(
        engine
            .decode_constrained("y94", &off, &[choices[0].clone()])
            .is_err()
    );
    assert!(
        engine
            .decode_constrained(
                "gakkou tanaka hello",
                &options,
                &[lock(7, 13, "tanaka", "EN")]
            )
            .unwrap()
            .iter()
            .all(|c| c.commit_text().contains(" tanaka "))
    );
    let phrase = engine
        .decode_constrained("y/ ru8 xk7", &options, &[lock(0, 7, "增加", "TW")])
        .unwrap();
    assert_eq!(phrase[0].commit_text(), "增加了");
    let split = engine
        .decode_constrained("us3lc3 hello", &options, &[lock(0, 3, "妳", "TW")])
        .unwrap();
    assert_eq!(split[0].commit_text(), "妳好 hello");
    let pending = engine
        .decode_constrained("hello kan", &options, &[lock(6, 9, "カン", "JP")])
        .unwrap();
    assert_eq!(pending[0].text, "hello カン");
    assert_eq!(pending[0].commit_text(), "hello カン");
    let spaces = engine
        .decode_constrained("/j5  hello", &options, &[lock(0, 4, "終", "TW")])
        .unwrap();
    assert_eq!(spaces[0].commit_text(), "終 hello");
}

#[test]
fn a_lock_can_select_a_source_entry_beyond_the_normal_beam() {
    let mut engine = Engine::default();
    engine
        .set_custom_entries(
            (0..20)
                .map(|index| Entry {
                    reading: "ㄗㄞˋ".into(),
                    text: format!("選{index}"),
                })
                .collect(),
        )
        .unwrap();
    let lock = Constraint {
        start: 0,
        end: 3,
        text: "選19".into(),
        lang: "TW".into(),
    };
    let options = DecodeOptions::default();
    assert!(
        !engine
            .decode("y94")
            .iter()
            .any(|candidate| candidate.text == lock.text)
    );
    let candidates = engine.decode_constrained("y94", &options, &[lock]).unwrap();
    assert!(!candidates.is_empty());
    assert!(
        candidates
            .iter()
            .all(|candidate| candidate.commit_text() == "選19")
    );
}

#[test]
fn shared_acceptance_fixtures() {
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("../../../tests/fixtures/acceptance.json")).unwrap();
    let engine = Engine::default();
    for fixture in fixtures {
        let raw = fixture["raw"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| encode(fixture["roman"].as_str().unwrap()));
        // Expanded punctuation migration; keep the frozen prototype fixture.
        let expected = if fixture["text"] == "目前用起來還不錯 可以增加詞庫嗎?" {
            "目前用起來還不錯 可以增加詞庫嗎？"
        } else {
            fixture["text"].as_str().unwrap()
        };
        let best = &engine.decode(&raw)[0];
        assert!(
            best.text == expected || reading_level(best) == expected,
            "{raw:?}: {} vs {expected}",
            best.text
        );
    }
}

#[test]
fn imported_japanese_conversion_waits_for_complete_readings_and_keeps_latin_case() {
    let engine = Engine::default();
    assert_eq!(engine.decode(&encode("gakkou"))[0].text, "学校");
    // Alternatives follow Mozc's standalone cost: 桜 precedes さくら.
    assert_eq!(engine.decode(&encode("sakura"))[0].text, "桜");
    assert!(
        engine
            .decode(&encode("sakura"))
            .iter()
            .any(|c| c.text == "さくら")
    );
    assert_eq!(engine.decode(&encode("kan"))[0].text, "かn");
    assert_eq!(engine.decode(&encode("kan "))[0].commit_text(), "感 ");
    let qwerty = DecodeOptions {
        layout: Layout::Qwerty,
        ..DecodeOptions::default()
    };
    assert_eq!(
        engine.decode_with_options("Tanaka", &qwerty)[0].text,
        "Tanaka"
    );
    assert_eq!(
        engine.decode_with_options("tanaka", &qwerty)[0].text,
        "田中"
    );
    assert_eq!(
        reading_level(&engine.decode(&encode("gakkou"))[0]),
        "がっこう"
    );
    assert!(
        engine.decode(&encode("gakkou"))[0].parts[0]
            .reading
            .is_some()
    );
    assert!(
        engine.decode(&encode("sakura"))[0].parts[0]
            .reading
            .is_some()
    );
    assert!(
        Engine::prototype().decode(&encode("gakkou"))[0].parts[0]
            .reading
            .is_none()
    );
    assert_eq!(engine.dictionary_size()["japaneseImported"], 69097);
}

#[test]
fn correction_locks_honor_converted_first_tone_boundaries_and_opening_scores() {
    let mut engine = Engine::default();
    let lock = |start, end, text: &str, lang: &str| Constraint {
        start,
        end,
        text: text.into(),
        lang: lang.into(),
    };
    for layout in [Layout::Colemak, Layout::Qwerty] {
        let options = DecodeOptions {
            layout,
            ..DecodeOptions::default()
        };
        for reading in ["ㄍㄤ", "ㄨㄛˇ ㄍㄤ"] {
            let stem = reading_keys(reading).unwrap().join("");
            for spaces in ["", " ", "  "] {
                for (word, text, lang) in [
                    ("call", "call", "EN"),
                    ("11/", "11/", "EN"),
                    ("v2", "v2", "EN"),
                    ("OK", "OK", "EN"),
                    ("gakkou", "学校", "JP"),
                    ("gakkou", "がっこう", "JP"),
                ] {
                    let roman = if matches!(layout, Layout::Colemak) {
                        encode(word)
                    } else {
                        word.into()
                    };
                    let start = stem.len() + spaces.len();
                    let raw = format!("{stem}{spaces}{roman}");
                    let ordinary = engine.decode_with_options(&raw, &options);
                    let expected = format!(
                        "{}{spaces}{text}",
                        if reading == "ㄍㄤ" { "剛" } else { "我剛" }
                    );
                    let locks = [lock(start, raw.len(), text, lang)];
                    let constrained = engine.decode_constrained(&raw, &options, &locks).unwrap();
                    assert_eq!(constrained[0].commit_text(), expected, "{raw}");
                    if let Some(candidate) = ordinary.iter().find(|c| c.commit_text() == expected) {
                        assert!(
                            (constrained[0].score - candidate.score).abs() < 1e-9,
                            "{raw}: {} vs {}",
                            constrained[0].score,
                            candidate.score
                        );
                    }
                }
            }
        }
        let roman = if matches!(layout, Layout::Colemak) {
            encode("call")
        } else {
            "call".into()
        };
        let raw = format!("1 {roman}");
        assert!(
            engine
                .decode_constrained(
                    &raw,
                    &options,
                    &[lock(0, 2, "ㄅ", "TW"), lock(2, raw.len(), "call", "EN")]
                )
                .unwrap()
                .is_empty()
        );
        let raw = format!("1  {roman}");
        assert_eq!(
            engine
                .decode_constrained(
                    &raw,
                    &options,
                    &[lock(0, 2, "ㄅ", "TW"), lock(3, raw.len(), "call", "EN")]
                )
                .unwrap()[0]
                .text,
            "ㄅ call"
        );
    }
    engine
        .set_custom_entries(vec![Entry {
            reading: "ㄅ".into(),
            text: "自訂".into(),
        }])
        .unwrap();
    let options = DecodeOptions {
        layout: Layout::Qwerty,
        ..DecodeOptions::default()
    };
    assert_eq!(
        engine
            .decode_constrained(
                "1 call",
                &options,
                &[lock(0, 2, "自訂", "TW"), lock(2, 6, "call", "EN")]
            )
            .unwrap()[0]
            .text,
        "自訂call"
    );
}

#[test]
fn paired_punctuation_locks_and_bare_initials_keep_source_context() {
    let engine = Engine::default();
    let lock = |start, end, text: &str, lang: &str| Constraint {
        start,
        end,
        text: text.into(),
        lang: lang.into(),
    };
    for layout in [Layout::Colemak, Layout::Qwerty] {
        let options = DecodeOptions {
            layout,
            ..DecodeOptions::default()
        };
        let locks = [lock(0, 3, "再", "TW"), lock(3, 4, "（", "punct")];
        assert_eq!(
            engine
                .decode_constrained("y94(?", &options, &locks)
                .unwrap()[0]
                .text,
            "再（？"
        );
        let locks = [lock(0, 3, "再", "TW"), lock(3, 4, "<", "punct")];
        assert_eq!(
            engine.decode_constrained("y94<", &options, &locks).unwrap()[0].text,
            "再<"
        );
        assert!(
            engine
                .decode_constrained("y94<", &options, &[lock(3, 4, "!", "punct")])
                .is_err()
        );
        let chinese = DecodeOptions {
            english: false,
            japanese: false,
            ..options.clone()
        };
        let bare = [lock(0, 2, "ㄅ", "TW")];
        assert_eq!(
            engine.decode_constrained("1 ?", &chinese, &bare).unwrap()[0].text,
            "ㄅ?"
        );
        assert!(
            engine
                .decode_constrained("1 <", &chinese, &bare)
                .unwrap()
                .is_empty()
        );
        let locks = [bare[0].clone(), lock(2, 3, "，", "punct")];
        assert!(
            engine
                .decode_constrained("1 <", &chinese, &locks)
                .unwrap()
                .is_empty()
        );
        let locks = [bare[0].clone(), lock(2, 3, "（", "punct")];
        assert_eq!(
            engine.decode_constrained("1 (?", &chinese, &locks).unwrap()[0].text,
            "ㄅ（?"
        );
        let roman = match layout {
            Layout::Colemak => encode("OK"),
            Layout::Qwerty => "OK".into(),
        };
        let locks = [lock(4, 6, "OK", "EN")];
        assert_eq!(
            engine
                .decode_constrained(&format!("y94 {roman}"), &options, &locks)
                .unwrap()[0]
                .text,
            "在 OK"
        );
    }
    let options = DecodeOptions {
        layout: Layout::Colemak,
        japanese: false,
        zhuyin: false,
        ..DecodeOptions::default()
    };
    let roman = encode("OHIO");
    assert!(
        engine
            .decode_constrained(&roman, &options, &[lock(3, 4, "：", "punct")])
            .unwrap()
            .is_empty()
    );
}

#[test]
fn correction_locks_keep_dictionary_punctuation_context() {
    let mut engine = Engine::default();
    let choice = |end, text: &str, lang: &str| polytype_core::Constraint {
        start: 0,
        end,
        text: text.into(),
        lang: lang.into(),
    };
    for layout in [Layout::Qwerty, Layout::Colemak] {
        let options = DecodeOptions {
            layout,
            ..DecodeOptions::default()
        };
        for (key, mark) in [
            ("<", "，"),
            (">", "。"),
            ("?", "？"),
            ("!", "！"),
            (":", "："),
            ("'", "、"),
            ("\"", "；"),
            ("[", "「"),
            ("]", "」"),
            ("{", "『"),
            ("}", "』"),
        ] {
            let candidates = engine
                .decode_constrained(&format!("y94{key}"), &options, &[choice(3, "再", "TW")])
                .unwrap();
            assert_eq!(candidates[0].commit_text(), format!("再{mark}"));
            assert!(
                candidates
                    .iter()
                    .any(|c| c.commit_text() == format!("再{key}"))
            );
            assert!(candidates.iter().all(|c| c.parts[0].text == "再"));
            let roman = match layout {
                Layout::Qwerty => "hello".to_owned(),
                Layout::Colemak => encode("hello"),
            };
            let locks = [
                choice(3, "再", "TW"),
                polytype_core::Constraint {
                    start: 4,
                    end: 9,
                    text: "hello".into(),
                    lang: "EN".into(),
                },
            ];
            let candidates = engine
                .decode_constrained(&format!("y94{key}{roman}"), &options, &locks)
                .unwrap();
            assert_eq!(candidates[0].commit_text(), format!("再{mark}hello"));
        }
        let candidates = engine
            .decode_constrained("us3lc3?", &options, &[choice(6, "us3lc3", "RAW")])
            .unwrap();
        assert_eq!(candidates[0].commit_text(), "us3lc3?");
    }
    let raw = reading_keys("ㄋㄝ").unwrap().join("");
    let options = DecodeOptions {
        layout: Layout::Qwerty,
        english: false,
        japanese: false,
        ..DecodeOptions::default()
    };
    let fallback = [choice(raw.len(), "ㄋㄝˉ", "TW")];
    assert_eq!(
        engine
            .decode_constrained(&format!("{raw}?"), &options, &fallback)
            .unwrap()[0]
            .text,
        "ㄋㄝˉ?"
    );
    assert!(
        engine
            .decode_constrained(&format!("{raw}<"), &options, &fallback)
            .unwrap()
            .is_empty()
    );
    let roman_options = DecodeOptions {
        english: true,
        ..options.clone()
    };
    let locks = [
        fallback[0].clone(),
        polytype_core::Constraint {
            start: raw.len() + 1,
            end: raw.len() + 6,
            text: "hello".into(),
            lang: "EN".into(),
        },
    ];
    assert!(
        engine
            .decode_constrained(&format!("{raw}<hello"), &roman_options, &locks)
            .unwrap()
            .is_empty()
    );
    engine
        .set_custom_entries(vec![Entry {
            reading: "ㄋㄝ".into(),
            text: "ㄋㄝ".into(),
        }])
        .unwrap();
    assert_eq!(
        engine
            .decode_constrained(
                &format!("{raw}<"),
                &options,
                &[choice(raw.len(), "ㄋㄝ", "TW")]
            )
            .unwrap()[0]
            .text,
        "ㄋㄝ，"
    );
}

#[test]
fn custom_dictionary_is_atomic_and_per_engine() {
    let mut engine = Engine::default();
    let other = Engine::default();
    engine
        .set_custom_entries(vec![Entry {
            reading: "ㄎㄜ ㄐㄧˋ".into(),
            text: "科技".into(),
        }])
        .unwrap();
    assert_eq!(engine.decode("kd ur4")[0].text, "科技");
    assert!(
        engine
            .set_custom_entries(vec![Entry {
                reading: "bad".into(),
                text: "錯".into()
            }])
            .is_err()
    );
    assert_eq!(engine.decode("kd ur4")[0].text, "科技");
    assert_eq!(other.dictionary_size()["custom"], 0);
    assert_eq!(engine.dictionary_size()["custom"], 1);
    assert!(reading_keys("ㄅㄆㄚ").is_err());
    assert!(reading_keys("ˋ").is_err());
}

#[test]
fn chinese_frequency_ranks_segmentations_and_preserves_rare_custom_choices() {
    let mut engine = Engine::default();
    for layout in [Layout::Colemak, Layout::Qwerty] {
        let options = DecodeOptions {
            layout,
            ..DecodeOptions::default()
        };
        let raw = reading_keys("ㄨㄛˇ ㄉㄥˇ ㄧˊ ㄒㄧㄚˋ ㄧㄠˋ")
            .unwrap()
            .join("");
        assert_eq!(
            engine.decode_with_options(&raw, &options)[0].text,
            "我等一下要"
        );
        assert_eq!(
            engine.experiment(&raw, &options, "floor").unwrap()[0].text,
            "我等一下藥"
        );
        assert_eq!(
            engine
                .experiment(&raw, &options, "floor+frequency")
                .unwrap()[0]
                .text,
            "我等一下要"
        );
    }
    // The diagnostic boundary relaxation stays off; rare 尻 must also lose
    // when it is explicitly enabled, rather than fragmenting common English.
    let phrase = reading_keys("ㄗㄞˋ ㄕㄨㄛ").unwrap().join("");
    assert_eq!(engine.decode(&phrase)[0].text, "再說");
    let raw = "Fhld ld a bit.";
    assert_eq!(engine.decode(raw)[0].text, "This is a bug.");
    assert_eq!(
        engine
            .experiment(raw, &DecodeOptions::default(), "current+first-tone")
            .unwrap()[0]
            .text,
        "This is a bug."
    );
    let rare = reading_keys("ㄎㄠ").unwrap().join("");
    let ordinary = engine.decode(&rare)[0].text.clone();
    assert_ne!(ordinary, "尻");
    engine
        .set_custom_entries(vec![Entry {
            reading: "ㄎㄠ".into(),
            text: "尻".into(),
        }])
        .unwrap();
    assert_eq!(engine.decode(&rare)[0].text, "尻");
    engine.set_custom_entries(Vec::new()).unwrap();
    assert_eq!(engine.decode(&rare)[0].text, ordinary);
}

#[test]
fn unordered_zhuyin_and_selected_commit() {
    let engine = Engine::default();
    for raw in ["5j/ ", "5/j ", "j5/ ", "j/5 ", "/5j ", "/j5 "] {
        assert_eq!(engine.decode(raw)[0].text, "中");
    }
    let syllable = read_zhuyin("sujo/5", 0).unwrap();
    assert_eq!(syllable.changes.len(), 3);
    assert!(!syllable.complete);
    let candidates = engine.decode(&encode("kan"));
    assert_eq!(
        candidates
            .iter()
            .find(|c| c.text == "カn")
            .unwrap()
            .commit_text(),
        "カン"
    );
    assert_eq!(compose_japanese("kan", false).unwrap().pending, "n");
    assert_eq!(compose_japanese("kan", true).unwrap().text, "かん");
}

#[test]
fn bounded_input_and_protocol_errors() {
    let mut engine = Engine::default();
    assert_eq!(engine.decode(&" ".repeat(401))[0].text.len(), 400);
    assert!(
        engine
            .request(r#"{"version":2,"op":"decode","input":""}"#)
            .is_err()
    );
    assert!(engine.request(r#"{"version":1,"op":"unknown"}"#).is_err());
    assert!(
        engine
            .request(r#"{"version":1,"op":"setCustomEntries","entries":null}"#)
            .is_err()
    );
}
