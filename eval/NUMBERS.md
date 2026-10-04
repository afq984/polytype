# Numeric development set

`numbers-cases.mjs` contains 144 hand-authored synthetic mixed sentences and 48
Chinese adversarial controls. These public development annotations are neither
sourced conversational data nor held-out evidence. Twelve categories cover
counts, units, money, times, dates, percentages, scores, ranges, versions, models,
identifiers and punctuation. Chinese prefixes include both first and other tones;
numeric spans occur at the start, middle and end. The controls include ordinary
digit-key words, first-tone continuations and 心電圖. No dictionary is changed.

Readings follow owner-style typing: 不 uses ㄅㄨˊ before fourth tone, 一 has
sandhi, 個 is ㄍㄜ˙, particles are neutral, and third-tone sandhi is unwritten.
This differs from ASCEND's remaining citation 一/不/個 annotations. Readings are
hand annotations, independent of the runtime dictionary; homophone misses count
as failures rather than being relabelled.

Each sentence runs in QWERTY/Colemak, EN+ZH/all languages and current/target
contracts: 1,536 configurations, including 384 repeated control configurations.
The current contract inserts a literal Space at each switch; the target reuses a
preceding first-tone Space. Every literal Space prints; tone Spaces print nothing.
The two contracts coincide at non-first-tone boundaries and on Chinese controls.

Paired against main `32b96ff1` (exact top one / top five). New numeric results
are identical between the two contracts and between EN+ZH/all modes:

| Layout | Contract | Before EN+ZH / 144 | Before all / 144 | After numeric / 144 | Controls before → after / 48 |
| --- | --- | --- | --- | --- | --- |
| QWERTY | current | 65 / 107 | 65 / 105 | 112 / 128 | 44 / 48 → 44 / 48 |
| QWERTY | target | 78 / 117 | 78 / 117 | 112 / 128 | 44 / 48 → 44 / 48 |
| Colemak | current | 65 / 106 | 65 / 104 | 112 / 127 | 44 / 48 → 44 / 48 |
| Colemak | target | 78 / 116 | 78 / 116 | 112 / 127 | 44 / 48 → 44 / 48 |

Across 1,152 numeric configurations, top one is 572 → 896 and top five
888 → 1,020. There are 328 top-one gains and four losses, and 140 top-five
gains and eight losses. All eight losses are in the new synthetic set:
`numbers-counts-07-target-{qwerty,colemak}-{en-zh,all}` loses top-five 今天19 份;
`numbers-dates-12-target-{qwerty,colemak}-{en-zh,all}` loses top-one/top-five
明天04/16. `19␣` cleanly reads 掰, and `04/16` reads 案甭 without discarded keys.
The clean-Chinese guard removes the old unconditional first-tone numeric bonus.
These are conservative ambiguity regressions, not corrected expectations.

The existing targets have no losses in either layout. GSD remains 16/20 top one
and 18/20 top five; Japanese remains 75/100 and 86/100. Kana-level guards and
mixed-six targets are retained. ASCEND current contracts and every Chinese-only
group are unchanged; target Colemak gains one top-one case in each language mode
(182 → 183 EN+ZH, 180 → 181 all, out of 300). English remains 192/200 top one,
200/200 top five and 8/200 wrong-language per layout. Historical 376-row native
ablations and prototype parity remain frozen. `current+no-numbers` reproduces
main candidate arrays and scores for all 5,624 measured configurations.

Typing-prefix costs are visible. On each mode's 298 control prefixes, 75 top
outputs change in both layouts. On 733 GSD prefixes per mode, 23 change in QWERTY
and 20 in Colemak. Controls gain 13–15 revisions; excerpts have 3–5 fewer.
A revision means output ceases to start with the preceding prefix's output and
includes ordinary phonetic updates. Eight frozen prefix displays change: raw
`5`, `5j`, `5j/` and `wu0` in each layout temporarily become numeric/identifier
text; completed Chinese targets remain unchanged. Detailed rows live in the
external stream report and generated `prefixes.json`.

The existing alternating WASM benchmark covers 6,337 prefixes, one warmup plus
five alternating rounds. Median p95 ratio against the preserved main WASM is
1.0032 (budget 1.15). This excludes initialization and browser rendering.
All seven Bazel targets pass, including Chrome smoke, native/WASM numeric parity,
empty-constraint parity, correction, formatting and clippy (112 Node passes,
four existing TODOs; seven native unit and twelve behavior tests).

Reproduce with a Bazel-built runtime module (the checkout has no generated WASM):

```sh
bazelisk build //:demo
bazelisk run //:evaluate_local -- --extra-cases="$PWD/bazel-bin/demo.runtime/eval/numbers-cases.mjs"
bazelisk run //:numbers_diagnostics -- MAIN_RUNTIME/web/engine.mjs OUT_DIR
bazelisk run //:benchmark -- MAIN_RUNTIME/web/engine.mjs OUT_DIR/latency.json OUT_DIR/main-results.json
bazelisk test //... //:browser_test --test_env=CHROME_BIN=/usr/bin/google-chrome-stable
```

The stream report records paired results, every target loss, typing-prefix churn
and alternating WASM latency against the preserved main snapshot.
