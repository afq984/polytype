# Chinese, Japanese and mixed-text evaluation

20 manually selected contiguous excerpts from the first 35 test sentences, selected before evaluating the expanded dictionary. Digits, unsupported punctuation and foreign proper names are excluded. This is a small development diagnostic, not a representative held-out benchmark.

Exact output matching, including variants and spaces. Reading-level matching additionally accepts imported Japanese conversions whose kana reading equals the target span, so kana-annotated targets are not counted as errors when a kanji conversion is offered instead. Readings are supplied, not inferred by the tested dictionary. Corpus overlap with upstream frequency training is unknown. CER includes insertions and can exceed 100%. Timing is omitted for reproducibility; use bazelisk run //:measure_evaluation for host-dependent latency measurements.

User-supplied input, one sentence per case. Targets are provisional developer annotations, not user-confirmed gold. Convert Japanese romaji to hiragana, preserve spaces/punctuation and Latin technical terms/names (including Tanaka / tanaka). No kanji conversion or grammatical respelling is required.

The first 100 long-unit words (LUWBILabel=B) tagged NOUN, PROPN, VERB, ADJ or ADV in the test file, taken in sentence order (32 sentences), whose surface form equals the long-unit lemma, whose UniDic lemma reading is katakana, and whose lemma contains kanji or katakana. Pure-hiragana lemmas need no conversion and are skipped. Duplicate reading/lemma pairs are skipped. Selection is mechanical and was fixed before evaluating the imported dictionary; this is a word-conversion diagnostic, not sentence conversion or a representative accuracy estimate.

| Profile / group | Top 1 | Top 5 | Reading top 1 | Reading top 5 | Character error rate | Dictionary-reachable |
| --- | --- | --- | --- | --- | --- | --- |
| prototype / real-text | 0/20 | 0/20 | 0/20 | 0/20 | 217.6% | 0 |
| prototype / guards | 20/22 | 21/22 | 20/22 | 21/22 | 9.5% | n/a |
| prototype / user-feedback | 0/5 | 3/5 | 0/5 | 3/5 | 65.7% | n/a |
| prototype / mixed-colemak-all | 0/6 | 0/6 | 0/6 | 0/6 | 53.5% | n/a |
| prototype / mixed-colemak-en-jp | 0/6 | 0/6 | 0/6 | 0/6 | 38.0% | n/a |
| prototype / mixed-qwerty-all | 0/6 | 0/6 | 0/6 | 0/6 | 53.5% | n/a |
| prototype / mixed-qwerty-en-jp | 0/6 | 0/6 | 0/6 | 0/6 | 38.0% | n/a |
| prototype / japanese-words-jp | 0/100 | 1/100 | 0/100 | 1/100 | 165.1% | 0 |
| prototype / japanese-words-all | 0/100 | 1/100 | 0/100 | 1/100 | 165.5% | 0 |
| expanded / real-text | 12/20 | 17/20 | 12/20 | 17/20 | 5.6% | 20 |
| expanded / guards | 12/22 | 22/22 | 22/22 | 22/22 | 17.5% | n/a |
| expanded / user-feedback | 5/5 | 5/5 | 5/5 | 5/5 | 0.0% | n/a |
| expanded / mixed-colemak-all | 1/6 | 3/6 | 4/6 | 4/6 | 12.5% | n/a |
| expanded / mixed-colemak-en-jp | 1/6 | 3/6 | 4/6 | 4/6 | 12.5% | n/a |
| expanded / mixed-qwerty-all | 1/6 | 3/6 | 4/6 | 4/6 | 12.5% | n/a |
| expanded / mixed-qwerty-en-jp | 1/6 | 3/6 | 4/6 | 4/6 | 12.5% | n/a |
| expanded / japanese-words-jp | 75/100 | 86/100 | 75/100 | 86/100 | 47.4% | 86 |
| expanded / japanese-words-all | 75/100 | 86/100 | 75/100 | 86/100 | 48.3% | 86 |

Top-1 regressions: acceptance-7, acceptance-8, acceptance-9, acceptance-10, acceptance-11, acceptance-12, acceptance-13, synthetic-6, synthetic-7, trilingual (reading level: none).
Top-5 regressions: none (reading level: none).


## Remaining expanded-profile errors

- gsd-01: 這樣的處理也衍生了一些問題 → 這樣的處理也演生了一些問題 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- gsd-03: 杜鵑花為溫帶植物 → 杜鵑化為溫大植物 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: true)
- gsd-05: 一棟兩層樓的建築 → 一動兩層樓的建築 (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- gsd-08: 主要夥伴是日本和美國 → 主要火辦事日本和美國 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- gsd-09: 這些電話經交換機處理 → 這些電話經教換機處理 (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- gsd-12: 團購網站的主要產品分為家居類 → 團購網站的主要產品分為家車類 (target rank: 3; reading-level rank: 3; dictionary reachable: true)
- gsd-13: 因此透過切割菌肉便能分辨二者 → 因此透過切割俊肉變能分辨二者 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: true)
- gsd-15: 深受耕作施肥等人為因素的影響而極不穩定 → 深受耕作師肥等人為因素的影響而及不穩定 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: true)
- acceptance-7: さくら → 桜 (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-8: がっこう → 学校 (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-9: りょこう → 旅行 (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-10: しんよう → 信用 (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-11: しにょう → し尿 (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-12: こーひー → コーヒー (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- acceptance-13: かん  hello! → 感  hello! (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- synthetic-6: さくら hello → 桜 hello (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- synthetic-7: がっこう small → 学校 small (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- trilingual: がっこう 你好 hello → 学校 你好 hello (target rank: 2; reading-level rank: 1; dictionary reachable: not measured)
- mixed-01-colemak-all: GPU たりないから batch size 16 のまま train まわす. → GPU たりないから batch size 16 のまま train 回す. (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- mixed-01-colemak-en-jp: GPU たりないから batch size 16 のまま train まわす. → GPU たりないから batch size 16 のまま train 回す. (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- mixed-01-qwerty-all: GPU たりないから batch size 16 のまま train まわす. → GPU たりないから batch size 16 のまま train 回す. (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- mixed-01-qwerty-en-jp: GPU たりないから batch size 16 のまま train まわす. → GPU たりないから batch size 16 のまま train 回す. (target rank: 3; reading-level rank: 1; dictionary reachable: not measured)
- mixed-03-colemak-all: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test 通る か mite. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-03-colemak-en-jp: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test 通る か mite. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-03-qwerty-all: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test 通る か mite. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-03-qwerty-en-jp: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test 通る か mite. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-04-colemak-all: あたらしい MacBook の Wi-Fi が ふあんていで, VPN きると なおる. → 新しい MacBook の Wi-Fi が ふあんていで, VPN キルト 治る. (target rank: outside top 5; reading-level rank: 1; dictionary reachable: not measured)
- mixed-04-colemak-en-jp: あたらしい MacBook の Wi-Fi が ふあんていで, VPN きると なおる. → 新しい MacBook の Wi-Fi が ふあんていで, VPN キルト 治る. (target rank: outside top 5; reading-level rank: 1; dictionary reachable: not measured)
- mixed-04-qwerty-all: あたらしい MacBook の Wi-Fi が ふあんていで, VPN きると なおる. → 新しい MacBook の Wi-Fi が ふあんていで, VPN キルト 治る. (target rank: outside top 5; reading-level rank: 1; dictionary reachable: not measured)
- mixed-04-qwerty-en-jp: あたらしい MacBook の Wi-Fi が ふあんていで, VPN きると なおる. → 新しい MacBook の Wi-Fi が ふあんていで, VPN キルト 治る. (target rank: outside top 5; reading-level rank: 1; dictionary reachable: not measured)
- mixed-05-colemak-all: Send the みつもりしょ as PDF, filename quote_2026-09.pdf → Send the 見積書 as PDF, filename quote_2026-09.pdf (target rank: 4; reading-level rank: 1; dictionary reachable: not measured)
- mixed-05-colemak-en-jp: Send the みつもりしょ as PDF, filename quote_2026-09.pdf → Send the 見積書 as PDF, filename quote_2026-09.pdf (target rank: 4; reading-level rank: 1; dictionary reachable: not measured)
- mixed-05-qwerty-all: Send the みつもりしょ as PDF, filename quote_2026-09.pdf → Send the 見積書 as PDF, filename quote_2026-09.pdf (target rank: 4; reading-level rank: 1; dictionary reachable: not measured)
- mixed-05-qwerty-en-jp: Send the みつもりしょ as PDF, filename quote_2026-09.pdf → Send the 見積書 as PDF, filename quote_2026-09.pdf (target rank: 4; reading-level rank: 1; dictionary reachable: not measured)
- mixed-06-colemak-all: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / 田中 で いれておいた. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-06-colemak-en-jp: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / 田中 で いれておいた. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-06-qwerty-all: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / 田中 で いれておいた. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- mixed-06-qwerty-en-jp: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / 田中 で いれておいた. (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: not measured)
- jgsd-006-jp: 抗議 → 講義 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-006-all: 抗議 → 講義 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-008-jp: 幸福の科学側 → こうふくのかがくがわ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-008-all: 幸福の科学側 → こうふくのかがくがわ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-011-jp: 星取り参加 → ほしとりさんか (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-011-all: 星取り参加 → ほしとりさんか (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-020-jp: 生理 → 整理 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-020-all: 生理 → 整理 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-024-jp: 兎も角 → ともかく (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-024-all: 兎も角 → ともかく (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-028-jp: 日本学術会議 → にほんがくじゅつかいぎ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-028-all: 日本学術会議 → にほんがくじゅつかいぎ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-029-jp: 会長談話 → かいちょうだんわ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-029-all: 会長談話 → かいちょうだんわ (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-030-jp: 当会 → 東海 (target rank: 3; reading-level rank: 3; dictionary reachable: true)
- jgsd-030-all: 当会 → 東海 (target rank: 3; reading-level rank: 3; dictionary reachable: true)
- jgsd-031-jp: 標記 → 表記 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-031-all: 標記 → 表記 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-038-jp: 民族派 → みんぞくは (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-038-all: 民族派 → みんぞくは (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-042-jp: 霊言 → 霊験 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-042-all: 霊言 → 霊験 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-045-jp: 産業構造 → さんぎょうこうぞう (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-045-all: 産業構造 → さんぎょうこうぞう (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-047-jp: モサ → 猛者 (target rank: 3; reading-level rank: 3; dictionary reachable: false)
- jgsd-047-all: モサ → 猛者 (target rank: 3; reading-level rank: 3; dictionary reachable: false)
- jgsd-050-jp: 火 → 日 (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- jgsd-050-all: 火 → hi (target rank: 5; reading-level rank: 5; dictionary reachable: true)
- jgsd-052-jp: 署 → 書 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: true)
- jgsd-052-all: 署 → 書 (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: true)
- jgsd-062-jp: 抗議デモ → こうぎでも (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-062-all: 抗議デモ → こうぎでも (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-066-jp: 韓国東亜日報 → かんこくとうあにっぽう (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-066-all: 韓国東亜日報 → かんこくとうあにっぽう (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-067-jp: 様 → よう (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- jgsd-067-all: 様 → you (target rank: 5; reading-level rank: 5; dictionary reachable: true)
- jgsd-068-jp: 襲撃事件 → しゅうげきじけん (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-068-all: 襲撃事件 → しゅうげきじけん (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-071-jp: 机上 → 騎乗 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-071-all: 机上 → 騎乗 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-074-jp: 自戒 → 次回 (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- jgsd-074-all: 自戒 → 次回 (target rank: 4; reading-level rank: 4; dictionary reachable: true)
- jgsd-075-jp: 市長 → 視聴 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-075-all: 市長 → 視聴 (target rank: 2; reading-level rank: 2; dictionary reachable: true)
- jgsd-088-jp: 排除す → はいじょす (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-088-all: 排除す → はいじょす (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-090-jp: 大川隆法氏 → おおかわりゅうほうし (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-090-all: 大川隆法氏 → おおかわりゅうほうし (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-091-jp: 支持する → しじする (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
- jgsd-091-all: 支持する → しじする (target rank: outside top 5; reading-level rank: outside top 5; dictionary reachable: false)
