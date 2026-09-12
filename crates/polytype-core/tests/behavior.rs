use polytype_core::{
    Candidate, DecodeOptions, Engine, Entry, Layout, compose_japanese, encode, read_zhuyin,
    reading_keys,
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
fn shared_acceptance_fixtures() {
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("../../../tests/fixtures/acceptance.json")).unwrap();
    let engine = Engine::default();
    for fixture in fixtures {
        let raw = fixture["raw"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| encode(fixture["roman"].as_str().unwrap()));
        let expected = fixture["text"].as_str().unwrap();
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
