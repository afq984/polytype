# Japanese n convention

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

The bundled lexicon remains untouched for prototype parity. Expanded lookup
migrates the existing greeting entry to `konnnichiha` and `kon'nichiha`; the old
`konnichiha` input now composes `こんいちは`, without a contradictory dictionary
override. No other vocabulary or ranking weights change.

Frozen evaluation reports remain historical evidence, not silently rewritten.
The two island probes for `shinnyou` have an explicit expected-output migration
from `しんにょう` to `しんよう`. Other existing regression targets remain intact.
