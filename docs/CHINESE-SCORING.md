# Chinese unigram scoring

Expanded ranking includes `+freq-v1+physical-keys-v2+zh-parens-v1+bare-zhuyin-v1+tone-switch-v1+heterophony-v1` and
uses the occurrence column in `data/chinese.tsv` for both single characters and
phrases. For an imported edge before custom-priority offsets, with key length
`L`, `n` syllables and
reading-conditioned count `c`, its score is:

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

Single-character counts now apply upstream heterophony rules; phrases keep their
surface counts. These are curated pronunciation discounts, not observed reading
frequencies or a contextual model. A frequent homophone can still beat the intended
character. The prototype profile and frozen reference retain their historical scores.

## Reading-conditioned singles

The importer pins McBopomofo's three `heterophony?.list` files at the existing
revision, and mirrors [main_compiler.py](https://github.com/openvanilla/McBopomofo/blob/f5ba010ce8795d283ee336ca7d16380f200bd2ec/Source/Data/curation/compilers/main_compiler.py#L157-L195).
Characters absent from the primary list retain their counts for every reading.
A listed primary reading retains its count, without flooring. Secondary and
tertiary readings subtract `0.69314718055994` and twice that constant from the
upstream log frequency, floored at `H_DEFLT_FREQ = -6.8`. Other readings of a
character in the primary list use the floor; a missing secondary list entry
prevents a tertiary match. Repeated character keys use the last upstream row
(including 著 in the tertiary list).

The upstream [frequency builder](https://github.com/openvanilla/McBopomofo/blob/f5ba010ce8795d283ee336ca7d16380f200bd2ec/Source/Data/curation/builders/frequency_builder.py)
uses **base-10** logs despite comments describing halving/quartering and the
subtraction constant being `ln(2)`. We mirror the actual arithmetic: secondary
counts multiply by `10^-0.69314718055994 = 0.2026995663`, tertiary by
`0.04108711417`, both floored at `N * 10^-6.8 ≈ 6.351308577` counts. `N ≈
40,074,047.9366` is its weighted occurrence normalization, derived from all pinned
`phrase.occ` rows with `exclusion.txt` subtractions and `2.7^(surface length-1)`.
The exclusion file is additionally pinned solely to calculate this upstream floor.
Existing positive-frequency eligibility, primary counts, phrase counts, 40k cut,
Big5 filter and notices remain unchanged. We do not import upstream phrase length
scaling or exclusion-adjusted character counts into ordinary rows. Equivalent
counts retain fractional precision instead of the upstream intermediate/output
log text rounding (eight/six decimals), preserving original primary counts.

For example, 會 ㄎㄨㄞˋ goes from 96,739 to the floor, while 快 remains 8,963;
有 ㄧㄡˋ is floored, 為 ㄨㄟˋ becomes 18,400.46, and 率 ㄕㄨㄞˋ becomes
1,413.42. This fixes `u/ e9 dj94xk7187` -> 應該快了吧 in either layout.
The inherited primary list also demotes 亞 ㄧㄚˋ in the supplied 亞熱帶 reading;
GSD 04 loses its correct top-one and top-five. Its target remains unchanged and
is a visible failing TODO, not a new accepted output. Lists do not resolve
phrase segmentation or conversational homophone context.

TSV row order stays on original surface counts for historical diagnostics. Current
dictionary construction stably sorts imported single-reading alternatives by
conditioned log count before beam truncation, retaining custom insertion priority.
The manifest includes original counts for affected characters; native historical
20k ablations restore those counts and the original row order, including the
frequency-enabled experiments. No search-policy or boundary change is needed.

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
and the top 40,000 positive-frequency phrase/readings. Before reading conditioning,
the 20k, 40k and all-positive (104,221 phrases) cuts respectively achieved 14/20,
17/20 and 17/20 top-one Chinese excerpts; top-five counts are 18, 19 and 19.
The 40k cut adds useful compounds at a smaller size than the all-positive cut.
It is a browser-size decision, not a claim that the excluded words are invalid.
The current reading-conditioned 40k profile reaches 16/20 top one and 18/20
top five, including the 亞熱帶 regression described above. The other cut sizes
have not been remeasured with conditioned counts.

Reproduce a coverage cut with `bazelisk run //:import_chinese -- --phrase-limit=40000`
or `--phrase-limit=all`. `--from-dir=DIR` reads cached upstream files under their
original relative paths and still verifies pinned checksums. `--output-dir=DIR`
writes experimental data outside the checkout. Imports never read evaluation
text. Source revisions, hashes and notices remain pinned.

The Chinese excerpts, guards, feedback, six mixed lines and typing prefixes are
development diagnostics. Dictionary/corpus overlap is unknown. Better top-one
scores on these small sets do not establish conversational or held-out accuracy.
