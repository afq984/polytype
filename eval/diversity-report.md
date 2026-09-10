# Candidate-diversity results

Frozen synthetic controls plus existing diagnostic cases. Width 192 is finite, not an oracle. Alternative-aware ranks are reported separately from exact target ranks. Full lattice excludes the independent literal fallback; displayed candidates include it.

Controls SHA-256: 17c78dc782f2b9b67b03ac66dce8615c371b04722e8060cb27b239b8a6a45acb

| Group | Baseline exact top 1 / top 5 | Family-diverse exact top 1 / top 5 | Cases |
| --- | --- | --- | --- |
| real-text | 12 / 17 | 12 / 17 | 20 |
| guards | 22 / 22 | 22 / 22 | 22 |
| user-feedback | 5 / 5 | 5 / 5 | 5 |
| mixed-colemak-all | 4 / 4 | 4 / 4 | 6 |
| mixed-colemak-en-jp | 4 / 4 | 4 / 5 | 6 |
| mixed-qwerty-all | 4 / 4 | 4 / 5 | 6 |
| mixed-qwerty-en-jp | 4 / 4 | 4 / 5 | 6 |
| diversity-english | 24 / 24 | 24 / 24 | 24 |
| diversity-japanese | 24 / 24 | 24 / 24 | 24 |
| diversity-chinese | 8 / 8 | 8 / 8 | 8 |
| diversity-mixed | 28 / 28 | 28 / 28 | 28 |
| diversity-ambiguous | 8 / 8 | 8 / 8 | 8 |

Lost previously correct top-one or acceptable top-five targets (excluding ambiguous probes): none.
Recovered acceptable top-five targets: mixed-06-colemak-en-jp, mixed-06-qwerty-all, mixed-06-qwerty-en-jp.

## Changed top-one output

- mixed-03-colemak-all: kono PR no rebase shitekara npm test tooru ka mite. → この PR の ればせ してから npm test とおる か mite.
- mixed-06-colemak-all: yoyakuha TableCheck de, namaeha Tanaka / tanaka de ireteoita. → よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.
- mixed-06-qwerty-all: yoyakuha TableCheck de, namaeha Tanaka / tanaka de ireteoita. → よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.

## Unresolved exact top-one targets

Classification describes acceptable top-five availability across finite widths, not proof of reachability. An available target can still rank below first. Wider-search results do not change the shipping width of 12.

- gsd-01: available; displayed exact rank 2; actual: 這樣的處理也演生了一些問題. Widths 12: displayed 2, lattice 2; 48: displayed 2, lattice 2; 192: displayed 2, lattice 2.
- gsd-03: found-below-displayed-five; displayed exact rank absent; actual: 杜鵑化為溫大植物. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 29; 192: displayed absent, lattice 29.
- gsd-05: available; displayed exact rank 4; actual: 一動兩層樓的建築. Widths 12: displayed 4, lattice 4; 48: displayed 4, lattice 4; 192: displayed 4, lattice 4.
- gsd-08: available; displayed exact rank 2; actual: 主要火辦事日本和美國. Widths 12: displayed 2, lattice 2; 48: displayed 2, lattice 2; 192: displayed 2, lattice 2.
- gsd-09: available; displayed exact rank 4; actual: 這些電話經教換機處理. Widths 12: displayed 4, lattice 4; 48: displayed 4, lattice 4; 192: displayed 4, lattice 4.
- gsd-12: available; displayed exact rank 3; actual: 團購網站的主要產品分為家車類. Widths 12: displayed 3, lattice 3; 48: displayed 3, lattice 3; 192: displayed 3, lattice 3.
- gsd-13: found-below-displayed-five; displayed exact rank absent; actual: 因此透過切割俊肉變能分辨二者. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 13; 192: displayed absent, lattice 13.
- gsd-15: not-found-within-tested-limits; displayed exact rank absent; actual: 深受耕作師肥等人為因素的影響而及不穩定. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice absent; 192: displayed absent, lattice absent.
- mixed-03-colemak-all: found-below-displayed-five; displayed exact rank absent; actual: この PR の ればせ してから npm test とおる か mite.. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 16; 192: displayed absent, lattice 21.
- mixed-03-colemak-en-jp: found-below-displayed-five; displayed exact rank absent; actual: この PR の ればせ してから npm test とおる か mite.. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 21; 192: displayed absent, lattice 21.
- mixed-03-qwerty-all: found-below-displayed-five; displayed exact rank absent; actual: この PR の ればせ してから npm test とおる か mite.. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 21; 192: displayed absent, lattice 21.
- mixed-03-qwerty-en-jp: found-below-displayed-five; displayed exact rank absent; actual: この PR の ればせ してから npm test とおる か mite.. Widths 12: displayed absent, lattice absent; 48: displayed absent, lattice 21; 192: displayed absent, lattice 21.
- mixed-06-colemak-all: recovered-in-wider-top-five; displayed exact rank absent; actual: よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.. Widths 12: displayed absent, lattice absent; 48: displayed 3, lattice 5; 192: displayed 3, lattice 5.
- mixed-06-colemak-en-jp: available; displayed exact rank 3; actual: よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.. Widths 12: displayed 3, lattice 5; 48: displayed 3, lattice 5; 192: displayed 3, lattice 5.
- mixed-06-qwerty-all: available; displayed exact rank 3; actual: よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.. Widths 12: displayed 3, lattice 5; 48: displayed 3, lattice 5; 192: displayed 3, lattice 5.
- mixed-06-qwerty-en-jp: available; displayed exact rank 3; actual: よやくは TableCheck で, なまえは Tanaka / たなか で いれておいた.. Widths 12: displayed 3, lattice 5; 48: displayed 3, lattice 5; 192: displayed 3, lattice 5.

## Mixed-case displayed families

| Case | Before | After |
| --- | --- | --- |
| mixed-03-colemak-all | 2 | 5 |
| mixed-03-colemak-en-jp | 2 | 5 |
| mixed-03-qwerty-all | 2 | 5 |
| mixed-03-qwerty-en-jp | 2 | 5 |
| mixed-06-colemak-all | 2 | 5 |
| mixed-06-colemak-en-jp | 2 | 5 |
| mixed-06-qwerty-all | 2 | 5 |
| mixed-06-qwerty-en-jp | 2 | 5 |
