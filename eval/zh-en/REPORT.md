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
| zh-en-current-colemak-all | all | 300 | 157 / 191 | 157 / 191 | 96.97% (767/791) | 6.79% (253/3725) | n/a (0/0) |
| zh-en-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-all | model-reviewed | 250 | 123 / 156 | 123 / 156 | 97.05% (625/644) | 6.64% (233/3511) | n/a (0/0) |
| zh-en-current-colemak-all | automatic | 50 | 34 / 35 | 34 / 35 | 96.60% (142/147) | 9.35% (20/214) | n/a (0/0) |
| zh-en-current-colemak-en-zh | all | 300 | 159 / 193 | 159 / 193 | 97.47% (771/791) | 6.77% (252/3725) | n/a (0/0) |
| zh-en-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-colemak-en-zh | model-reviewed | 250 | 125 / 158 | 125 / 158 | 97.36% (627/644) | 6.64% (233/3511) | n/a (0/0) |
| zh-en-current-colemak-en-zh | automatic | 50 | 34 / 35 | 34 / 35 | 97.96% (144/147) | 8.88% (19/214) | n/a (0/0) |
| zh-en-current-qwerty-all | all | 300 | 157 / 194 | 157 / 194 | 97.35% (770/791) | 6.66% (248/3725) | n/a (0/0) |
| zh-en-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-all | model-reviewed | 250 | 123 / 157 | 123 / 157 | 97.36% (627/644) | 6.52% (229/3511) | n/a (0/0) |
| zh-en-current-qwerty-all | automatic | 50 | 34 / 37 | 34 / 37 | 97.28% (143/147) | 8.88% (19/214) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | all | 300 | 159 / 196 | 159 / 196 | 97.85% (774/791) | 6.63% (247/3725) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | model-reviewed | 250 | 125 / 159 | 125 / 159 | 97.67% (629/644) | 6.52% (229/3511) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | automatic | 50 | 34 / 37 | 34 / 37 | 98.64% (145/147) | 8.41% (18/214) | n/a (0/0) |
| zh-en-target-colemak-all | all | 300 | 141 / 169 | 141 / 169 | 92.54% (732/791) | 8.40% (313/3725) | n/a (0/0) |
| zh-en-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-all | model-reviewed | 250 | 111 / 138 | 111 / 138 | 92.08% (593/644) | 8.20% (288/3511) | n/a (0/0) |
| zh-en-target-colemak-all | automatic | 50 | 30 / 31 | 30 / 31 | 94.56% (139/147) | 11.68% (25/214) | n/a (0/0) |
| zh-en-target-colemak-en-zh | all | 300 | 142 / 170 | 142 / 170 | 92.92% (735/791) | 8.38% (312/3725) | n/a (0/0) |
| zh-en-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-colemak-en-zh | model-reviewed | 250 | 112 / 139 | 112 / 139 | 92.24% (594/644) | 8.20% (288/3511) | n/a (0/0) |
| zh-en-target-colemak-en-zh | automatic | 50 | 30 / 31 | 30 / 31 | 95.92% (141/147) | 11.21% (24/214) | n/a (0/0) |
| zh-en-target-qwerty-all | all | 300 | 141 / 172 | 141 / 172 | 92.92% (735/791) | 8.40% (313/3725) | n/a (0/0) |
| zh-en-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-all | model-reviewed | 250 | 111 / 139 | 111 / 139 | 92.39% (595/644) | 8.17% (287/3511) | n/a (0/0) |
| zh-en-target-qwerty-all | automatic | 50 | 30 / 33 | 30 / 33 | 95.24% (140/147) | 12.15% (26/214) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | all | 300 | 142 / 173 | 142 / 173 | 93.30% (738/791) | 8.38% (312/3725) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | model-reviewed | 250 | 112 / 140 | 112 / 140 | 92.55% (596/644) | 8.17% (287/3511) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | automatic | 50 | 30 / 33 | 30 / 33 | 96.60% (142/147) | 11.68% (25/214) | n/a (0/0) |
| zh-only-current-colemak-all | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-current-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-all | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-current-colemak-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-colemak-en-zh | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-current-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-colemak-en-zh | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-current-colemak-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-qwerty-all | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-current-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-all | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-current-qwerty-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-qwerty-en-zh | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-current-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-current-qwerty-en-zh | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-current-qwerty-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-colemak-all | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-target-colemak-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-all | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-target-colemak-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-colemak-en-zh | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-target-colemak-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-colemak-en-zh | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-target-colemak-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-qwerty-all | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-target-qwerty-all | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-all | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-target-qwerty-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-qwerty-en-zh | all | 50 | 34 / 40 | 34 / 40 | n/a (0/0) | 6.13% (19/310) | 0.00% (0/50) |
| zh-only-target-qwerty-en-zh | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| zh-only-target-qwerty-en-zh | model-reviewed | 40 | 27 / 31 | 27 / 31 | n/a (0/0) | 5.86% (16/273) | 0.00% (0/40) |
| zh-only-target-qwerty-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |

The current and target Space contracts are scored separately on the same decoder. Scores for the future target contract describe its current limitations. Review status, layout and enabled languages remain visible in every group; aggregate differences alone do not establish a decoder improvement.
Sourced text and adapted annotations retain CC BY-SA 4.0; the offline OpenCC conversion resources retain Apache-2.0. This summary does not add source text to the runtime dictionaries.
