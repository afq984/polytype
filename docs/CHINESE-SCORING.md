# Chinese unigram scoring

Expanded ranking `scowl-context-v4+family-v1+island-v1+mozc-v1+jpdict-v1+zh-punct-v1+freq-v1`
uses the occurrence column in `data/chinese.tsv` for both single characters and
phrases. For an imported edge before custom-priority offsets, with key length
`L`, `n` syllables and
surface count `c`, its score is:

```
2L + 5.2n + 0.7 ln(c / 40,000,000) - discarded-key cost
```

The key and syllable terms sum equally across segmentations of the same Chinese
reading. The log terms therefore compare segmentations as a unigram model within
the existing lattice and beam of 12. Natural logarithms are computed once when
the imported dictionary is loaded. Each frequency edge adjustment is rounded
to nine decimal score places before accumulation to keep native/WASM logarithm
ties reproducible. Equal counts retain stable source order.

The reference mass is a conservative round scale above the original 20k cut's
summed reading counts (29,948,651), giving a little more word cost to avoid
over-segmentation into common characters. It stays fixed when the cut grows, so
coverage experiments do not also change every prior. The 5.2-point offset places
a character with count about 24,000 near its former key-length evidence. The log weight 0.7
makes rare readings less competitive without changing English or Japanese score
branches. For example, 尻 at count 23 receives a -4.86 adjustment to the key
evidence; 的 at 615,175 receives +2.28. These constants were calibrated on the
visible development controls, including Chinese typing prefixes and the
coordinator's Chinese/English probe. This is not a calibrated probability of the user's intended language.

Prototype fallbacks absent from the import use a smoothed count of one. Explicit
custom entries omit the negative prior and retain the 0.8 local rank penalty,
and imported alternatives get the corresponding offset for preceding custom
choices, so every custom alternative takes precedence. Atomic replacement, per-engine
isolation and selected-candidate commit remain the same. Incomplete or unknown
Zhuyin stays on the existing phonetic fallback score; the model applies only to
dictionary entries. [Converted first-tone switching](TONE-SWITCH.md) now uses
that same Space for a language change; another Space prints a separator.

The source counts belong to surfaces, not pronunciation-conditioned readings.
Every imported reading of a surface shares its count. There is no contextual
model, and a frequent homophone can still beat the intended character. The
prototype profile and frozen reference retain their historical structural scores.

## Native ablations

After `bazelisk build //:polytype-search`, send one request per line with fields
`raw`, `options` and `width: 12` to `bazel-bin/crates/polytype-core/polytype-search`.

| Argument | Dictionary and policy |
| --- | --- |
| `--experiment=current` | Current expanded dictionary and default policy |
| `--experiment=current+no-frequency` | Same dictionary, old Chinese scores |
| `--experiment=current+no-tone-switch` | Phase 1 dictionary/scoring with the former Space boundary |
| `--experiment=current+no-tone-switch+first-tone` | Former unrestricted first-tone diagnostic |
| `--experiment=baseline` | Frozen family-v1 policy and original 20k Chinese cut |
| `--experiment=frequency` | Frozen family-v1 policy and 20k cut, frequency scoring enabled |
| `--experiment=frequency+first-tone` | Same scoring ablation plus diagnostic switching |

Historical experiment names keep the original 20k cut even when the default
dictionary grows. A regression test checks all 376 frozen baseline rows, including
candidate scores. The modern `current` modes retain the present Japanese composer
and continuation protection. These flags are native diagnostics; the browser
protocol exposes none of them.

## Coverage and development evidence

The importer selects all 8,184 positive-frequency Big5 single-character readings
and the top 40,000 positive-frequency phrase/readings. With this scoring, the
20k, 40k and all-positive (104,221 phrases) cuts respectively achieve 14/20,
17/20 and 17/20 top-one Chinese excerpts; top-five counts are 18, 19 and 19.
The 40k cut adds useful compounds at a smaller size than the all-positive cut.
It is a browser-size decision, not a claim that the excluded words are invalid.

Reproduce a coverage cut with `bazelisk run //:import_chinese -- --phrase-limit=40000`
or `--phrase-limit=all`. `--from-dir=DIR` reads cached upstream files under their
original relative paths and still verifies pinned checksums. `--output-dir=DIR`
writes experimental data outside the checkout. Imports never read evaluation
text. Source revisions, hashes and notices remain pinned.

The Chinese excerpts, guards, feedback, six mixed lines and typing prefixes are
development diagnostics. Dictionary/corpus overlap is unknown. Better top-one
scores on these small sets do not establish conversational or held-out accuracy.
