# Chinese vocabulary source

Imported from [McBopomofo](https://github.com/openvanilla/McBopomofo) at revision
f5ba010ce8795d283ee336ca7d16380f200bd2ec. The repository's MIT notice is retained
in LICENSE.txt. Its data README describes BPMFMappings.txt as modified BSD-licensed
libtabe data; historical libtabe notices are also retained in LIBTABE-NOTICE.txt.

`scripts/import-chinese.mjs` reads only pinned BPMFBase.txt, BPMFMappings.txt and
phrase.occ, never evaluation text. It selects all positive-frequency Big5 single
character readings and the 20,000 most frequent phrase/readings with Han-only
output and valid, matching Zhuyin syllables. The limit is a first browser-size
budget, not a statement that excluded words are invalid. Zero-frequency entries,
non-Big5 single variants and unsupported rows are counted in the manifest.

The resulting data/chinese.tsv has 28,184 reading/output pairs and 26,236 unique
outputs. Occurrence counts order alternatives; the existing decoder scores still
use candidate position, not a calibrated language model. Custom entries precede
imports, and the prototype vocabulary supplies missing fallback entries.

Run `npm run dictionary:import` to reproduce the generated TSV. The existing
manifest verifies source checksums; revision/hash changes require deliberate
review. Normal tests/builds do not download data. data/chinese-source.json records
source URLs, hashes, filtering counts and the output checksum.

The web build reproduces notices in dictionary-notices.txt, and the standalone
build embeds them. No endorsement by upstream authors is implied.
