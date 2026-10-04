# Bare Zhuyin chat initials

Expanded ranking `+bare-zhuyin-v1` supports chat initials such as ㄅ, ㄉ, ㄇ
and ㄏ without adding informal spellings to a dictionary. An initial followed
by Space completes a first-tone syllable. If its normalized slots contain only
an initial and no single-character dictionary entry exists, the fallback text
is that initial without `ˉ`: `1 ` displays ㄅ. Raw keys, slot replacement and
completion metadata are unchanged. A second Space is literal: `1  ` displays
`ㄅ `. The existing weak fallback score (0.3 per occupied slot) is unchanged;
ordinary dictionary readings and English words retain their precedence.

For example, type the reading of 還可以, then `1 `, then a literal Space and
the reading of 不過: the Chinese path displays `還可以ㄅ 不過`. The completion
Space emits no character. One literal Space permits a language change; it is
not supplied implicitly by completing a tone.

Enter each laughter symbol separately: `c c ` gives ㄏㄏ. `cc ` still uses one
initial slot and gives ㄏ; `1q ` replaces ㄅ with ㄆ. This feature preserves
the existing unordered slots and same-category replacement contract.

Only implicit first-tone marks are removed. Explicit second, third, fourth
and neutral tones remain visible (`16` still gives ㄅˊ in Zhuyin-only mode):
they express a tone rather than the requested Space-based chat convention,
and removing them could hide an incorrect or unsupported reading. Unsupported
multi-slot readings retain their phonetic display, including tone marks.
Valid syllabic initials, such as ㄓ with a dictionary entry for 之, still
convert. Atomic per-engine custom entries can also supply a conversion for a
chat initial, which takes precedence over the fallback.

Bare fallback is still unconverted text; it does not count as dictionary
evidence for Chinese punctuation. This preserves the guard against a raw
phonetic interpretation creating a new boundary inside quoted English.
Prototype/reference behavior and historical search ablations are unchanged.
The native `current+no-bare-zhuyin` ablation restores the prior fallback display.
