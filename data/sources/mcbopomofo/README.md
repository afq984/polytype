# Chinese vocabulary source

Imported from [McBopomofo](https://github.com/openvanilla/McBopomofo) at revision
f5ba010ce8795d283ee336ca7d16380f200bd2ec. The repository's MIT notice is retained
in LICENSE.txt. Its data README describes BPMFMappings.txt as modified BSD-licensed
libtabe data; historical libtabe notices are also retained in LIBTABE-NOTICE.txt.

`scripts/import-chinese.mjs` reads pinned BPMFBase.txt, BPMFMappings.txt,
phrase.occ, the three heterophony lists, exclusion.txt and LICENSE.txt, never
evaluation text. It selects all positive-frequency Big5 single
character readings and the 40,000 most frequent phrase/readings with Han-only
output and valid, matching Zhuyin syllables. The limit is a measured browser-size
budget, not a statement that excluded words are invalid. Zero-frequency entries,
non-Big5 single variants and unsupported rows are counted in the manifest.

The resulting data/chinese.tsv has 48,184 reading/output pairs and 45,471 unique
outputs. Single-character counts apply upstream pronunciation discounts; phrases
keep their surface counts. The exclusion file supplies only the normalization for
the upstream default frequency. The expanded decoder uses log counts to score
single-character and phrase paths; see [the scoring model](../../../docs/CHINESE-SCORING.md). Custom entries precede
imports, and the prototype vocabulary supplies missing fallback entries.

Run `bazelisk run //:import_chinese` to reproduce the generated TSV.
`--phrase-limit=20000`, `--phrase-limit=40000` and `--phrase-limit=all` support
coverage comparisons; `--from-dir=DIR` verifies cached upstream sources, and
`--output-dir=DIR` keeps experimental outputs outside the checkout. The existing
manifest verifies source checksums; revision/hash changes require deliberate
review. Normal tests/builds do not download data. data/chinese-source.json records
source URLs, hashes, filtering counts and the output checksum.

The web build reproduces notices in dictionary-notices.txt, and the standalone
build embeds them. No endorsement by upstream authors is implied.
