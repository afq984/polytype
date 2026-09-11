# Japanese composition and conversion

## Compatibility baseline

Expanded/default composition uses the unmodified Mozc default romaji table pinned
in `data/japanese-source.json`, including its output and pending-continuation
columns. `data/sources/mozc/` retains the upstream table and license; normal builds
are offline. Tests check asset hashes and every table row, plus incremental
prefixes and native/WASM parity. Prototype and historical ablations remain frozen.

Japanese kanji lookup now uses composed kana readings, not exact roman aliases.
`nihongo`, `nihonngo`, and `nihon'go` share 日本語. `toukyou` offers 東京;
`tokyo` composes ときょ and no longer offers 東京 via a demo shortcut. Vocabulary
is still the same small local dictionary, not Mozc's dictionary or prediction
engine. We do not claim complete Mozc application/session compatibility.

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
