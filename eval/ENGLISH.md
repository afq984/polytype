# English frequency development evidence

Paired against built main `40a24133` after rebasing the English stack. These are visible development configurations, including reused source sentences, synthetic probes and frozen migration controls; no private held-out data was read. Vocabulary and targets stay unchanged. Scoring, pins and import reproduction are in [English scoring](../docs/ENGLISH-SCORING.md).

| Gate | Before | After |
| --- | --- | --- |
| EWT 200, each layout | 192 top one / 200 top five; 8 wrong-language cases | 193 / 200; 7 wrong-language cases |
| EWT English tokens, each layout | 1,929 / 1,933 | 1,930 / 1,933 |
| ASCEND target Colemak EN+ZH | 183 / 240 out of 300 | 184 / 240 |
| ASCEND target Colemak all languages | 181 / 238 out of 300 | 182 / 238 |
| Other six ASCEND mixed configurations | Existing top-one/top-five targets | Unchanged counts; no individual losses |
| ASCEND Chinese-only, all eight configurations | 40 / 43 out of 50; 0 wrong-language cases | Unchanged |
| GSD, both layouts | 16 / 18 out of 20 | Unchanged |
| Japanese 100, both layouts, JP/all modes | 75 / 86 | Unchanged |
| Six mixed lines, each layout/language mode | 4 / 4 at reading level; 1 / 3 exactly | Unchanged |
| Numeric 144, four QWERTY modes | 111 / 128 | Unchanged |
| Numeric 144, four Colemak modes | 111 / 127 | Unchanged |
| Chinese numeric-set controls, each mode | 44 / 48 out of 48 | Unchanged |
| Feedback six | 6 / 6 | Unchanged |

The complete paired run has 5,624 configurations, zero exact/reading top-one or top-five losses and four gains: ASCEND 0209 in the two target Colemak modes and EWT 040 in both layouts. Mixed English-token recall holds or improves in every group. The [updated aggregate summary](zh-en/REPORT.md) retains review strata and exact typed-space contracts.

Every one of the 4,124 GSD/Chinese-control prefixes has the same top output; revision counts are identical in all eight groups. The 376 frozen migration rows retain all preexisting targets. All five historical native ablations retain their original scores and candidates. Disabling English frequency reproduces main candidate arrays and scores on the wider 5,664-configuration native set. No frozen JSON file or target output expectation was changed.

## Fixed grid

Before inspecting scoring results, offsets 1.6/1.7/1.8 and log weights 0.05/0.1 were fixed, with reference rank 1,000, missing rank 200,000, floor 1.3 and cap 2.0. Choose among configurations with no individual target losses and no wrong-language increase, using English guard/recall gains and then Han edits. The final choice is 1.8/0.05.

| Offset | Log weight | Loss diagnostic rows | Gain rows | EWT top one per layout | EWT wrong language per layout |
| --- | --- | --- | --- | --- | --- |
| 1.6 | 0.05 | 10 | 0 | 191 | 9 |
| 1.6 | 0.1 | 10 | 4 | 192 | 8 |
| 1.7 | 0.05 | 0 | 2 | 192 | 8 |
| 1.7 | 0.1 | 6 | 4 | 192 | 8 |
| 1.8 | 0.05 | 0 | 4 | 193 | 7 |
| 1.8 | 0.1 | 8 | 4 | 193 | 7 |

Rejected points lose ASCEND 0579 (`i i mean`), ASCEND 0940 (a top-five `due` path), ASCEND 1061 (`info`), EWT 037 (`taken to`), or mixed line 04 (Japanese `no`). Full raw keys, before/after candidates and every loss are retained in the external English stream report. Mixed line 04 appears twice because the calibration set includes both current fixtures and frozen copies; loss rows are not independent sentences.

Initial whole-word frequency scoring also strengthened single-letter abbreviation evidence, making a Colemak uppercase-O word lose to Chinese colon plus letter. Existing physical-key and correction tests exposed this. Ordinary non-`a`/`i` letters now retain 1.5 symbol evidence; the same six points were rerun, without adding calibration points. `m` previously had tier 35 and score 1.8; it now uses 1.5. Target outputs and dictionary membership remain unchanged.

## Validation and latency

`bazelisk test //... //:browser_test --test_env=CHROME_BIN=/usr/bin/google-chrome-stable` passes all seven targets after the compact-data change: 119 Node passes and four existing TODOs. Native/WASM parity includes the new frequency branch, per-segment correction, English memory in Japanese context, explicit locks, atomic custom lists and engine isolation. Both hosted and standalone Chrome smoke checks ran.

Five alternating WASM rounds after warmup over 6,337 prefixes give median p95 ratio **0.831196**, within the 1.15 budget. Compact-build round ratios are 1.287076, 1.114907, 0.748552, 0.831196, 0.770998. The benchmark validates main snapshot candidates before timing. Shared-host variation is substantial; initialization, fetch/compile and rendering are excluded. This is not a portable speedup claim.

Reproduce the paired full-sentence and prefix gates with the existing diagnostic tool and a built main snapshot outside the checkout:

```sh
bazelisk run //:numbers_diagnostics -- MAIN_RUNTIME/web/engine.mjs OUT_DIR
bazelisk run //:benchmark -- MAIN_RUNTIME/web/engine.mjs OUT_DIR/latency.json OUT_DIR/main-results.json
```

## Compact data

The lossless table now packs 61,883 exact 17-bit ranks behind a SCOWL presence
bitset. It occupies 144,167 bytes; the manifest is 2,251 bytes and retained MIT
license 1,063 bytes. The binary layout and complete decoded-rank check are
[documented with the scoring model](../docs/ENGLISH-SCORING.md#compact-binary-layout).
Pinned cached imports reproduce all three files byte for byte.

On all 5,664 configurations, both native full traces and WASM candidate arrays
(including scores) exactly match the earlier TSV version. Quantization error is
zero; no compact-format expectation changes or output differences occur.
Against main `40a24133`, the complete native comparison has zero target losses,
four gains and no wrong-language increases. Disabling English frequency still
reproduces main's complete native traces. The fresh 5,624-row WASM paired report
and all 4,124 prefix outputs exactly reproduce the TSV run above.

Built WASM is 5,346,143 bytes versus main's 5,199,817: growth **146,326 bytes
(2.81%)**, below the 150 KB target. Standalone HTML is 12,828,387 bytes versus
12,480,190: growth 348,197 bytes (2.79%). The previous TSV build was 6,135,393
and 14,699,195 bytes respectively. Built artifacts are not committed. SCOWL and
ECDICT coverage, inferred morphology, mixed corpus rank scales and the
per-character heuristic limit generalization; rare long words can still
outscore romaji. Existing Japanese, GSD heterophony and mixed-line limitations
remain visible.
