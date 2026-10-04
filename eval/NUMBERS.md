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

Main `32b96ff1` baseline (exact top one / top five):

| Layout | Contract | EN+ZH numeric / 144 | All numeric / 144 | Controls / 48 |
| --- | --- | --- | --- | --- |
| QWERTY | current | 65 / 107 | 65 / 105 | 44 / 48 |
| QWERTY | target | 78 / 117 | 78 / 117 | 44 / 48 |
| Colemak | current | 65 / 106 | 65 / 104 | 44 / 48 |
| Colemak | target | 78 / 116 | 78 / 116 | 44 / 48 |

Reproduce with a Bazel-built runtime module (the checkout has no generated WASM):

```sh
bazelisk build //:demo
bazelisk run //:evaluate_local -- --extra-cases="$PWD/bazel-bin/demo.runtime/eval/numbers-cases.mjs"
```

The stream report records paired results, every target loss, typing-prefix churn
and alternating WASM latency against the preserved main snapshot.
