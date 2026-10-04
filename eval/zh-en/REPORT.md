# Chinese and English development summary

Expanded profile; 3200 configurations from 550 selected source utterances/sentences. Unmapped source utterances omitted: 0.
Regenerate with `bazelisk run //:baseline_zh_en`. Aggregates only; no timings or per-case outputs. These configurations reuse source text and are not independent observations.

ASCEND/CC-CEDICT targets remain development evidence: review-pending has unresolved issues; model-reviewed means every flagged issue was adjudicated by a model, not confirmed by the user; automatic means no issue detected, not human-approved gold. English EWT guards have no reading queue and appear under automatic. The all stratum includes every status. See [selection, attribution and limitations](../README.md#chinese--english-development-data).

Owner-confirmed typing conventions override 多 ㄉㄨㄛˊ → ㄉㄨㄛ, 玩 ㄨㄢˋ → ㄨㄢˊ and 亞 ㄧㄚˋ → ㄧㄚˇ in ASCEND only (reviewer user, 2026-10-04). Position-level decisions and original citation readings are retained. These limited confirmations do not change whole-utterance review strata or the separate GSD citation annotations.

Metrics use `scripts/evaluation-metrics.mjs`: exact committed text; space normalization only at Han/Latin or Han/digit boundaries; ordered exact English-token recall; Han-only edit distance; wrong-script intrusion only for single-language targets. Rates pool denominators; n/a means no eligible units. Both top-five measures inspect at most five candidates.

| Group | Stratum | Cases | Exact top 1 / top 5 | Space-normalized top 1 / top 5 | English exact | Han CER | Wrong language |
| --- | --- | --- | --- | --- | --- | --- | --- |
| en-only-colemak | all | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-colemak | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-colemak | model-reviewed | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-colemak | automatic | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-qwerty | all | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-qwerty | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-qwerty | model-reviewed | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-qwerty | automatic | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| zh-en-current-colemak-all | all | 300 | 180 / 236 | 180 / 236 | 97.72% (773/791) | 4.59% (171/3725) | n/a (0/0) |
| zh-en-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-all | model-reviewed | 250 | 147 / 199 | 147 / 199 | 97.98% (631/644) | 4.24% (149/3511) | n/a (0/0) |
| zh-en-current-colemak-all | automatic | 50 | 33 / 37 | 33 / 37 | 96.60% (142/147) | 10.28% (22/214) | n/a (0/0) |
| zh-en-current-colemak-en-zh | all | 300 | 182 / 238 | 182 / 238 | 98.23% (777/791) | 4.56% (170/3725) | n/a (0/0) |
| zh-en-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-en-zh | model-reviewed | 250 | 149 / 201 | 149 / 201 | 98.29% (633/644) | 4.24% (149/3511) | n/a (0/0) |
| zh-en-current-colemak-en-zh | automatic | 50 | 33 / 37 | 33 / 37 | 97.96% (144/147) | 9.81% (21/214) | n/a (0/0) |
| zh-en-current-qwerty-all | all | 300 | 182 / 236 | 182 / 236 | 97.72% (773/791) | 4.56% (170/3725) | n/a (0/0) |
| zh-en-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-all | model-reviewed | 250 | 147 / 199 | 147 / 199 | 97.52% (628/644) | 4.30% (151/3511) | n/a (0/0) |
| zh-en-current-qwerty-all | automatic | 50 | 35 / 37 | 35 / 37 | 98.64% (145/147) | 8.88% (19/214) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | all | 300 | 184 / 238 | 184 / 238 | 98.23% (777/791) | 4.54% (169/3725) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | model-reviewed | 250 | 149 / 201 | 149 / 201 | 97.83% (630/644) | 4.30% (151/3511) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | automatic | 50 | 35 / 37 | 35 / 37 | 100.00% (147/147) | 8.41% (18/214) | n/a (0/0) |
| zh-en-target-colemak-all | all | 300 | 178 / 236 | 178 / 236 | 97.60% (772/791) | 4.67% (174/3725) | n/a (0/0) |
| zh-en-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-all | model-reviewed | 250 | 145 / 199 | 145 / 199 | 97.83% (630/644) | 4.33% (152/3511) | n/a (0/0) |
| zh-en-target-colemak-all | automatic | 50 | 33 / 37 | 33 / 37 | 96.60% (142/147) | 10.28% (22/214) | n/a (0/0) |
| zh-en-target-colemak-en-zh | all | 300 | 180 / 238 | 180 / 238 | 98.10% (776/791) | 4.64% (173/3725) | n/a (0/0) |
| zh-en-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-en-zh | model-reviewed | 250 | 147 / 201 | 147 / 201 | 98.14% (632/644) | 4.33% (152/3511) | n/a (0/0) |
| zh-en-target-colemak-en-zh | automatic | 50 | 33 / 37 | 33 / 37 | 97.96% (144/147) | 9.81% (21/214) | n/a (0/0) |
| zh-en-target-qwerty-all | all | 300 | 182 / 236 | 182 / 236 | 97.72% (773/791) | 4.59% (171/3725) | n/a (0/0) |
| zh-en-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-all | model-reviewed | 250 | 147 / 199 | 147 / 199 | 97.52% (628/644) | 4.33% (152/3511) | n/a (0/0) |
| zh-en-target-qwerty-all | automatic | 50 | 35 / 37 | 35 / 37 | 98.64% (145/147) | 8.88% (19/214) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | all | 300 | 184 / 238 | 184 / 238 | 98.23% (777/791) | 4.56% (170/3725) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | model-reviewed | 250 | 149 / 201 | 149 / 201 | 97.83% (630/644) | 4.33% (152/3511) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | automatic | 50 | 35 / 37 | 35 / 37 | 100.00% (147/147) | 8.41% (18/214) | n/a (0/0) |
| zh-only-current-colemak-all | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-all | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-current-colemak-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-colemak-en-zh | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-en-zh | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-current-colemak-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-qwerty-all | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-all | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-current-qwerty-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-qwerty-en-zh | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-en-zh | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-current-qwerty-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-colemak-all | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-all | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-target-colemak-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-colemak-en-zh | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-en-zh | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-target-colemak-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-qwerty-all | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-all | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-target-qwerty-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-qwerty-en-zh | all | 50 | 40 / 43 | 40 / 43 | n/a (0/0) | 3.87% (12/310) | 0.00% (0/50) |
| zh-only-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-en-zh | model-reviewed | 40 | 32 / 34 | 32 / 34 | n/a (0/0) | 3.66% (10/273) | 0.00% (0/40) |
| zh-only-target-qwerty-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |

The current (explicit separator) and target (one Space) input contracts are scored separately on the same decoder. First-tone completion emits no space; extra literal spaces remain visible. Review status, layout and enabled languages remain visible in every group; aggregate differences alone do not establish a decoder improvement.
Sourced text and adapted annotations retain CC BY-SA 4.0; the offline OpenCC conversion resources retain Apache-2.0. This summary does not add source text to the runtime dictionaries.
