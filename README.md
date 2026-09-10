# Polytype: mixed-language IME prototype

One Rust decoder for Traditional Chinese (Zhuyin), Japanese (romaji) and English
(Colemak or QWERTY). The browser demo runs that engine through WebAssembly; JavaScript
handles physical keyboard events, UI and browser storage. Native OS adapters are
not implemented yet.

## Build and run

Requires Rust (validated with 1.95.0), Node.js 22+, and the matching wasm-bindgen CLI.
There are no npm dependencies. Cargo dependencies are pinned in Cargo.lock.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm run build:wasm
npm start
```

Open http://127.0.0.1:4173. Choose Colemak (default) or QWERTY for English/Japanese,
and enable the languages you want using the checkboxes. Zhuyin always uses its
standard physical positions. The inspection field shows QWERTY physical positions;
pasted text must use that encoding. Settings reinterpret the current keys without
clearing them and reset on reload. Copy debug report captures settings and candidates.

For a useful regression, click **Save test case…**, review/edit the expected
output, then **Save locally**. **Export cases (JSONL)** downloads the saved set for
local evaluation or sharing. Nothing is uploaded; up to 100 cases are kept in
browser storage, with a session-only fallback if storage is unavailable. Export
before clearing browser data. Custom dictionary contents are not exported.

The current ranking build includes 101,191 SCOWL English spellings, context-gated
Japanese particles, and case/small-kana cues. Import provenance and all upstream
notices live in `data/english-source.json` and `data/sources/scowl/Copyright` and
are bundled in both demos. `npm run dictionary:import-english` explicitly fetches
the pinned archive; builds and tests use checked-in data offline.

```sh
npm test
npm run build:standalone
CHROME_BIN=/path/to/chrome npm run test:browser
```

Tests compile the native core and WASM, run shared acceptance fixtures, and compare
full candidates against the frozen JavaScript reference. The browser check needs
the localhost server running; it also checks the standalone file and missing-WASM
error handling. Cargo-only tests: `cargo test --workspace --locked`.

`Polytype-Demo.html` embeds the same WASM engine and can be opened offline without
a build toolchain. Browser storage and clipboard permissions can differ for file
URLs. Generated `web/pkg/` and Cargo `target/` are ignored; rebuild them after a
fresh checkout. The standalone HTML is checked in and must be regenerated after
core, data or web edits.

## Pages demo

For a deployable static build, run `npm run build:pages`; preview it with
`npm run preview:pages` at http://127.0.0.1:4174/polytype/. See
[Pages preparation and privacy checks](docs/PUBLISHING.md) before publishing.
The workflow deploys only on explicit manual opt-in. Public `main` starts with a
clean root snapshot; older private history must never be merged into or pushed
with it. Source publication does not deploy the demo.

## Try it

- `sakura` → さくら; `gakkou` → がっこう; `ryokou` → りょこう.
- `ko-hi-` → こーひー; select コーヒー for katakana.
- `shinyou` → しにょう versus `shin'you` → しんよう.
- `kan` shows かn; Space or Enter resolves n to ん. Selecting カn commits カン.
- **Kana + Chinese + English** demonstrates がっこう 你好 hello.
- QWERTY-encoded `us3lc3` → 你好; `/j5 ` (with trailing Space) → 中.

Literal spaces permit language changes. A Zhuyin first-tone space completes a
syllable instead of inserting a separator. Candidate selection and commit operate
on the whole composition. Other unfinished consonants can still commit literally.

Chinese now includes 28,184 imported reading/output pairs (26,236 unique outputs)
from a pinned McBopomofo subset, plus prototype fallback and custom entries.
Occurrence counts order imported alternatives; custom entries take precedence.
English vocabulary and Japanese kanji coverage remain small. Ranking is heuristic,
and ambiguous input can prefer another language. This is still a playground.

## Dictionary and real-text evaluation

```sh
npm run dictionary:import  # explicit network step, verifies pinned checksums
npm run evaluate          # builds WASM; evaluates locally and writes eval reports
npm run corpus:verify     # explicit network check against pinned source sentences
```

The [evaluation report](eval/REPORT.md) compares the prototype and expanded
profiles on 20 independently annotated sourced Chinese excerpts and 22 separate
regression/synthetic language controls. Chinese top-1 exact matches rise from
0/20 to 12/20, with 17/20 in the top five. This small development set is not a
representative accuracy estimate. All 20 targets are dictionary-reachable; the
remaining misses expose ranking/segmentation weaknesses. One already-failing
English control loses its correct top-five alternative; the report retains it.

See [evaluation methodology and local JSONL inputs](eval/README.md) and
[dictionary provenance](data/sources/mcbopomofo/README.md). No evaluation text is
added to the dictionary. Dictionary import sources, filters and hashes are in
data/chinese-source.json. Imported data notices are included in both web builds.

## Source layout

- `crates/polytype-core/`: phonetic composition, dictionary validation, search,
  scores and selected-candidate commit. Ordinary Rust API, independent of the web.
- `crates/polytype-wasm/`: thin wasm-bindgen wrapper with one engine per instance.
- `data/lexicon.json`, `data/kana.json`: original prototype data, embedded at build
  time. `data/chinese.tsv` is the generated frequency-ordered Chinese subset.
- `web/engine.mjs`: WASM initialization and protocol adapter; no decoder fallback.
- `web/keyboard.mjs`: browser event normalization.
- `web/app.mjs`, `web/index.html`, `web/style.css`: UI and browser-local persistence.
- `tests/fixtures/`: shared native/WASM acceptance cases.
- `tests/reference/`: frozen, test-only JavaScript migration oracle.
- `tests/parity.test.mjs`: native/Rust/WASM differential checks.
- `scripts/`: build, local server and optional browser checks.

Native Rust clients create `polytype_core::Engine`, call `decode`, and call
`Candidate::commit_text` on the selected result. Custom dictionaries are scoped
to each engine and replaced atomically. The WASM adapter uses protocol version 1:
JSON requests such as `{"version":1,"op":"decode","input":"us3lc3"}`. It returns
JSON results and throws on invalid requests. The `polytype-json` binary accepts
one request per line and returns `{"ok":...}` or `{"error":...}`.

Default engines use the expanded dictionary. `Engine::prototype()`, the native
runner's `--prototype`, and `createEngine({dictionary:'prototype'})` retain the
old vocabulary strictly for migration comparisons and evaluation baselines.

The project uses jj; follow `AGENTS.md` and `HANDOFF.md`. Input stays local.
Original code is [MIT licensed](LICENSE); [third-party data and dependency terms](THIRD_PARTY.md)
remain applicable, including the evaluation corpus's separate CC BY-SA terms.

The initial kana rules were locally authored; conventional n mappings were
cross-checked against [Mozc](https://github.com/google/mozc/blob/master/src/data/preedit/romanji-hiragana.tsv).
The web binding uses [wasm-bindgen's web target](https://wasm-bindgen.github.io/wasm-bindgen/examples/without-a-bundler.html).
