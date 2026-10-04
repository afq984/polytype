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
| QWERTY | current | 65 / 107 | 65 / 105 | 111 / 128 | 44 / 48 → 44 / 48 |
| QWERTY | target | 78 / 117 | 78 / 117 | 111 / 128 | 44 / 48 → 44 / 48 |
| Colemak | current | 65 / 106 | 65 / 104 | 111 / 127 | 44 / 48 → 44 / 48 |
| Colemak | target | 78 / 116 | 78 / 116 | 111 / 127 | 44 / 48 → 44 / 48 |

Across 1,152 numeric configurations, top one is 572 → 888 and top five
888 → 1,020. There are 320 top-one gains and four losses, and 140 top-five
gains and eight losses. All eight losses are in the new synthetic set:
`numbers-counts-07-target-{qwerty,colemak}-{en-zh,all}` loses top-five 今天19 份;
`numbers-dates-12-target-{qwerty,colemak}-{en-zh,all}` loses top-one/top-five
明天04/16. `19␣` cleanly reads 掰, and `04/16` reads 案甭 without discarded keys.
The clean-Chinese guard removes the old unconditional first-tone numeric bonus.
These are conservative ambiguity regressions, not corrected expectations.

The numbers-v2 prefix refinement keeps a clean unfinished Zhuyin syllable at
top one and its numeric reading below it. Relative to numbers-v1, top one falls
112 → 111/144 in every mode: `numbers-units-12-{current,target}-{qwerty,colemak}-{en-zh,all}`
(`只剩 5`) moves rank one → two because final `5` is clean pending ㄓ. All numeric
top-five targets survive. No evaluation target is changed to accept this output.

The existing targets have no losses in either layout. GSD remains 16/20 top one
and 18/20 top five; Japanese remains 75/100 and 86/100. Kana-level guards and
mixed-six targets are retained. ASCEND current contracts and every Chinese-only
group are unchanged; target Colemak gains one top-one case in each language mode
(182 → 183 EN+ZH, 180 → 181 all, out of 300). English remains 192/200 top one,
200/200 top five and 8/200 wrong-language per layout. Historical 376-row native
ablations and prototype parity remain frozen. `current+no-numbers` reproduces
main candidate arrays and scores for all 5,624 measured configurations.
`current+no-numeric-prefix` reproduces numbers-v1 full candidate traces on the
same 5,624 inputs.

Every-prefix revisions are lower than main in all eight Chinese groups. A
revision means output ceases to start with the preceding prefix's output and
includes ordinary phonetic updates. The initial eight frozen prefix-display
migrations are reverted: `5`, `5j`, `5j/`, `wu0` show the original Zhuyin in
both layouts. Clean pending keys also stay phonetic after first-tone Chinese,
fixing temporary Latin displays already present in main. The remaining changed
outputs are primarily those improvements, not newly numeric Chinese prefixes.

| Prefix group | Prefixes | Changed outputs | Revisions main → numbers-v2 |
| --- | --- | --- | --- |
| Controls QWERTY EN+ZH | 298 | 35 | 103 → 97 |
| Controls QWERTY all | 298 | 35 | 125 → 122 |
| Controls Colemak EN+ZH | 298 | 36 | 102 → 97 |
| Controls Colemak all | 298 | 36 | 103 → 98 |
| GSD QWERTY EN+ZH | 733 | 29 | 253 → 238 |
| GSD QWERTY all | 733 | 29 | 263 → 248 |
| GSD Colemak EN+ZH | 733 | 27 | 252 → 238 |
| GSD Colemak all | 733 | 27 | 254 → 240 |

There are 254 changed outputs across 4,124 prefixes. Detailed rows live in the
external stream report and generated `prefixes.json`. An event-by-event audit
finds zero newly added revisions and 77 removed revisions; no individual
Chinese control or GSD case has a higher revision count than main.

The existing alternating WASM benchmark covers 6,337 prefixes, one warmup plus
five alternating rounds. Median p95 ratio against the preserved main WASM is
1.0374 (budget 1.15). Individual ratios vary 0.9861–1.2167 under shared host load;
two rounds exceed 1.15; the median remains within the required budget. The
measurement excludes initialization and browser rendering.
All seven Bazel targets pass, including Chrome smoke, native/WASM numeric parity,
empty-constraint parity, correction, formatting and clippy (113 Node passes,
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
