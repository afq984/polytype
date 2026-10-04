# English word frequency evidence

Expanded ranking appends `+en-freq-v1` after `+numbers-v2`. The SCOWL vocabulary
is unchanged: 101,191 lowercase spellings, including contractions and hyphens.
`data/english-frequency.bin` joins 61,883 of them to ECDICT ranks; the remaining
39,308 use rank 200,000. The lossless packed table is 144,167 bytes. The prototype and
historical native ablations retain their original English scores.

For a lexical spelling of length `L` and positive rank `r`, the lexical score is:

```
L * clamp(1.8 + 0.05 * ln(1000 / r), 1.3, 2.0)
```

The per-character rate is rounded to nine decimal places before multiplication.
Imported logs are cached alongside SCOWL tiers in one spelling map at dictionary
initialization. Continuity adds the existing 0.75
when the preceding language is English; uppercase adds the existing two-point
case cue. Trailing Roman period/comma/semicolon are retained but contribute no
lexical length. Expanded prototype spellings use this same branch, removing
their former punctuation-length privilege and applying the shared case cue.
The frozen prototype still uses its separate historical branch.

This is a rank-based heuristic. Interpreting inverse rank as relative frequency
is a Zipf-style approximation, not an observed word probability. The per-character
scale keeps evidence comparable to the existing Roman composer. Neither the
SCOWL levels nor these ranks measure the probability of the intended language.
Long rare words can still defeat a valid Japanese reading. Homographs need
context or explicit correction; no English bigram model is added.

Single letters other than the article/pronoun `a` and `i` retain symbol evidence
of 1.5 per character. ECDICT abbreviation ranks do not supply lexical word
frequency for those symbols. Ordinary SCOWL letters previously had tier 40
and that same score; `m` had tier 35 and 1.8, so its lexical score changes to
1.5. The case cue remains. This prevents a ranked letter after a Chinese colon
from beating unknown uppercase-O words in Colemak (`你好 OK` must remain
`你好 OK`). Number/identifier evidence, possessives, discarded Zhuyin penalties,
converted first-tone eligibility and exact typed spaces use their existing rules.

Unknown words retain literal evidence of 0.9 per character and the existing case
and continuity cues. Existing productive-prefix eligibility still recognizes
`re`/`un`/`pre` with a SCOWL stem through level 35; these are not new dictionary
entries and use the unranked prior. Coverage levels only determine that historical
prefix eligibility and the disabled-frequency ablation, not lexical evidence.

## Pinned source and join

The importer pins [ECDICT](https://github.com/skywind3000/ECDICT/tree/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b)
at `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`, verifies SHA-256 for its CSV,
README and MIT license, and retains Linwei's license in `data/sources/ecdict/`.
Both demos bundle the license. Definitions, translations and examples are never
imported. The CSV stays outside the repository and build inputs.

Headwords are lowercased for the exact SCOWL join; duplicate ranks use the minimum
positive value. Prefer direct contemporary `frq`, then a one-hop inflection
estimate from `frq`, then direct `bnc`, then its one-hop estimate. Morphological
estimates use only ranked SCOWL lemmas, ECDICT `exchange` fields `0/p/d/i/3/r/t/s`,
and twice the lemma's rank. They never propagate recursively. An inferred rank
is discounted lemma evidence, not a measured surface-form frequency.

The selected counts are 35,653 direct `frq`, 23,714 inferred `frq`, 1,640 direct
`bnc`, 876 inferred `bnc`, and 39,308 unranked. For example, `be` has rank 2;
`is` and `was` inherit rank 4 rather than their misleading or missing surface
ranks. Contemporary inflection estimates take precedence over direct BNC ranks;
the corpora's rank scales are not normalized against each other. Source coverage
and upstream rank provenance are limited to what ECDICT documents. Dictionary
overlap with visible development text is unknown.

```sh
bazelisk run //:import_english_frequency
bazelisk run //:import_english_frequency -- --from-dir=ECDICT_CACHE_DIR
bazelisk run //:import_english_frequency -- --from-dir=ECDICT_CACHE_DIR --output-dir=OUT_DIR
```

`--from-dir` expects the three pinned source basenames and still checks their
hashes. `--output-dir` writes an experimental import outside the checkout.
Normal builds and tests read only committed data and need no ECDICT download.
Reimporting SCOWL is separate; the frequency importer verifies its manifest hash.

## Compact binary layout

`data/english-frequency.bin` contains exact integer ranks, without repeated
spellings or floating-point quantization. The pinned maximum rank is 99,992,
so 17 bits suffice. Its format is:

| Offset | Length | Contents |
| --- | --- | --- |
| 0 | 4 | ASCII `EFR1` magic/version |
| 4 | 4 | SCOWL spelling count, unsigned 32-bit little endian (101,191) |
| 8 | 4 | Ranked spelling count, unsigned 32-bit little endian (61,883) |
| 12 | 1 | Bits per rank (17) |
| 13 | 3 | Reserved zero bytes |
| 16 | 12,649 | Presence bitset in `data/english.tsv` file order, low bit first; one means ranked, zero means fallback |
| 12,665 | 131,502 | Positive ranks for present spellings, in that same order; packed low bit first across byte boundaries |

Unused final bits are zero. An absent spelling uses the unchanged rank-200,000
prior. The importer rejects ranks outside the 17-bit range and files over
150,000 bytes; a source or vocabulary change requires an explicit reimport.
The manifest pins the SCOWL hash, source hashes, compact file hash and a
canonical `word\trank\n` hash computed directly from the join before packing.
The regression test decodes all 61,883 ranks and compares that canonical hash,
including the original TSV hash, so it checks every spelling and integer against
the importer's ranks. Cached reimports reproduce the binary, manifest and MIT
license byte for byte. No unpacked TSV is committed or embedded.

The scorer obtains exactly the same integers as the earlier sparse TSV, so
quantization error is zero. Native full candidate traces and scores match the
TSV version on all 5,664 development configurations. The six diagnostic
calibration policies also retain their exact input ranks and formula.

## Calibration and ablation

The preregistered grid used offsets 1.6, 1.7 and 1.8, each with log weight 0.05
or 0.1. Floor 1.3, cap 2.0, reference rank 1,000 and unranked rank 200,000 were
fixed before scoring results. No evaluation text was used to construct the
vocabulary or ranks. The final choice is 1.8/0.05. Results and every rejected
configuration's losses are reported in the English stream's external report.

Full regression tests caught single-letter abbreviation evidence splitting an
unknown uppercase-O word into colon plus letter. After restricting ordinary
letters to their existing symbol evidence, the same six configurations were
rerun without adding calibration points. Original and corrected-grid results
are retained separately. The visible sets are development evidence.

Native diagnostics accept `--experiment=current+no-english-frequency` to restore
main's English evidence on the current dictionaries. The six calibration names
are `current+en-freq-16-005`, `16-010`, `17-005`, `17-010`, `18-005`, and `18-010`
(each suffix uses the same `en-freq-` prefix). The browser/API exposes no policy
flags. Segment English choices use the ordinary shared scorer. Explicitly
remembered, exact-case English spellings retain main's whole-token constraint
preference before frequency ranking. Explicit correction locks take precedence;
empty user lists leave ordinary ranking unchanged. English memory remains
atomic and per engine, including when replacing Chinese custom entries.
