# Text evaluation

Expanded Chinese now uses [log-frequency unigram scoring](../docs/CHINESE-SCORING.md)
and a 40k phrase cut: 17/20 top one, 19/20 top five, 1.3% CER on the Chinese
development excerpts. At the original 20k cut, scoring alone gives 14/20 and
18/20; all 104,221 positive-frequency phrases give the same accuracy as 40k.
English/Japanese controls and prior correct targets are retained. First-tone
switching remains diagnostic-only. Older milestone results below are historical.

For the next benchmark, see [the external collection and review protocol](COLLECTION.md).
`bazelisk run //:corpus -- init /absolute/private/polytype-corpus` prepares an
empty external collection. It supports capture import, provenance/review checks,
grouped split validation, frozen snapshots and private report output. New source
text and annotations stay outside every repository and Bazel input. This is
preparation; no new user-confirmed benchmark has been collected yet.
The [English-island experiment](ISLANDS.md) compares continuation retention,
discard penalties, identifier evidence and a diagnostic-only first-tone boundary
variant against a frozen family-v1 baseline. Only retention ships; see the report
for the remaining boundary failure and rejected variants.

The [candidate-diversity experiment](DIVERSITY.md) adds frozen synthetic controls,
native-only wider-beam diagnostics, explicit baseline comparisons, and same-machine
latency measurements. Its finite search results are not a dictionary-reachability
oracle; see diversity-report.md for remaining cases and methodological limits.

Default reports omit host-dependent timings. Use `bazelisk run //:measure_evaluation`
for fresh latency measurements on stdout. Historical reports retain their original timing data.

Run `bazelisk build //:evaluation` to build WASM and generate REPORT.md and report.json under bazel-bin/evaluation/;
the checked-in copies were refreshed from that deterministic output after the Japanese dictionary import.
Evaluation is entirely local. For your own cases, run
`bazelisk run //:evaluate_local -- /path/to/cases.jsonl` after building WASM. Each line is
`{"id":"optional","raw":"QWERTY-encoded keys","text":"expected output"}`.
Local-file results go to stdout; the bundled report is not overwritten.
Optional `options` fields select layout and enabled languages. The demo's
Save test case / Export cases workflow creates compatible JSONL, after the user
reviews or corrects the expected output. Exports do not contain custom dictionary
entries; restore those separately when reproducing custom-dependent cases.
Current browser exports include `rawEncodingVersion: 2` and ranking suffix
`+physical-keys-v2`. The loader does not migrate supplied files: review older
Colemak colon captures using the [collection instructions](COLLECTION.md)
before evaluating them with the expanded profile.

PT-006 explicitly migrates Roman colon input for `mixed-02-colemak-all` and
`mixed-02-colemak-en-jp` (`10:00` raw becomes `10P00`) and
`diversity-mixed-meeting-colemak-all` and
`diversity-mixed-meeting-colemak-en-jp` (`14:30` becomes `14P30`). These four
rows occur in `diversity-baseline.json`, `diversity-after.json` and
`island-baseline.json`; their frozen bytes remain unchanged, with current test
inputs adapted explicitly by `physical-keys.mjs`. Generated mixed/control
cases use version-2 keys and keep `prototypeRaw` for the historical profile.
The two expanded mixed-02 rows in the refreshed `report.json` use `10P00`;
its two prototype rows retain the historical colon. Outputs/scores are unchanged.
The generated EWT Colemak cases `ewt-test-051`, `054`, `058`, `181`, `182`,
`183` and `187` likewise use `P` for Roman colon, with unchanged targets and
candidate outputs. No other stored raw fixtures require migration; the source
texts, annotation files and source selection are unchanged.

## Milestone diagnostics and extra cases

Each profile's existing `groups` keeps exact top-1/top-5, reading-level results
and full-text CER unchanged. New `configurationGroups` also separates every
named group by the effective layout and language flags (omitted options use the
core's Colemak/all-on defaults). The Markdown report shows each configuration
beside its exact counts. These diagnostics use committed candidate text:

- `spaceNormalizedTop1/Top5`: case counts after deleting only literal U+0020
  runs directly between Han and a Latin-script letter or ASCII digit, either
  order. Latin-to-Latin, Han-to-Han, leading/trailing spaces, tabs and other
  whitespace still count. This changes evaluation only; output spacing is unchanged.
- `englishExact`: matched target tokens / target tokens, pooled across cases.
  Tokens are maximal runs of ASCII letters/digits plus `'-_.`, with at least
  one letter/digit. Match whole tokens exactly, including case and punctuation,
  in order using the largest common subsequence; repeated tokens need separate
  output occurrences. This is recall; added output tokens are not penalized here.
- `hanCER`: summed edit distance / summed target Han characters after removing
  all non-Han characters from target and top-1 output. Uses Unicode Han script
  code points, including supplementary characters. Insertions count and CER may
  exceed 100%; it is separate from the original full-text CER.
- `wrongLanguage`: affected cases / eligible cases. Targets whose letters are
  exclusively Latin or exclusively Han are eligible; punctuation, spaces,
  numbers and symbols are neutral. Latin targets flag Han, kana or Bopomofo;
  Han targets flag Latin letters or Bopomofo (kana is not flagged there).
  Mixed-script, kana and digit-only targets are excluded. Han-only Japanese
  words are indistinguishable from Chinese by this script check.

Counts/denominators accompany each new rate. A rate is `null` (`n/a` in Markdown)
when its target denominator is zero. A missing output fails exact matching and
loses its tokens/Han characters; an empty output has no wrong-script intrusion.
All visible cases remain development evidence. These metrics do not measure
correction actions or native IME behavior.

To add another development case module alongside the bundled cases:

```sh
bazelisk run //:evaluate_local -- --extra-cases=/absolute/path/to/cases.mjs
```

The module exports an array named `cases` (or a default array), with entries
`{id, group, raw, text, options, segments}`. Only raw/text are required; optional
segments/provenance are retained when loading and are never used to populate a
dictionary. Use a `group` for each corpus/stratum; configuration separation is
automatic. Repeat `--extra-cases` to append modules. A positional JSONL replaces
the bundled cases and can also be combined with extra modules. JSONL `group`
values are preserved (default `local`). Module runs print JSON to stdout and
never overwrite checked-in reports. `--timing` works with either input form.
Keep private inputs and redirected results outside every repository; external
private snapshots should use `//:corpus` so text stays out of terminal/build logs.

## What this measures

japanese-words.json contains the first 100 long-unit words tagged NOUN, PROPN,
VERB, ADJ or ADV from the test file of
[UD Japanese GSD](https://github.com/UniversalDependencies/UD_Japanese-GSD/tree/7bc20119f476b552635e0640644e577b6fd3606b)
(32 sentences) whose surface equals their lemma and contains kanji or katakana.
Readings are the treebank's UniDic long-unit lemma readings, converted to a
single conventional romaji spelling by eval/japanese-cases.mjs and validated by
composing them back. UniDic readings are independent of the IPAdic-derived Mozc
subset being evaluated; overlap between the dictionary's sources and the
treebank text is unknown. Each word runs in QWERTY with Japanese only and with
all languages, measuring whole-token conversion of isolated words, not sentence
conversion. `bazelisk run //:verify_corpus` checks every case against the pinned
file and retains the treebank license (CC BY-SA 4.0).

Kana-annotated targets (guards, mixed lines) are reported both exactly and at
the reading level, where an imported conversion whose kana reading equals the
target span counts as correct. The exact columns record that kanji is now
offered; the reading columns record whether segmentation and language choice
are right. Kanji choice itself is measured by the Japanese word group.

corpus.json contains 20 contiguous excerpts from the first 35 test sentences in
[UD Chinese GSD](https://github.com/UniversalDependencies/UD_Chinese-GSD/tree/22f73e87f7ddc530bb131a6b7587971a03e1a712).
The source is encyclopedic text, not conversational typing. Excerpts exclude
digits, unsupported punctuation and foreign proper names. Selection and Zhuyin
annotations were made before evaluating the expanded lexicon. No readings are
derived from the dictionary being evaluated. The original source transcriptions
are not used as gold pronunciations; annotations use Taiwan citation readings.

These are development diagnostics, not a blind test or a representative accuracy
estimate. After the first run, source-frequency ordering was promoted ahead of
prototype ordering using observed homophone errors. Thus the reported result has
already informed development. Overlap between the upstream dictionary's frequency
corpus and these source articles is unknown. Larger independent material and
actual user-keystroke logs are the next step.

The 22 guard cases are separate: existing acceptance fixtures and synthetic
English/Japanese/mixed examples. They are not counted as sourced real text.
Five user-feedback cases are reported separately: the code-loop empty-preedit bug, the conclusion ranking bug,
the full mixed 注音 priority sentence, the exact `Fhld ld a bit.` buffer (Colemak
`This is a bug.`), and a short-word/trailing-period variant. These are explicit
development regressions, not unseen evaluation samples.

`mixed-text.json` preserves six user-supplied Japanese/English lines exactly.
Each is evaluated in Colemak and QWERTY, with all languages and with EN+JP only
(24 configurations, not 24 independent sentences). Kana/literal targets are
provisional developer annotations: retain Latin names/technical terms, including
both `Tanaka / tanaka`, and convert Japanese spans to hiragana. Kanji and spelling
normalization such as とおる → 通る or きょうゆう → 共有 are not required.
The user has not confirmed these targets. No sample vocabulary is imported into
the runtime dictionary. Native/WASM parity includes the options for every case.

Initial mixed-text result: 0/6 top 1 and 0/6 top 5 in each configuration. Turning
Zhuyin off reduces CER to 41.0% in both layouts, versus 46.9% Colemak / 45.8%
QWERTY with all languages. Both are still failures. Passing safety regressions
check every prefix for nonempty results and exact literal retention; six explicit
TODO tests expose the desired QWERTY EN+JP outputs rather than bless bad output.

Initially observed causes, from token composition and candidate traces:

- Attached periods/commas reject otherwise composable Japanese (`mawasu.`,
  `de,`, `fuanteide,`); stripping them only in English scoring is insufficient.
- English words that are valid romaji (`rebase`, `filename`) convert to kana;
  short Japanese (`no`, `ha`) competes poorly against English/context scores.
- With Zhuyin enabled, numeric `16` converts to ㄅˊ and branches can crowd out
  mixed candidates, leaving only the reserved full-literal fallback.
- Proper names remain ambiguous: the current engine lowercases Japanese input,
  so `Tanaka` can become たなか despite the provisional preserve-Latin target.

The first implementation follow-up handles trailing periods, commas and
semicolons within Japanese interpretations, preserving punctuation and completing
pending n. It also gives numeric tokens following EN/JP literal evidence (2.5
score points per digit); standalone and Chinese-context tone keys keep prior
scoring. No vocabulary was added, and the prototype profile is unchanged.

Exact mixed-text results remain 0/6 top 1 and top 5, but EN+JP CER improves
41.0% → 22.5% in both layouts. All-language CER improves 46.9% → 30.3% in
Colemak and 45.8% → 29.2% in QWERTY. Chinese evaluation and existing acceptance
guards are unchanged. These development results informed the implementation;
they are not an independent estimate of generalization. The six TODO targets
remain visible. Next: technical-word/name evidence and contextual ranking,
especially short Japanese words and mixed paths lost to beam pruning.

## First ranking sprint

Expanded engines now use an independently imported SCOWL spelling list (101,191
entries; English/American words and contractions through level 60). Lower coverage
tiers give stronger lexical evidence; these are not frequency probabilities.
Source archive and per-file hashes are pinned in data/english-source.json. The
importer does not read these examples. This removes many literal-English errors
without special-casing sample vocabulary, though technical vocabulary is incomplete.

The sprint also adds equal EN/JP continuity, soft case cues, a penalty for explicit
small kana inside words, and context-gated particle evidence. Short particles
alone cannot seed Japanese context (English `ha ha` remains literal). The weights
were checked against development cases and guards, not tuned on an independent
held-out set. Data overlap with upstream SCOWL contributors is not measured.

Results: 4/6 exact top 1 and top 5 in all four configurations, versus 0/6 before
the sprint. EN+JP CER drops 22.5% → 5.9%; all-language Colemak 30.3% → 19.9%
and QWERTY 29.2% → 14.0%. Cases 1, 2, 4, 5 are now ordinary passing tests;
3 and 6 remain TODO, with rebase/mite, name ambiguity and mixed-beam loss still
visible. All 22 previous guards and five previous feedback cases pass; Chinese
metrics are unchanged. Additional synthetic English/case/particle controls pass,
but these are development safety checks, not evidence of broad typing accuracy.

Metrics:

- Top 1 and top 5 compare committed text exactly, including spaces and variants.
- Character error rate is Unicode-character Levenshtein distance divided by total
  target characters. Insertions count, so the rate can exceed 100% when phonetic
  or raw-key fallbacks are compared to Chinese characters.
- Dictionary-reachable means some segmentation can produce the annotated target
  with matching readings, ignoring beam pruning and ranking. It is an oracle
  coverage check, not a candidate-selection or user accuracy metric.
- Prefix latency measures decoding each prefix once with an already-loaded WASM
  module. It excludes fetching/compiling WASM and browser rendering. It is a
  diagnostic run, not a controlled performance benchmark.

`bazelisk run //:verify_corpus` is a separate, explicit network action. It checks each
excerpt against the pinned upstream sentence and records the source checksum.
`bazelisk run //:import_chinese` never reads eval/.

## First experiment

Initial expanded vocabulary with prototype entries ordered first: 10/20 top 1,
17/20 top 5, 6.9% CER. Imported frequency ordering before prototype fallback raised
this to 12/20 top 1, 17/20 top 5, 5.6% CER. No words or sentences were added from
the evaluation set. The original profile scored 0/20 and 217.6% CER.

All 20 targets are now dictionary-reachable. The remaining misses point to
segmentation, heterophonic readings and homophone ranking. Importing a word's
occurrence count is not the same as knowing the frequency of each pronunciation.

The two failing English guards already failed at top 1 in the prototype. One
loses its correct top-5 alternative after expansion, and guard CER worsens from
9.5% to 15.9%. Do not hide this by reporting only Chinese gains. Language-aware
pruning and stronger English vocabulary were identified as follow-up work.

## Language-ranking follow-up

Without adding dictionary words, positive literal-English spelling evidence,
a small English continuity bonus, and penalties for discarded Zhuyin keystrokes
restore both English guards: expanded now scores 22/22 top 1 and top 5, with
0% guard CER. Chinese results remain 12/20 top 1, 17/20 top 5 and 5.6% CER.
All five feedback cases pass top 1. Trailing punctuation is retained; the mixed
sentence also exercises a narrow attached-possessive exception to space boundaries.

The expanded profile now differs in ranking as well as vocabulary. The prototype
profile retains legacy scoring for frozen-reference parity, so this comparison
is not a dictionary-only ablation. English continuity intentionally changes
`hello kan` to English by default; explicit kana selection still commits
`hello かん`. General kana composition and the existing trilingual guards pass.

The code-loop fix reserves one of the five results for a literal-English path
when English is enabled. That path is decoded independently so global beam
pruning cannot erase it. It may replace the fifth phonetic result; this run's
Chinese top-five metric remains unchanged. Layout/language-option tests also
exercise QWERTY and all eight language subsets separately from this default-profile report.

## Attribution

UD Chinese GSD contributors: Mo Shen, Ryan McDonald, Daniel Zeman and Peng Qi;
Traditional Chinese treebank annotated and converted by Google. Upstream lists
CC BY-SA 4.0 for its annotations and notes that Google does not own the underlying
Wikipedia text. Source README, license notice, revision, sentence IDs and checksum
are retained in sources/ and corpus.json.

This evaluation adapts the source by selecting excerpts and adding Zhuyin input
annotations. Preserve attribution and the [CC BY-SA 4.0 terms](https://creativecommons.org/licenses/by-sa/4.0/)
for these adapted corpus annotations. These data terms do not license the rest
of Polytype's code. Generated reports retain the same source attribution through
this directory; no corpus text is bundled into the runtime dictionary.

## Chinese + English development data

`eval/zh-en/ascend.json` contains 300 mixed utterances and 50 Chinese-only
controls from the **test** CSV of [CAiRE/ASCEND](https://huggingface.co/datasets/CAiRE/ASCEND/tree/b966160952fc5fe9cb036f098dd44f135d5c6f20).
The source is Hong Kong conversational Mandarin-English speech, originally in
Simplified characters. It includes fillers, repetitions and incomplete thoughts;
this is development evidence, not private held-out data or representative Taiwan
keyboard input. Audio, train and validation splits are never downloaded.

Selection is deterministic source-file order: first 300 mixed (Han plus ASCII
Latin letters) and first 50 Han-only utterances passing the documented encoding
and length filters. Of 1,315 test utterances, 379 contain Han and Latin; 21 Han
utterances contain annotation markup (`[UNK]`) and are excluded. After markup
exclusion there are 358 mixed and 679 Chinese-only eligible utterances. One
prospective selected mixed utterance failed the historical Colemak uppercase-O filter;
no utterance is excluded by the conservative 400-key length bound. Counts and
original transcripts/source row identifiers are retained in the data. These are
selected excerpts from an ordered corpus, with speaker/topic clustering, rather
than a random sample.

OpenCC **1.1.9**, pinned at `556ed22496d650bd0b13b6c163be9814637970ae`, provides
the offline s2twp conversion dictionaries: maximal-match STPhrases/STCharacters,
then merged TWPhrasesIT/Name/Other, then TWVariants. The small Node implementation
in `scripts/zh-en-annotation.mjs` chooses each dictionary's first alternative;
ambiguous alternatives and length-changing conversions enter the review queue.
Conversion runs only during corpus import, never inside the decoder. OpenCC's
Apache-2.0 license is retained under `eval/sources/`.

Readings come from **CC-CEDICT**, independently of the dictionary under test.
The pinned May 28, 2026 MDBG export is fetched from an immutable
[tea-data source snapshot](https://github.com/steventango/tea-data/blob/e9b90d085dded03d7bce5e52d7a65844d53c67f1/cedict_ts.u8)
(the exact revision and SHA-256 in `eval/sources/zh-en-pins.json` are authoritative).
This mirror is used to make the export reproducible rather than fetching MDBG's
moving latest release. The importer uses longest word matches, retains source
line evidence and all candidate pinyin readings, prefers explicit `Taiwan pr.`
readings, and converts numbered citation pinyin to Zhuyin without tone sandhi. 一 is always ㄧ and 不 always
ㄅㄨˋ, including 不是; third-tone sandhi is never written.
Ambiguous candidates receive a deterministic provisional reading, preferring a
Taiwan entry and then a non-name entry, never choosing from McBopomofo.

Every selected syllable is compared with the expanded/prototype single-character
readings accepted by the evaluated engine. Disagreements, single-character
polyphones without word-level evidence, word ambiguity, conversion alternatives,
erhua/unsupported readings and unmapped characters enter `eval/zh-en/review.json`.
Unresolved entries stay `review: "pending"`; all flagged items resolved by the model
become `review: "model-reviewed"`, with reviewer/date provenance, never
`confirmed`. `review: "automatic"` means no detected
issue, **not** human-approved gold. These auto-annotations cannot guarantee Taiwan
citation pronunciation or conversational intent. The stream's full human-readable
queue is in the out-of-tree stream report `data-review.md`, which is not part of
the public corpus. Unmapped entries remain in the corpus and are listed
by the generator's `zhEnSkipped`; they do not silently receive dictionary readings.
The manifest records the evaluated dictionary hashes used for this comparison.

`eval/zh-en/adjudications.json` contains explicit decisions keyed by source case
and local issue index, guarded by the issue type, character, segment/offset or
conversion stage/offset. Import rejects stale positions, unknown fields/cases,
duplicate indices, inconsistent overlapping readings and unsupported conversions.
Provisional CC-CEDICT evidence is retained alongside adjudicated readings. Each
resolved queue item retains its decision, reason and high/low confidence; a
low-confidence choice still counts as model-reviewed, not user-confirmed.
Original source selection, transcripts, keyboard contracts and runtime dictionaries
are unchanged. The retained conversion queue uses Unicode-character offsets.

The amended annotation convention uses Taiwan particles and conventional suffixes
with neutral tones (的、了、嗎、呢、吧、啊、們、麼、得、著、子; also discourse
嘛、呀 and the MOE acknowledgment particle 嗯). Lexical words use full citation
tones: 起來 ㄑㄧˇ ㄌㄞˊ, 時候 ㄕˊ ㄏㄡˋ, 學生 ㄒㄩㄝˊ ㄕㄥ, 還是 ㄏㄞˊ ㄕˋ,
東西 ㄉㄨㄥ ㄒㄧ, 不是 ㄅㄨˋ ㄕˋ, 個 ㄍㄜˋ. A corpus-only neutral-word detector
adds positional `lexical-neutral-tone` flags where original coverage checks missed
light compound syllables (那個/這個/一個、爸爸、關係); the replacements still come
from explicit review data, not the evaluated dictionary. The initial 749 issues
and these additional 103 flags are adjudicated; 290 utterances are model-reviewed
and 60 remain automatic. This does not constitute an exhaustive review of every
unflagged syllable or conversion. User spot-checks of uncertain discourse fillers
and disfluent fragments remain useful.


ASCEND English is mostly lowercase, with capitalized names, `I`, acronyms and
spelled-out letters (e.g. `G P A`); 44 selected mixed utterances contain capitals.
Apostrophes are the only non-markup punctuation in the full test transcripts.
Spelling, case, internal spaces, fillers and repetitions are retained. We recommend
no automatic case/spelling cleanup for this diagnostic. A future transcript
normalization experiment should be a separate annotated variant.

`eval/zh-en/english-only.json` contains the first 200 representable **test**
sentences of [UD English EWT](https://github.com/UniversalDependencies/UD_English-EWT/tree/4a4d77f599ea53cc405f85d0cec4b2f14f81d42b),
with 4–25 integer-ID tokens, printable ASCII sentence text, at most 400 raw units,
and an exact Colemak round trip. Of 2,077 test sentences, 1,409 meet the token
range; 88 fail the encoding filter across the whole eligible split. The filter
conservatively limits this guard to ASCII keyboard text and excludes Unicode
punctuation as well as the historical Colemak uppercase-O limitation (PT-006).
PT-006 fixes uppercase O in the engine and case encoder. The importer explicitly
retains that historic uppercase-O exclusion for both ASCEND and EWT so this
task does not change source selection. Removing it would make 86 additional
EWT sentences eligible and change the first-200 guard. This requires a separate
corpus-selection update.
Apostrophes, hyphens, case and representable punctuation remain exact. Both layouts
use the same source sentences with all three languages enabled.

`eval/zh-en-cases.mjs` exports `zhEnCorpus`, `englishOnlyCorpus`, `zhEnCases`,
`englishOnlyCases`, `zhEnSkipped`, `cases` and `generateZhEnCases(entries, {spacing})`.
Each ASCEND entry yields eight cases: QWERTY/Colemak × EN+ZH/all languages ×
`current`/`target`. Chinese controls have separate `zh-only-*` groups. English
controls yield two `en-only-*` cases. Cases carry `sourceId`, source segments,
options and review status so downstream metrics can separate provisional targets.
The generator reuses Rust/WASM `readingKeys` and the existing case-preserving
Colemak encoder. `cases` supports the evaluator's optional `--extra-cases` hook.
These 3,200 configurations are not added to `eval/cases.mjs` or tracked
`eval/report.json`. Instead, `//:baseline_zh_en` uses the shared milestone metrics
in `scripts/evaluation-metrics.mjs` and writes the deterministic aggregate-only
[Chinese/English summary](zh-en/REPORT.md). Each group is split into all,
review-pending, model-reviewed and automatic; EWT guards have no reading queue and appear under
automatic. No detected annotation issue does not mean human-approved gold.
The summary includes exact/space-normalized top-1 and top-5, pooled English exact,
Han CER and wrong-language counts with denominators, and omits timings and case
text. Unlike the generator's optional all-space scoring view, the shared summary
normalizes only Han/Latin and Han/digit boundary spaces, preserving English
internal spaces and Han/Han spaces.

The `current` contract types a separator at each language change, in addition to
any first-tone completion Space. The `target` contract uses the first-tone Space
as the only switch Space after such a syllable. Expected output follows literal
spaces exactly: `剛␣call` for current, `剛call` for target. A single transcript
space at a language boundary supplies the required separator, rather than adding
a duplicate; extra transcript spaces remain literal. Whitespace/punctuation-only
source spans are recorded as `lang: "en", kind: "literal"` and keep their original
keys without creating a language switch. `spacing: "typed"` is the default;
`spacing: "normalized"` removes spaces only in the expected scoring view. This
single parameter does not change decoder output spacing or establish final policy.

ASCEND text and adapted CC-CEDICT annotations retain **CC BY-SA 4.0**, with dataset
citation, export header and license links in `eval/sources/`. EWT retains its
**CC BY-SA 4.0** license and upstream README. No evaluation text or pronunciation
annotation is added to `data/` or compiled into either demo. Each committed data
file is below 1 MB; full upstream dictionary files are temporary downloads only.

```sh
bazelisk run //:import_zh_en                 # explicit network import, pinned hashes
bazelisk run //:verify_zh_en                 # fetch, hash-check and reproduce without writes
bazelisk run //:import_zh_en -- --from-dir=DIR # same source basenames, offline reproduction
bazelisk run //:verify_zh_en -- --from-dir=DIR
bazelisk run //:baseline_zh_en               # refresh aggregate eval/zh-en/REPORT.md
bazelisk test //...                         # offline data hashes, contracts, native/WASM parity
```

All source URLs/revisions/hashes live in `eval/sources/zh-en-pins.json`.
`eval/zh-en/manifest.json` checks generated corpus and retained notices offline;
network verification checks both pinned inputs and byte-identical reproduction.
The import's dictionary comparison is diagnostic only; a dictionary change may
require explicitly regenerating its comparison/review metadata. Initial baseline
counts include pending readings and must be interpreted alongside the review queue.
