# Japanese composition and conversion

## Compatibility baseline

Expanded/default composition uses the unmodified Mozc default romaji table pinned
in `data/japanese-source.json`, including its output and pending-continuation
columns. `data/sources/mozc/` retains the upstream table and license; normal builds
are offline. Tests check asset hashes and every table row, plus incremental
prefixes and native/WASM parity. Prototype and historical ablations remain frozen.

Japanese conversion uses composed kana readings, not exact roman aliases.
`nihongo`, `nihonngo`, and `nihon'go` share 日本語. `toukyou` offers 東京;
`tokyo` composes ときょ and no longer offers 東京 via a demo shortcut.

## Imported dictionary

Expanded conversion looks up complete readings in `data/japanese.tsv`, a
69,097-entry subset of Mozc's open-source (IPAdic-derived) dictionary pinned in
`data/japanese-source.json`; see `data/sources/mozc/README.md` for the
selection. Each pair is scored the way Mozc scores a word converted on its own
(sentence-start connection cost, word cost, sentence-end connection cost), and
that standalone cost both selects the subset and orders alternatives: `sakura`
offers 桜, さくら, サクラ; `arigatou` offers ありがとう before 有難う; `kan `
offers 感, 間, 館. The prototype's demo words remain as a fallback after
imported alternatives.

Conversion is per space-delimited token and waits for a complete reading. A
trailing pending `n` (`kan`) still shows かn and commits かん, as in Mozc before
conversion; a following boundary (`kan `, `kan.`) converts it. Word-plus-particle
spellings such as `kyouha` are not split, so they stay kana unless the compound
itself is an entry. Homophone order has no sentence context, so `kougi` offers
講義 before 抗議. Mozc's segmentation, suffix dictionary and context transitions
are not imported, and we do not claim Mozc application/session compatibility.

Imported evidence scores 1.45 per spelling character in the expanded profile,
below common English spelling evidence (1.8 through SCOWL tier 35) and above
rule kana (1.2). Common English words that are also readings stay English on
their own (`to`, `sake`, `hone`); rarer SCOWL spellings such as `sushi` or
`demo` stay English standalone by a small margin that Japanese context outweighs
(`kore ha sushi desu` → これ は 寿司 です). A capitalized token keeps only the
rule-kana rate on top of the existing case penalty, so `Tanaka` stays Latin
while `tanaka` converts to 田中. The frozen prototype keeps its demo-word rate.

Kana-annotated tests and evaluation targets accept an imported conversion of
the same reading (the `reading` field on converted parts); kanji choice follows
the data and is evaluated separately on 100 sourced Japanese words. Katakana of
an imported reading is offered where Mozc lists it (コーヒー, サクラ) or when the
candidate list has spare capacity; for readings with many imported alternatives
the rule-katakana variant may fall outside the five shown.

The table supplies previously missing aliases, doubled m/l, small ヵ/ヶ and the
www continuation rule. Newly valid Japanese paths can change mixed-language
ranking: `hellosakura` now defaults to へっぉさくら because ll is valid romaji.
The Latin alternative remains available. This is a known ranking limitation,
not an intended English-to-Japanese transliteration or permission to split tokens.
One frozen Chinese typing prefix, QWERTY `wu`, now ranks う instead of Latin wu;
the completed Chinese targets are unchanged.

Polytype's mixed-language interface still keeps Space as tone/language boundary,
retains ASCII suffix punctuation, and uses its own language ranking. The public
composer supports the upstream punctuation rows; the decoder's existing global
boundaries/suffix handling take precedence in mixed-text search. No 注音 rules or
English scoring weights changed. These interface differences are explicit rather
than additional romaji conventions.

Candidates with identical preedit but different commit outcomes now survive
deduplication. Bare `n` can commit literal n, ん or ン; the demo labels ambiguous
preedit with its commit outcome so these choices can be distinguished.

## Japanese n convention

Expanded/default Polytype consumes both letters of `nn` as one `ん`, with no
second n retained as the onset of the next syllable. This follows the explicit
`nn` row in [Mozc's romaji table](https://raw.githubusercontent.com/google/mozc/master/src/data/preedit/romanji-hiragana.tsv).
The link and rule were reviewed on 2026-09-11; this is not a claim that the entire
Polytype composer implements every Mozc rule.

| Input | Committed kana |
| --- | --- |
| shinyou | しにょう |
| shin'you / shinnyou | しんよう |
| konna | こんあ |
| konnna / kon'na | こんな |
| konnyaku | こんやく |
| konnnyaku | こんにゃく |
| konnnichiha / kon'nichiha | こんにちは |

A lone final `n` remains pending while typing and becomes `ん` on a boundary or
commit. Thus `shin` displays `しn`, `shinn` displays `しん`, and `shinny`
displays `しんy`. Backspace replays the remaining keys under the same rules.
Explicit katakana selection commits the same syllables in katakana.

The user's exact Colemak raw `dljjo;i` spells `sinnyou` (`si` and `shi` both
produce し); `shinnyou` uses raw `dhljjo;i`. Both now commit `しんよう`.

The previous n-onset convenience was a local invention. It produced `んな` for
`nna` and `んにゃ` for `nnya`, conflicting with the user's standard-IME typing.
It remains only in the frozen prototype profile and historical search ablations.
The public Rust composition helper, expanded JSON composition and expanded search
all use the corrected convention. There is no new user-facing mode or toggle.

The bundled prototype lexicon remains untouched. Reading-based expanded lookup
accepts `konnnichiha` and `kon'nichiha`; the old `konnichiha` input composes
`こんいちは`, without a contradictory dictionary override.

Frozen evaluation reports remain historical evidence, not silently rewritten.
The two island probes for `shinnyou` have an explicit expected-output migration
from `しんにょう` to `しんよう`. Other existing regression targets remain intact.
