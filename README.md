# Polytype: mixed-language IME prototype

One Rust decoder for Traditional Chinese (Zhuyin), Japanese (romaji) and English
(Colemak or QWERTY). The browser demo runs that engine through WebAssembly; JavaScript
handles physical keyboard events, UI and browser storage. Native OS adapters are
not implemented yet.

Japanese conversion now uses a 69,097-entry subset of Mozc's open-source
dictionary, keyed by kana reading and ordered by Mozc's standalone word cost:
`gakkou` → 学校, `sakura` → 桜 (さくら next), `ko-hi-` → コーヒー. Conversion is
per space-delimited token and waits for a complete reading, so a trailing
pending `n` still commits as kana. Japanese `nn` consumes both letters as `ん`,
following Mozc's table: `shinnyou` → `しんよう`, `konna` → `こんあ`,
`konnna` → `こんな`. See [the conversion and n-convention notes](docs/ROMAJI.md).

The [English-island sprint](eval/ISLANDS.md) preserves alternative language paths
within the existing search budget. It recovers `p95 latency` inside Chinese
without changing scores or dictionaries. First-tone Space still completes a
Chinese syllable; press Space again for a separator before another language.

## Build and run

Bazel is the single supported build workflow on Linux x86_64, targeting native
Linux and WebAssembly. Install Bazelisk; Bazel downloads the pinned Rust 1.95.0,
Node.js 26.8.1 and wasm-bindgen 0.2.128 tools and locked dependencies. There are
no npm dependencies or TypeScript compilation steps.

The agreed boundary leaves the host linker, libc/sysroot and browser unpinned.
A working host C/C++ toolchain is still required (for example `build-essential`
on Debian/Ubuntu); optional browser checks also need Chrome and its system libraries.
No system Rust, Cargo, rustup, Node.js or npm installation is needed. See
[the build contract and reproducibility checks](docs/BUILD.md).

```sh
bazelisk test //...
bazelisk run //:serve
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
are bundled in both demos. `bazelisk run //:import_english` explicitly fetches
the pinned archive; builds and tests use checked-in data offline.

Candidate lists now favor distinct interpretations over near-duplicate kana-script
permutations when space is tight. Single-token katakana selection remains available;
no scores or dictionary entries changed. The [candidate-diversity report](eval/DIVERSITY.md)
records improvements, remaining ambiguities, and the latency tradeoff.

```sh
bazelisk test //...
bazelisk build //:standalone
bazelisk test //:browser_test --test_env=CHROME_BIN=/path/to/chrome
```

Tests compile the native core and WASM, run shared acceptance fixtures, and compare
full candidates against the frozen JavaScript reference. The optional browser check starts its own
server and also checks the standalone file and missing-WASM error handling.
Native-only tests: `bazelisk test //crates/polytype-core:all`.

`bazel-bin/Polytype-Demo.html` embeds the same WASM engine and can be opened
offline without a build toolchain. Browser storage and clipboard permissions can
differ for file URLs. Built artifacts are never committed: Bazel writes every
output under `bazel-bin/`, and the standalone HTML and generated notices are
ignored in the checkout.

## Pages demo

For a deployable static build, run `bazelisk build //:pages`; preview it with
`bazelisk run //:preview` at http://127.0.0.1:4174/polytype/. See
[Pages build and deployment](docs/PUBLISHING.md) for setup and artifact hygiene.
Successful push builds on `main` deploy to GitHub Pages once Pages is enabled
with GitHub Actions as its source. Pull requests only build/test. Manual runs
deploy only when the deploy checkbox is checked on `main`.

## Try it

- `sakura` → 桜 (さくら and サクラ next); `gakkou` → 学校; `ryokou` → 旅行.
- `ko-hi-` → コーヒー, with 珈琲 and こーひー as alternatives.
- `shinyou` → しにょう versus `shin'you` → 信用, with しんよう one click away.
- `kan` shows かn; Space or Enter resolves n to ん. Selecting カn commits カン.
  Once a boundary follows, `kan ` converts to 感 with かん still selectable.
- **Kana + Chinese + English** demonstrates 学校 你好 hello.
- QWERTY-encoded `us3lc3` → 你好; `/j5 ` (with trailing Space) → 中.

Literal spaces permit language changes. A Zhuyin first-tone space completes a
syllable instead of inserting a separator. Candidate selection and commit operate
on the whole composition. Other unfinished consonants can still commit literally.

Chinese includes 28,184 imported reading/output pairs (26,236 unique outputs)
from a pinned McBopomofo subset, plus prototype fallback and custom entries.
Occurrence counts order imported alternatives; custom entries take precedence.
Japanese includes 69,097 reading/surface pairs for 53,410 readings from a pinned
Mozc open-source dictionary subset, ordered by Mozc's standalone cost; the
prototype's demo words remain as fallback. Whole-token conversion cannot split
word-plus-particle spellings such as `kyouha`, and homophone choice has no
sentence context. Ranking is heuristic, and ambiguous input can prefer another
language. This is still a playground. The WASM is 4.36 MB and the standalone HTML
10.45 MB (decimal bytes).

## Dictionary and real-text evaluation

```sh
bazelisk run //:import_chinese   # explicit network step, verifies pinned checksums
bazelisk run //:import_japanese  # explicit network step; --from-dir=DIR reproduces offline
bazelisk build //:evaluation     # builds WASM; evaluates locally and writes eval reports
bazelisk run //:verify_corpus    # explicit network check against pinned source sentences
```

The [evaluation report](eval/REPORT.md) compares the prototype and expanded
profiles on 20 independently annotated sourced Chinese excerpts, 100 sourced
Japanese words with UniDic readings, 22 regression/synthetic language controls
and six user-supplied mixed lines. Chinese top-1 exact matches are 12/20 with
17/20 in the top five, unchanged by the Japanese import. Japanese word conversion
is 75/100 top one and 86/100 top five; 86 targets are in the imported subset, so
the rest are coverage or compound-segmentation gaps, not ranking. Kana-annotated
targets are additionally reported at the reading level, where an imported
conversion of the same reading counts as correct. These small development sets
are not representative accuracy estimates.

See [evaluation methodology and local JSONL inputs](eval/README.md),
[Chinese dictionary provenance](data/sources/mcbopomofo/README.md) and
[Japanese dictionary provenance](data/sources/mozc/README.md). No evaluation text
is added to a dictionary. Import sources, filters and hashes are in
data/chinese-source.json and data/japanese-source.json. Imported data notices are
included in both web builds.

## Source layout

- `crates/polytype-core/`: phonetic composition, dictionary validation, search,
  scores and selected-candidate commit. Ordinary Rust API, independent of the web.
- `crates/polytype-wasm/`: thin wasm-bindgen wrapper with one engine per instance.
- `data/lexicon.json`, `data/kana.json`: original prototype data, embedded at build
  time. `data/chinese.tsv` is the generated frequency-ordered Chinese subset and
  `data/japanese.tsv` the generated cost-ordered Japanese subset.
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
