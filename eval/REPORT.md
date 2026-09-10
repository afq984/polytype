# Chinese dictionary and mixed-text evaluation

20 manually selected contiguous excerpts from the first 35 test sentences, selected before evaluating the expanded dictionary. Digits, unsupported punctuation and foreign proper names are excluded. This is a small development diagnostic, not a representative held-out benchmark.

Exact output matching, including variants and spaces. Readings are supplied, not inferred by the tested dictionary. Corpus overlap with upstream frequency training is unknown. CER includes insertions and can exceed 100%. Timing uses an already-loaded WASM module; prefix latency excludes engine construction and UI rendering.

User-supplied input, one sentence per case. Targets are provisional developer annotations, not user-confirmed gold. Convert Japanese romaji to hiragana, preserve spaces/punctuation and Latin technical terms/names (including Tanaka / tanaka). No kanji conversion or grammatical respelling is required.

| Profile / group | Top 1 | Top 5 | Character error rate | Dictionary-reachable |
| --- | --- | --- | --- | --- |
| prototype / real-text | 0/20 | 0/20 | 217.6% | 0 |
| prototype / guards | 20/22 | 21/22 | 9.5% | n/a |
| prototype / user-feedback | 0/5 | 3/5 | 65.7% | n/a |
| prototype / mixed-colemak-all | 0/6 | 0/6 | 53.5% | n/a |
| prototype / mixed-colemak-en-jp | 0/6 | 0/6 | 38.0% | n/a |
| prototype / mixed-qwerty-all | 0/6 | 0/6 | 53.5% | n/a |
| prototype / mixed-qwerty-en-jp | 0/6 | 0/6 | 38.0% | n/a |
| expanded / real-text | 12/20 | 17/20 | 5.6% | 20 |
| expanded / guards | 22/22 | 22/22 | 0.0% | n/a |
| expanded / user-feedback | 5/5 | 5/5 | 0.0% | n/a |
| expanded / mixed-colemak-all | 4/6 | 4/6 | 19.9% | n/a |
| expanded / mixed-colemak-en-jp | 4/6 | 4/6 | 5.9% | n/a |
| expanded / mixed-qwerty-all | 4/6 | 4/6 | 14.0% | n/a |
| expanded / mixed-qwerty-en-jp | 4/6 | 4/6 | 5.9% | n/a |

Top-1 regressions: none.
Top-5 regressions: none.

prototype: engine instance 0.2 ms; prefix decode p50 0.16 ms, p95 0.95 ms (this run; module already loaded).
expanded: engine instance 20.0 ms; prefix decode p50 0.43 ms, p95 2.66 ms (this run; module already loaded).

## Remaining expanded-profile errors

- gsd-01: 這樣的處理也衍生了一些問題 → 這樣的處理也演生了一些問題 (target rank: 2; dictionary reachable: true)
- gsd-03: 杜鵑花為溫帶植物 → 杜鵑化為溫大植物 (target rank: outside top 5; dictionary reachable: true)
- gsd-05: 一棟兩層樓的建築 → 一動兩層樓的建築 (target rank: 4; dictionary reachable: true)
- gsd-08: 主要夥伴是日本和美國 → 主要火辦事日本和美國 (target rank: 2; dictionary reachable: true)
- gsd-09: 這些電話經交換機處理 → 這些電話經教換機處理 (target rank: 4; dictionary reachable: true)
- gsd-12: 團購網站的主要產品分為家居類 → 團購網站的主要產品分為家車類 (target rank: 3; dictionary reachable: true)
- gsd-13: 因此透過切割菌肉便能分辨二者 → 因此透過切割俊肉變能分辨二者 (target rank: outside top 5; dictionary reachable: true)
- gsd-15: 深受耕作施肥等人為因素的影響而極不穩定 → 深受耕作師肥等人為因素的影響而及不穩定 (target rank: outside top 5; dictionary reachable: true)
- mixed-03-colemak-all: この PR の rebase してから npm test とおる か みて. → kono PR no rebase shitekara npm test tooru ka mite. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-03-colemak-en-jp: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test とおる か mite. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-03-qwerty-all: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test とおる か mite. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-03-qwerty-en-jp: この PR の rebase してから npm test とおる か みて. → この PR の ればせ してから npm test とおる か mite. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-06-colemak-all: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → yoyakuha TableCheck de, namaeha Tanaka / tanaka de ireteoita. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-06-colemak-en-jp: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-06-qwerty-all: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → yoyakuha TableCheck de, namaeha Tanaka / tanaka de ireteoita. (target rank: outside top 5; dictionary reachable: not measured)
- mixed-06-qwerty-en-jp: よやくは TableCheck で, なまえは Tanaka / tanaka で いれておいた. → よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた. (target rank: outside top 5; dictionary reachable: not measured)
