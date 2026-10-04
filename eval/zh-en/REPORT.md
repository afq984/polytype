# Chinese and English development summary

Expanded profile; 3200 configurations from 550 selected source utterances/sentences. Unmapped source utterances omitted: 0.
Regenerate with `bazelisk run //:baseline_zh_en`. Aggregates only; no timings or per-case outputs. These configurations reuse source text and are not independent observations.

ASCEND/CC-CEDICT targets remain provisional: review-pending needs adjudication; automatic means no issue detected, not human-approved gold. English EWT guards have no reading queue and appear under automatic. The all stratum includes both. See [selection, attribution and limitations](../README.md#chinese--english-development-data).

Metrics use `scripts/evaluation-metrics.mjs`: exact committed text; space normalization only at Han/Latin or Han/digit boundaries; ordered exact English-token recall; Han-only edit distance; wrong-script intrusion only for single-language targets. Rates pool denominators; n/a means no eligible units. Both top-five measures inspect at most five candidates.

| Group | Stratum | Cases | Exact top 1 / top 5 | Space-normalized top 1 / top 5 | English exact | Han CER | Wrong language |
| --- | --- | --- | --- | --- | --- | --- | --- |
| en-only-colemak | all | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-colemak | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-colemak | automatic | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-qwerty | all | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| en-only-qwerty | review-pending | 0 | 0 / 0 | 0 / 0 | n/a (0/0) | n/a (0/0) | n/a (0/0) |
| en-only-qwerty | automatic | 200 | 192 / 200 | 192 / 200 | 99.79% (1929/1933) | n/a (0/0) | 4.00% (8/200) |
| zh-en-current-colemak-all | all | 300 | 112 / 144 | 112 / 144 | 96.97% (767/791) | 9.66% (360/3725) | n/a (0/0) |
| zh-en-current-colemak-all | review-pending | 242 | 73 / 103 | 73 / 103 | 97.10% (602/620) | 9.67% (333/3444) | n/a (0/0) |
| zh-en-current-colemak-all | automatic | 58 | 39 / 41 | 39 / 41 | 96.49% (165/171) | 9.61% (27/281) | n/a (0/0) |
| zh-en-current-colemak-en-zh | all | 300 | 113 / 145 | 113 / 145 | 97.47% (771/791) | 9.64% (359/3725) | n/a (0/0) |
| zh-en-current-colemak-en-zh | review-pending | 242 | 74 / 104 | 74 / 104 | 97.42% (604/620) | 9.67% (333/3444) | n/a (0/0) |
| zh-en-current-colemak-en-zh | automatic | 58 | 39 / 41 | 39 / 41 | 97.66% (167/171) | 9.25% (26/281) | n/a (0/0) |
| zh-en-current-qwerty-all | all | 300 | 112 / 148 | 112 / 148 | 97.35% (770/791) | 9.53% (355/3725) | n/a (0/0) |
| zh-en-current-qwerty-all | review-pending | 242 | 73 / 105 | 73 / 105 | 97.26% (603/620) | 9.58% (330/3444) | n/a (0/0) |
| zh-en-current-qwerty-all | automatic | 58 | 39 / 43 | 39 / 43 | 97.66% (167/171) | 8.90% (25/281) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | all | 300 | 113 / 150 | 113 / 150 | 97.85% (774/791) | 9.50% (354/3725) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | review-pending | 242 | 74 / 107 | 74 / 107 | 97.58% (605/620) | 9.58% (330/3444) | n/a (0/0) |
| zh-en-current-qwerty-en-zh | automatic | 58 | 39 / 43 | 39 / 43 | 98.83% (169/171) | 8.54% (24/281) | n/a (0/0) |
| zh-en-target-colemak-all | all | 300 | 96 / 120 | 96 / 120 | 92.16% (729/791) | 11.25% (419/3725) | n/a (0/0) |
| zh-en-target-colemak-all | review-pending | 242 | 61 / 83 | 61 / 83 | 91.45% (567/620) | 11.24% (387/3444) | n/a (0/0) |
| zh-en-target-colemak-all | automatic | 58 | 35 / 37 | 35 / 37 | 94.74% (162/171) | 11.39% (32/281) | n/a (0/0) |
| zh-en-target-colemak-en-zh | all | 300 | 97 / 121 | 97 / 121 | 92.67% (733/791) | 11.22% (418/3725) | n/a (0/0) |
| zh-en-target-colemak-en-zh | review-pending | 242 | 62 / 84 | 62 / 84 | 91.77% (569/620) | 11.24% (387/3444) | n/a (0/0) |
| zh-en-target-colemak-en-zh | automatic | 58 | 35 / 37 | 35 / 37 | 95.91% (164/171) | 11.03% (31/281) | n/a (0/0) |
| zh-en-target-qwerty-all | all | 300 | 96 / 123 | 96 / 123 | 92.54% (732/791) | 11.30% (421/3725) | n/a (0/0) |
| zh-en-target-qwerty-all | review-pending | 242 | 61 / 84 | 61 / 84 | 91.61% (568/620) | 11.30% (389/3444) | n/a (0/0) |
| zh-en-target-qwerty-all | automatic | 58 | 35 / 39 | 35 / 39 | 95.91% (164/171) | 11.39% (32/281) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | all | 300 | 97 / 124 | 97 / 124 | 93.05% (736/791) | 11.28% (420/3725) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | review-pending | 242 | 62 / 85 | 62 / 85 | 91.94% (570/620) | 11.30% (389/3444) | n/a (0/0) |
| zh-en-target-qwerty-en-zh | automatic | 58 | 35 / 39 | 35 / 39 | 97.08% (166/171) | 11.03% (31/281) | n/a (0/0) |
| zh-only-current-colemak-all | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-current-colemak-all | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-current-colemak-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-colemak-en-zh | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-current-colemak-en-zh | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-current-colemak-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-qwerty-all | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-current-qwerty-all | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-current-qwerty-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-current-qwerty-en-zh | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-current-qwerty-en-zh | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-current-qwerty-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-colemak-all | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-target-colemak-all | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-target-colemak-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-colemak-en-zh | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-target-colemak-en-zh | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-target-colemak-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-qwerty-all | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-target-qwerty-all | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-target-qwerty-all | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |
| zh-only-target-qwerty-en-zh | all | 50 | 18 / 31 | 18 / 31 | n/a (0/0) | 13.55% (42/310) | 6.00% (3/50) |
| zh-only-target-qwerty-en-zh | review-pending | 40 | 11 / 22 | 11 / 22 | n/a (0/0) | 14.29% (39/273) | 7.50% (3/40) |
| zh-only-target-qwerty-en-zh | automatic | 10 | 7 / 9 | 7 / 9 | n/a (0/0) | 8.11% (3/37) | 0.00% (0/10) |

The current and target Space contracts are scored separately on the same decoder. Scores for the future target contract describe its current limitations. Review status, layout and enabled languages remain visible in every group; aggregate differences alone do not establish a decoder improvement.
Sourced text and adapted annotations retain CC BY-SA 4.0; the offline OpenCC conversion resources retain Apache-2.0. This summary does not add source text to the runtime dictionaries.
