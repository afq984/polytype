# English-island sprint

Plan frozen before experiments. Two user captures diagnose different failures:
`p95 latency` is pruned at the space after `p95`; `跟claude` cannot switch
after a first-tone space under the current boundary contract. User-provided text
is development evidence, not held-out accuracy. No browser/host metadata is kept.

Compare independently: (1) continuation-language retention within beam 12;
(2) stronger per-syllable discarded-key penalties beyond three discards;
(3) cautious letter-digit evidence when Zhuyin has conflicting slots;
(4) experimental switching after first-tone completion only. Compare combinations
only after their independent results. Do not populate dictionaries from cases.

Shipping gates: preserve every prior correct top-one and acceptable top-five
from existing evaluations; preserve Chinese correction/unordered input and
Japanese script selection, literal fallback, disabled languages, native/WASM and
prototype parity. Recover the first capture's English island at top one without
requiring a Chinese homophone tie-break. Check both layouts and every prefix of
Chinese controls. Report all regressions, including experimental ones.

Keep total beam 12. Measure five alternating WASM rounds against the current
family-v1 snapshot; target <=15% median p95 increase for this sprint and report
the baseline explicitly (not a cumulative budget). Do not ship unmeasured tuning.
First-tone switching is diagnostic-only, not a default behavior change. No general
intra-token splitting, dictionary expansion or homophone scoring in this sprint.

Aside: user reports Colemak `dljjo;i` (`shinnyou`) yields `しんにょう` instead
of intended `しんよう`. Deferred doubled-n issue; apostrophe behavior is intended.

## Measured outcome

Ship continuation retention only, ranking `scowl-context-v4+family-v1+island-v1`.
Each offset protects the best state needed to retain enabled EN/JP/TW continuation
possibilities. A language-unset state covers all three; otherwise up to three
states are protected from pruning. Protection consumes the existing 12 slots,
never adds slots. Family caps apply to the remaining choices. Final display uses
the existing score/family ordering and independent literal-English fallback.
No score, dictionary, language-boundary or prototype changes ship.

Across 376 rows (163 existing configurations, 73 island/probe/control cases and
140 Chinese typing prefixes), no previously correct top-one or acceptable
top-five target was lost. The frozen baseline was independently checked against
the pre-edit family-v1 WASM snapshot. No Chinese-control prefix top-one changed.
These counts describe synthetic/development coverage, not independent sentences.

The p95 capture now has `量到的 p95 latency 曾加了 11.6% 還在範圍之內`
first and the `增加了` version second, both at 91.55. The structural Chinese
homophone/segmentation tie is deliberately not changed. Existing six-sentence and
Chinese evaluation accuracy are preserved.

The single-space `跟claude` capture still cannot express the intended boundary.
Retention changes its top result to `… herdr f; claude 討論`: English survives
but the bridge is still incorrect, not counted as recovery. A second Space after
`跟` still produces `… herdr 跟 claude 討論`. The demo now explains this rule.

Independent ablations are in [island-experiments.json](island-experiments.json):

- Extra discarded-key cost beyond three per syllable changed no full-input or
  Chinese-prefix top-one. Retained as a native diagnostic, not shipped scoring.
- Identifier evidence alone also recovered p95, but was unnecessary with
  retention. Do not change scores for a redundant improvement on this small set.
- Unpenalized first-tone switching recovered `跟claude` but caused 15 existing
  top-one/top-five regression events and 24 Chinese-prefix top-one changes,
  including the old `This 尻a bug.` failure. The combined retention variant did
  likewise. This simple boundary relaxation fails; it does not prove that a
  future constrained design cannot work. Neither variant enters the web protocol.

Five alternating same-process WASM rounds over 4,883 prefixes measured a median
p95 ratio of 0.996 against family-v1 (roughly unchanged, not a claimed speedup).
See [island-latency.json](island-latency.json). This is an incremental comparison
against the preceding sprint, not its older pre-diversity baseline.

## Reproduce

```
cargo build --release --locked -p polytype-core --features diagnostics --bin polytype-search
node scripts/experiment-islands.mjs
npm test
```

The native CLI accepts `--experiment=baseline`, `floor`, `discards`, `identifiers`,
`first-tone`, or combinations joined by `+`; experiment requests require width 12.
Ordinary diagnostics still support widths 5–192. `--baseline` retains the original
pre-family behavior; `--experiment=baseline` means the frozen family-v1 baseline.
The ordinary browser/API does not accept experiment names or flags.

For timing, preserve a built family-v1 WASM/engine snapshot outside the repo and
pass its engine path as `BASELINE_ENGINE` below. The script validates every frozen
baseline result before timing and fails if the 15% median p95 budget is exceeded.

```
node scripts/benchmark-search.mjs BASELINE_ENGINE eval/island-latency.json eval/island-baseline.json
```
