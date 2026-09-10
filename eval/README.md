# Text evaluation

The [candidate-diversity experiment](DIVERSITY.md) adds frozen synthetic controls,
native-only wider-beam diagnostics, explicit baseline comparisons, and same-machine
latency measurements. Its finite search results are not a dictionary-reachability
oracle; see diversity-report.md for remaining cases and methodological limits.

Run `npm run evaluate` to rebuild WASM and regenerate REPORT.md and report.json.
Evaluation is entirely local. For your own cases, run
`node scripts/evaluate.mjs /path/to/cases.jsonl` after building WASM. Each line is
`{"id":"optional","raw":"QWERTY-encoded keys","text":"expected output"}`.
Local-file results go to stdout; the bundled report is not overwritten.
Optional `options` fields select layout and enabled languages. The demo's
Save test case / Export cases workflow creates compatible JSONL, after the user
reviews or corrects the expected output. Exports do not contain custom dictionary
entries; restore those separately when reproducing custom-dependent cases.

## What this measures

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

`npm run corpus:verify` is a separate, explicit network action. It checks each
excerpt against the pinned upstream sentence and records the source checksum.
`npm run dictionary:import` never reads eval/.

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
