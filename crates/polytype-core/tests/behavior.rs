use polytype_core::{Engine, Entry, compose_japanese, encode, read_zhuyin, reading_keys};
use serde_json::Value;

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
        assert_eq!(
            engine.decode(&raw)[0].text,
            fixture["text"].as_str().unwrap(),
            "{raw:?}"
        );
    }
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
