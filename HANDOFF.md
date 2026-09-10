# Polytype handoff

## Current state

Candidate-diversity sprint: the expanded beam remains 12 but evicts excess
rule-generated kana-script siblings before distinct interpretation families.
Soft caps are two per family in search and one in the final five, with spare
capacity available to variants. Family keys preserve raw segmentation, full
language/context history, pending/completion and commit behavior. Original
scores, dictionaries, literal-English retention and prototype behavior are unchanged.
Debug/capture ranking ID is scowl-context-v4+family-v1.

The three diagnosed all-English collapses now retain useful mixed top-one paths.
Six-sentence top one is still 4/6; top five is 5/6 except Colemak/all (4/6).
Mixed CER is now 5.9% in all four configurations. Latin tanaka is selectable
at rank 3 in three configurations; rebase/mite and Colemak/all tanaka remain
unresolved. Existing Chinese 12/20 top one / 17/20 top five, 22 guards and five
feedback cases are unchanged. The 24 frozen synthetic controls and two ambiguous
probes have 92 layout/language configurations; no prior correct target was lost.
These are development annotations, not user-confirmed accuracy claims.

eval/DIVERSITY.md records the frozen experiment plan and reproduction commands;
diversity-report.md lists results and unresolved cases. Diagnostic widths 12/48/192
are finite, not an oracle. The opt-in native diagnostics feature is not exposed
by the web protocol. Per-segment correction and dictionary expansion are deferred.
Final alternating baseline/current WASM measurements over 3,889 prefixes show
11.6% median p95 overhead (five rounds, 9.0–12.0%), within the frozen 15% budget.
Both browser formats pass candidate recovery/selection/commit and prior smoke tests.

The demo defaults to QWERTY and restores layout plus all three language toggles
from polytype-input-options-v1 before generating examples or decoding. It saves
only these four preferences, on explicit settings changes. All-off is valid;
invalid/missing storage falls back to QWERTY/all-on, with a visible warning for
unreadable data. Write failure keeps session settings usable. Core/API defaults
remain Colemak for compatibility. Browser tests cover both demo formats.

Pages preparation: npm run build:pages builds an allowlisted dist/ artifact;
npm run preview:pages serves it at http://127.0.0.1:4174/polytype/. Rust build
paths are remapped, and npm run audit:public checks dist and recursively decoded
standalone payloads for host identifiers/private paths/credential markers.
The GitHub workflow builds/tests automatically and deploys successful main push
builds. Pull requests never deploy; manual main runs need the deploy checkbox.
Pages must use GitHub Actions as its publishing source. Public main is a fresh root snapshot under MIT;
the source remote is git@github.com:afq984/polytype.git. IMPORTANT: the local
private-prepublication bookmark retains older history containing host paths.
Never push it, merge it into main, or use an all-bookmarks push. Push only main.
See docs/PUBLISHING.md for build prerequisites, checks, limits and setup.
Validated locally: 7 native tests, 34 passing Node tests with the same 2 ranking
TODOs, privacy guards, and browser smoke at the Pages subpath and standalone file.
GitHub Actions build and Pages deployment passed, and browser smoke passed against
the live site at https://afq984.github.io/polytype/. Public publishing notes describe
artifact hygiene on GitHub-hosted runners; local-history precautions remain here
and in AGENTS.md. Continue auditing each new public commit before pushing.

The first ranking sprint is implemented. Default engines import 101,191 lowercase
ASCII spellings from pinned SCOWL 2020.12.07 English/American word and contraction
lists through level 60. Full notices are bundled in the web and standalone demo;
data/english-source.json records source hashes and selection. Rebuild explicitly
with npm run dictionary:import-english (network); normal builds remain offline.
Coverage tiers are not frequency probabilities. Lower tiers get more evidence;
productive re-/un-/pre- prefixes on common stems get weak tier-60 evidence.
The importer never reads eval/ and no test words were inserted manually.

Expanded scoring adds equal 0.75 same-language bonuses for EN and JP, a soft
capitalization cue, and a penalty for x-/l-prefixed small-kana entries inside a
word (explicit initial xtsu/lya remain usable). Japanese particles get a bonus
only with a Japanese anchor among the last four nonspace parts before a hard
punctuation boundary. A short particle alone cannot establish that anchor, keeping
English `ha ha` intact. This is still heuristic, not a learned language model.
Zhuyin scoring and frozen prototype behavior are unchanged.

Before family retention, the six mixed cases scored 4/6 exact top 1/top 5 in every layout/language
configuration. EN+JP CER is 5.9% (was 22.5%); all-language CER is 19.9% Colemak
and 14.0% QWERTY. Cases 3 and 6 remain TODO: rebase/mite, lowercase tanaka, and
beam loss with Zhuyin active. Existing 22 guards, five earlier feedback cases,
and Chinese 12/20 top 1 / 17/20 top 5 remain unchanged. Additional synthetic
English/context/case controls pass. These are development measurements, not
held-out accuracy or user-confirmed target readings.

Save test case opens an explicit snapshot with an editable expected output.
Save locally stores up to 100 deduplicated records in polytype-test-cases-v1;
Export cases downloads polytype-local-cases.jsonl. No auto-logging or uploads.
Raw input, options, selected rank, expected text and dictionary counts are saved;
committed history and custom entry contents are omitted. Failed storage keeps
session-only export available, and corrupt existing storage is not overwritten.
Personal export filenames are ignored by jj. Run node scripts/evaluate.mjs PATH
to evaluate an export; custom dictionary contents must be restored separately.
Browser tests cover correction, snapshot stability, deduplication, export,
reload persistence and denied storage. The user should now live-test the sprint.
The WASM is 2.38 MB and standalone HTML 5.71 MB (decimal bytes).

## Previous milestone

Six user-supplied Japanese/English lines are preserved in eval/mixed-text.json,
with provisional kana/literal targets (not confirmed kanji gold). They run in
both layouts with all languages and EN+JP only. Before this sprint, the result was 0/6 top 1
and top 5 in every configuration. The first follow-up supports trailing periods,
commas and semicolons in Japanese dictionary/kana candidates without reassigning
those raw keys globally. They finalize pending n; other pending consonants remain
literal. Numeric tokens following EN/JP gain literal evidence (2.5 per digit),
while standalone or Chinese-context tone keys keep prior scoring. This improves
EN+JP CER from 41.0% to 22.5%, all-language Colemak from 46.9% to 30.3%, and
QWERTY from 45.8% to 29.2%. Technical English still becomes kana and short
Japanese still loses to English. See eval/REPORT.md and eval/README.md.
Tests cover native/WASM parity and every-prefix literal retention for all 24
configurations, plus six visible TODO target tests. No dictionary entries were
added; legacy prototype scoring is unchanged. eval/cases.mjs has an explicit case-preserving
Colemak input adapter with round-trip validation because legacy encode ignores
uppercase; these six cases avoid the existing uppercase-O raw-format limitation.

The demo offers a Colemak/QWERTY selector for English and Japanese, plus independent
English/Japanese/Zhuyin checkboxes. The initial version defaulted to Colemak with
session-only settings; the current demo uses the persisted QWERTY defaults above.
Changes reinterpret existing raw keys without clearing
them, stop replay, and regenerate examples for the layout. Zhuyin positions never
change. Disabling every language yields no candidates and disables commit.
Debug reports include all settings. Decode options are implemented in the shared
Rust search before beam pruning, not as a browser result filter. Native callers
can use decode_with_options; JSON decode accepts options with layout and boolean
english/japanese/zhuyin fields. Omitted fields retain defaults; invalid fields fail.

The code-loop bug (`for (int i = 0; i < 100; i++)`) was English paths getting
pruned before later operators arrived. Expanded decoding now independently keeps
one literal-English candidate when English is enabled, reserving a top-five slot
if necessary. This may displace the fifth phonetic candidate; ranking remains
heuristic. Every prefix of the reported loop has a literal candidate in both
layouts. Frozen prototype behavior remains unchanged.

The web demo has a Copy debug report button below the candidates. On an explicit
click it snapshots raw input/caret, ranked candidates with scores and commit text,
the selected trace, dictionary counts, ranking identifier and browser details.
It stops replay, copies JSON locally, and offers a reviewable snapshot; clipboard
denial opens/selects the snapshot for manual copying. Committed history and the
custom dictionary list are omitted. No network submission or ongoing key log.
Browser smoke tests cover copy success/denial and unchanged candidate selection.

The live default now uses revised language ranking: spelling-shaped English gets
positive evidence even outside the small word list, with a modest English
continuity bonus across boundaries. Zhuyin loses two score points for each raw
key discarded by slot normalization (including repeats); unordered input still
works, and replacement candidates remain available. Incomplete non-n romaji is
weaker; pending Japanese n still has kana candidates and selected-script commit.
For example, `hello kan` now defaults to English; selecting `hello かn` still
commits `hello かん`. These are heuristics, not a calibrated language model.
The prototype profile preserves both the old dictionary and old ranking for
frozen-reference parity, so profile comparisons now include both changes.

User feedback regressions include raw `c;jcuidl;j` → `conclusion`,
`Fhld ld a bit.` → `This is a bug.`, and the full mixed 注音 priority sentence.
ASCII parentheses and colon are literal boundaries. A narrowly scoped attached
English possessive (`'s` or `’s`, including its apostrophe-only typing prefix)
is allowed after completed Chinese; general within-token switching remains off.
Trailing English periods/commas/semicolons no longer destroy spelling evidence;
these keys remain available as Zhuyin symbols rather than global separators.
Physical Shift-P now produces colon; CapsLock alone does not shift punctuation.

The dictionary milestone after migration adds a pinned McBopomofo subset:
28,184 reading/output pairs, 26,236 unique outputs, 8,184 single-character readings
and 20,000 phrase/readings. Only positive-frequency Han output is selected; single
characters are limited to upstream Big5 entries. The importer is reproducible
and independent of evaluation data. Source hashes, counts and notices are under
data/chinese-source.json and data/sources/mcbopomofo/.

Default engines use expanded data, ordered by occurrence before prototype fallback;
custom entries remain first. Engine::prototype(), CLI --prototype and the web
createEngine dictionary option preserve the old profile for baseline tests.
dictionarySize now also returns imported (a source-row count, not unique words).
Chinese candidate loops only emit the first 12 alternatives from each source
state: lower-scoring alternatives cannot survive the beam of 12.

An offline evaluation harness compares profiles on 20 manually annotated excerpts
from pinned UD Chinese GSD test sentences plus 22 separate guards. Real-text top-1
exact output improves 0/20 → 12/20; top five 0/20 → 17/20; CER 217.6% → 5.6%.
This is a small selected development diagnostic, not held-out accuracy. All 20
targets are vocabulary-reachable, exposing remaining ranking/segmentation errors.
After the ranking fix, all 22 guards pass top-1 (previous expanded result 20/22),
and all five user-feedback cases pass. Chinese results remain 12/20 and 17/20.
See eval/README.md for methodology, attribution, experiments and local JSONL input.
No evaluation text ships in the dictionary. Preserve corpus/data notices.

Run npm run evaluate to regenerate reports; dictionary:import and corpus:verify
are explicit network steps. Regular builds and tests use checked-in data offline.
Both browser builds pass typing, candidate, custom-storage and missing-WASM checks
with the expanded dictionary. A new example button stages 資料庫 hello.

The user live-tested Japanese composition and reported no obvious algorithm
issues beyond weak dictionary coverage. They accepted retaining literal-space
language boundaries and authorized migration to Rust.

Migration is implemented: one Rust core, consumed by the browser through WASM.
There is no production JavaScript decoder. The previous live-tested JavaScript
implementation is frozen under tests/reference/ only for differential testing.
A native library and local JSON-line runner exist; no native OS adapter, C ABI,
ML model or extension has been implemented.

The project originated from Polytype-Codex-Handoff.zip and uses a colocated jj
repository. The local web server defaults to http://127.0.0.1:4173.

## Interaction contract

- OS keyboard is already Colemak. KeyboardEvent.code supplies QWERTY physical
  positions; normalize once. Do not double-convert typed characters.
- Chinese uses Taiwan standard Zhuyin positions; Japanese and English use the
selected QWERTY (demo default) or Colemak layout; core API defaults remain Colemak.
- Pasted raw input is QWERTY-encoded. Dictionary editor inputs are actual Zhuyin.
- Literal spaces permit language changes. Space can also finish a first-tone
  Zhuyin syllable and must not be discarded or blindly treated as a separator.
- Punctuation currently resets language; that remains an implementation choice.
- Completed Chinese can take an attached English possessive; other language
  changes still require a literal separator.
- Zhuyin slots (initial, medial, final) accept any order. A later symbol replaces
  the same slot before tone entry. Tone completes a syllable, not the composition.
- Tone keys: Space=first, 6=second, 3=third, 4=fourth, 7=neutral.
- 用 is ㄩㄥˋ, raw m/4. Never add an incorrect ㄨㄥˋ alias.
- Enter commits the selected whole candidate; Escape clears input. Click to
  select an alternative. Tab navigates controls; it does not cycle candidates.
- Japanese supports general kana, common spelling variants, contracted sounds,
  doubled consonants, small kana, n', nn and long-vowel hyphens.
- Trailing Japanese n stays pending until a boundary or commit, then becomes
  ん/ン in the selected script. Other unfinished consonants remain literal.
- Backspace replays the remaining raw input; deleting a Zhuyin replacement restores
  the previous symbol. This is existing behavior, not a settled native-IME design.

## Acceptance examples

Preserve exact spaces:

| QWERTY raw input | Top candidate |
| --- | --- |
| flldal 2k7u/ jp6g4 dmauu | 小さい 的英文是 small |
| aj4fu06m/4fu3x96c961j6hji4 dk3u3y/ ru8 h6dj4a87? | 目前用起來還不錯 可以增加詞庫嗎? |
| us3lc3 | 你好 |
| /j5 followed by Space | 中 |
| sujo/5 followed by Space | 中 |
| m/4 | 用 |

In the original mixed sample, the first and third spaces are literal; the middle
one completes 英. flldal maps to tiisai and dmauu maps to small.
The replacement sample normalizes to ㄓㄨㄥ before Space completes it.

## Architecture and migration decisions

- crates/polytype-core owns phonetic composition, Colemak character mapping,
  dictionary validation/lookup, candidate search, ranking and commit.
- data/lexicon.json and data/kana.json contain the original prototype data.
  Rust embeds these at compile time. No vocabulary expansion accompanied migration.
- Dictionary phrase prefixes are indexed in a set; scores and traversal ordering
  preserve the reference behavior. Stable tie sorting is required.
- Search recomputes the whole buffer, capped at 400 UTF-16 code units, with a beam
  of 12 per offset and up to five deduplicated final candidates.
- Raw indices use UTF-16 units for browser compatibility. Rust strings are valid
  Unicode: isolated surrogates arriving through the WASM string boundary or
  truncation are replaced with U+FFFD rather than preserved as invalid scalars.
- Candidate fields and trace parts retain the previous web interface. Numeric
  parity tests allow 1e-10 rounding tolerance for cross-runtime float formatting.
- Existing phrase traces share accumulated replacement history in the reference;
  the Rust port preserves that trace behavior rather than silently correcting it.
- Engine instances own custom dictionaries. Validation finishes before replacement.
  Limits remain 200 entries, 1–12 syllables, 180 UTF-16 reading units and 40 output
  units per entry. Browser storage stays at polytype-custom-tw-v1.
- Rust has a typed API plus version-1 JSON request transport. wasm-bindgen exposes
  a Polytype instance; the web adapter keeps the previous synchronous methods
  after asynchronous WASM startup.
- Physical browser event normalization, rendering, clipboard, replay and
  localStorage remain JavaScript. There is no decoder fallback if WASM fails.
- The offline standalone HTML embeds the same WASM and modules using data URLs.
- tests/reference is frozen at the Japanese milestone (ae6ff593). Do not implement
  features there. Keep it until migration confidence is sufficient, then retire
  it while retaining native/WASM fixtures.

## Validation

- Native Rust acceptance, dictionary isolation/atomicity, composition, commit and
  protocol tests pass.
- Existing Node behavioral tests now execute against WASM.
- Differential tests compare full candidate order, scores and traces on 1,437
  inputs across three dictionary states against both native Rust and WASM.
- Headless Chrome checks pass for localhost and standalone: physical-key typing,
  backspace, candidate selection, Enter/Escape, trilingual output and persisted
  custom dictionary reload.
- Missing-WASM browser test confirms a visible error and disabled input.
- cargo clippy --workspace --all-targets --locked -- -D warnings passes.
- Actual user keyboard testing of the migrated build remains useful. Caret
  replacement, native undo/redo, clipboard and WebMCP are not fully validated.

## Build and development

See README for setup. Rust 1.95.0 and Node 26.8.1 were used for the migration.
wasm-bindgen library and CLI must both be 0.2.128. Cargo.lock is checked in.
npm test builds native Rust and WASM and runs the suites; npm run build:standalone
also rebuilds WASM. web/pkg and target are generated/ignored. Regenerate the
checked-in standalone after source changes. npm start only serves local files.

## Remaining limitations and next work

The prototype profile still has 181 Chinese rows including duplicates/alternatives.
Expanded Chinese coverage is substantially larger; imported word frequencies only
order alternatives and are not pronunciation-conditioned or a calibrated language
model. English membership and the Japanese kanji map remain small. No contextual
model, learning or typo model. Do not hardcode evaluation sentences into the lexicon.

Global beam pruning can crowd out languages. Literal-space boundaries remain
deliberate for now; do not remove them during dictionary work without agreement.
The playground is not browser-native composition, and partial phonetics can commit.
With English enabled, a literal candidate is retained even for arbitrary input;
without English, unsupported input may have no interpretation.

Shift/CapsLock, firmware remapping and virtual keyboards need testing. Physical
Semicolon with Shift still maps to colon rather than Colemak uppercase O.
Native undo integration and OS-composed input handling remain incomplete.

Custom entries are browser-local, with no import/export. Original browser-local
entries were never in the ZIP. File-URL storage can vary between browsers.
The optional feature-detected WebMCP registration is unverified.

Next: stronger phrase/pronunciation ranking and English candidate retention,
guided by a larger independent corpus and user typing. Choose the first native target based on the
user's desktop needs; do not infer it merely from the coding environment.
A native adapter will need a separately designed platform boundary (possibly a
C ABI). The web remains a consumer of this same engine.

Original project code is MIT licensed; see LICENSE and THIRD_PARTY.md. McBopomofo MIT and historical
libtabe notices are retained and bundled; corpus attribution/terms are in eval/.
Evaluate additional code/data licenses before further imports or distribution. Never send typed
content to external services or publish the demo without user authorization.
