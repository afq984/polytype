# Chinese and English development summary

Expanded profile; 3200 configurations from 550 selected source utterances/sentences. Unmapped source utterances omitted: 0.
Regenerate with `bazelisk run //:baseline_zh_en`. Aggregates only; no timings or per-case outputs. These configurations reuse source text and are not independent observations.

ASCEND/CC-CEDICT targets remain development evidence: review-pending has unresolved issues; model-reviewed means every flagged issue was adjudicated by a model, not confirmed by the user; automatic means no issue detected, not human-approved gold. English EWT guards have no reading queue and appear under automatic. The all stratum includes every status. See [selection, attribution and limitations](../README.md#chinese--english-development-data).

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
| zh-en-current-colemak-all | all | 300 | 169 / 222 | 169 / 222 | 97.72% (773/791) | 5.18% (193/3725) | n/a (0/0) |
| zh-en-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-all | model-reviewed | 250 | 137 / 185 | 137 / 185 | 97.98% (631/644) | 4.84% (170/3511) | n/a (0/0) |
| zh-en-current-colemak-all | automatic | 50 | 32 / 37 | 32 / 37 | 96.60% (142/147) | 10.75% (23/214) | n/a (0/0) |
| zh-en-current-colemak-en-zh | all | 300 | 171 / 223 | 171 / 223 | 98.23% (777/791) | 5.15% (192/3725) | n/a (0/0) |
| zh-en-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-en-zh | model-reviewed | 250 | 139 / 186 | 139 / 186 | 98.29% (633/644) | 4.84% (170/3511) | n/a (0/0) |
| zh-en-current-colemak-en-zh | automatic | 50 | 32 / 37 | 32 / 37 | 97.96% (144/147) | 10.28% (22/214) | n/a (0/0) |
| zh-en-current-qwerty-all | all | 300 | 172 / 222 | 172 / 222 | 97.72% (773/791) | 5.15% (192/3725) | n/a (0/0) |
| zh-en-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-all | model-reviewed | 250 | 138 / 185 | 138 / 185 | 97.52% (628/644) | 4.90% (172/3511) | n/a (0/0) |
| zh-en-current-qwerty-all | automatic | 50 | 34 / 37 | 34 / 37 | 98.64% (145/147) | 9.35% (20/214) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | all | 300 | 174 / 223 | 174 / 223 | 98.23% (777/791) | 5.13% (191/3725) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | model-reviewed | 250 | 140 / 186 | 140 / 186 | 97.83% (630/644) | 4.90% (172/3511) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | automatic | 50 | 34 / 37 | 34 / 37 | 100.00% (147/147) | 8.88% (19/214) | n/a (0/0) |
| zh-en-target-colemak-all | all | 300 | 153 / 197 | 153 / 197 | 93.30% (738/791) | 6.79% (253/3725) | n/a (0/0) |
| zh-en-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-all | model-reviewed | 250 | 125 / 164 | 125 / 164 | 93.01% (599/644) | 6.41% (225/3511) | n/a (0/0) |
| zh-en-target-colemak-all | automatic | 50 | 28 / 33 | 28 / 33 | 94.56% (139/147) | 13.08% (28/214) | n/a (0/0) |
| zh-en-target-colemak-en-zh | all | 300 | 154 / 197 | 154 / 197 | 93.68% (741/791) | 6.77% (252/3725) | n/a (0/0) |
| zh-en-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-en-zh | model-reviewed | 250 | 126 / 164 | 126 / 164 | 93.17% (600/644) | 6.41% (225/3511) | n/a (0/0) |
| zh-en-target-colemak-en-zh | automatic | 50 | 28 / 33 | 28 / 33 | 95.92% (141/147) | 12.62% (27/214) | n/a (0/0) |
| zh-en-target-qwerty-all | all | 300 | 156 / 197 | 156 / 197 | 93.30% (738/791) | 6.90% (257/3725) | n/a (0/0) |
| zh-en-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-all | model-reviewed | 250 | 126 / 164 | 126 / 164 | 92.55% (596/644) | 6.55% (230/3511) | n/a (0/0) |
| zh-en-target-qwerty-all | automatic | 50 | 30 / 33 | 30 / 33 | 96.60% (142/147) | 12.62% (27/214) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | all | 300 | 157 / 197 | 157 / 197 | 93.68% (741/791) | 6.87% (256/3725) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | model-reviewed | 250 | 127 / 164 | 127 / 164 | 92.70% (597/644) | 6.55% (230/3511) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | automatic | 50 | 30 / 33 | 30 / 33 | 97.96% (144/147) | 12.15% (26/214) | n/a (0/0) |
| zh-only-current-colemak-all | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-all | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-current-colemak-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-colemak-en-zh | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-en-zh | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-current-colemak-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-qwerty-all | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-all | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-current-qwerty-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-current-qwerty-en-zh | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-en-zh | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-current-qwerty-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-colemak-all | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-all | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-target-colemak-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-colemak-en-zh | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-en-zh | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-target-colemak-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-qwerty-all | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-all | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-target-qwerty-all | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |
| zh-only-target-qwerty-en-zh | all | 50 | 39 / 43 | 39 / 43 | n/a (0/0) | 4.52% (14/310) | 0.00% (0/50) |
| zh-only-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-en-zh | model-reviewed | 40 | 31 / 34 | 31 / 34 | n/a (0/0) | 4.40% (12/273) | 0.00% (0/40) |
| zh-only-target-qwerty-en-zh | automatic | 10 | 8 / 9 | 8 / 9 | n/a (0/0) | 5.41% (2/37) | 0.00% (0/10) |

The current and target Space contracts are scored separately on the same decoder. Scores for the future target contract describe its current limitations. Review status, layout and enabled languages remain visible in every group; aggregate differences alone do not establish a decoder improvement.
Sourced text and adapted annotations retain CC BY-SA 4.0; the offline OpenCC conversion resources retain Apache-2.0. This summary does not add source text to the runtime dictionaries.
