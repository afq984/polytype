# Polytype: mixed-language IME prototype

One Rust decoder for Traditional Chinese (Zhuyin), Japanese (romaji) and English
(Colemak or QWERTY). The browser demo runs that engine through WebAssembly; JavaScript
handles physical keyboard events, UI and browser storage. Native OS adapters are
not implemented yet.

Japanese `nn` now consumes both letters as `ん`, following Mozc's table:
`shinnyou` → `しんよう`, `konna` → `こんあ`, `konnna` → `こんな`.
See [the n convention and compatibility notes](docs/ROMAJI.md).

The [English-island sprint](eval/ISLANDS.md) preserves alternative language paths
within the existing search budget. It recovers `p95 latency` inside Chinese
without changing scores or dictionaries. First-tone Space still completes a
Chinese syllable; press Space again for a separator before another language.

## Build and run

Requires Rust (validated with 1.95.0), Node.js 22+, and the matching wasm-bindgen CLI.
There are no npm dependencies. Cargo dependencies are pinned in Cargo.lock.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm run build:wasm
npm start
```

Open http://127.0.0.1:4173. Choose QWERTY (default) or Colemak for English/Japanese,
and enable the languages you want using the checkboxes. Zhuyin always uses its
standard physical positions. The inspection field shows QWERTY physical positions;
pasted text must use that encoding. Settings reinterpret the current keys without
clearing them. Layout and language choices persist in this browser, including an
all-languages-disabled selection. If storage is unavailable, changes still work
for the session; invalid saved settings fall back to QWERTY with all languages on.
No typed input is stored with these preferences. Copy debug report captures settings and candidates.

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

Candidate lists now favor distinct interpretations over near-duplicate kana-script
permutations when space is tight. Single-token katakana selection remains available;
no scores or dictionary entries changed. The [candidate-diversity report](eval/DIVERSITY.md)
records improvements, remaining ambiguities, and the latency tradeoff.

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
[Pages build and deployment](docs/PUBLISHING.md) for setup and artifact hygiene.
Successful push builds on `main` deploy to GitHub Pages once Pages is enabled
with GitHub Actions as its source. Pull requests only build/test. Manual runs
deploy only when the deploy checkbox is checked on `main`.

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
