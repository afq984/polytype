# Japanese composition and conversion sources

Imported from [Mozc](https://github.com/google/mozc) at revision
60af02ff797275f2ba1b7fddccdec916798d112e. Google's BSD-3-Clause notice is
retained in LICENSE together with the IPAdic (NAIST/ICOT) and Okinawa
dictionary notices that upstream attaches to its dictionary files; README.txt
is the upstream dictionary README describing that provenance.

`romanji-hiragana.tsv` is the unmodified default romaji table used by the
expanded composer. `scripts/import-japanese.mjs` reads only the pinned
`dictionary00.txt`–`dictionary09.txt`, `id.def` and
`connection_single_column.txt`, never evaluation text. Mozc's word costs are
class-relative (a bare prefix such as 被 has word cost 2), so each row is
scored the way Mozc scores a word converted on its own: the connection cost
from the sentence start to the word's left id, plus the word cost, plus the
connection cost from its right id to the sentence end. The importer keeps
rows with hiragana readings, keys them by reading and surface at their lowest
standalone cost, excludes symbols, sentence boundaries, fillers and numerals,
takes the 70,000 lowest-cost pairs, and keeps at most eight surfaces per
reading. The limit is a browser-size budget, not a statement that excluded
words are invalid.

The resulting data/japanese.tsv has 69,097 reading/surface pairs for 53,410
readings, with the standalone cost in the third column. That cost orders
alternatives only; the decoder's scores still use candidate position, not a
calibrated language model. Conversion is per space-delimited token; the
segmentation, suffix dictionary and context transitions of Mozc's converter
are not imported, so word-plus-particle tokens such as kyouha are not split.

Run `bazelisk run //:import_japanese` to reproduce the generated TSV. The
existing manifest verifies source checksums; revision/hash changes require
deliberate review. `--from-dir=DIR` reproduces the import from previously
downloaded upstream files with the same checksum verification. Normal
tests/builds do not download data. data/japanese-source.json records source
URLs, hashes, quotas, filtering counts and the output checksum.

The web build reproduces notices in dictionary-notices.txt, and the standalone
build embeds them. No endorsement by upstream authors is implied.
