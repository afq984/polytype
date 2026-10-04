# First-tone language boundary

Expanded ranking adds `+tone-switch-v1` after `+bare-zhuyin-v1`. One Space permits a
language change after a dictionary-converted first-tone Chinese syllable:

| Input | Committed text |
| --- | --- |
| `ㄍㄤ␣call` | `剛call` |
| `ㄍㄤ␣␣call` | `剛 call` |
| `ㄍㄤ␣␣␣call` | `剛  call` |
| `ㄍㄤ␣11/` | `剛11/` |
| `ㄍㄤ␣v2` | `剛v2` |
| `ㄍㄤ␣gakkou` | `剛学校` when Japanese is enabled |

The completion Space prints nothing; every literal Space prints exactly once.
Selected-candidate commit remains atomic. Chinese after English still requires
its literal Space. Switching without any Space remains unsupported. There is no
spacing setting. Unknown readings, including bare Zhuyin initials, stay phonetic and cannot open this boundary;
an explicit custom dictionary conversion supplies evidence like an imported word.

## Decoder policy and ambiguity

The localized `Policy.tone_switch` gate reuses `converted_chinese`: the final
part must be a complete dictionary conversion whose raw keys end in Space.
It permits the existing Roman branches without changing the Chinese part or
inserting a separator. A phrase ending in a first-tone syllable qualifies too.
Prototype behavior is unchanged.

Dictionary evidence alone is insufficient: an English word can also have a real
Chinese reading (`of` in Colemak can become 剛 through unordered slots). A new
Roman edge pays two points per consecutive trailing first-tone syllable. The
count follows raw tone spaces across phrase/single edges, stops at another tone
or language boundary, and is independent of phrase segmentation. Charging just
once still let `i i mean` become `喔喔mean`. The opening also pays the existing
two-point discarded-key cost again for replacements in that trailing run: otherwise
`p95 latency` could become `齊latency`. This preserves the replacement operation;
it only weakens the new escape into Roman text. Chinese continuation and explicit
literal-space boundaries keep their previous scores.

At this new boundary, digit-bearing ASCII tokens containing only letters,
digits and `_./-` have number evidence at 2.5 points per unit or identifier
evidence at 1.8 when letters occur, before the opening cost. This permits
`11/`, `123` and `v2` while retaining their exact spelling. Pure ASCII punctuation
has a literal token path at one point per unit; the existing contextual Chinese
punctuation map still runs first and retains its preferences/ASCII alternatives.
In Colemak, physical raw `:` begins uppercase-O words at this boundary when
followed by Roman letters; a standalone key retains the Chinese colon path.
These are local boundary heuristics, not a general numeric tokenizer or a
contextual language model. Disabled languages remain disabled.

## Native comparisons

After `bazelisk build //:polytype-search`, diagnostic requests use `raw`,
`options` and `width: 12`:

| Flag | Meaning |
| --- | --- |
| `--experiment=current` | Current expanded policy |
| `--experiment=current+no-tone-switch` | Phase 1 behavior on the same dictionary and scores |
| `--experiment=current+no-tone-switch+first-tone` | Former unrestricted diagnostic, including its fallback escapes |
| `--experiment=baseline` | Frozen family-v1 policy and original 20k dictionary |

Historical experiments and prototype parity remain frozen. The browser exposes
no diagnostic flags. The original frozen files are unchanged.

## Development evidence and limits

The 3,200 sourced configurations reuse 550 utterances/sentences. Reviewed readings
are model-reviewed development annotations, not user-confirmed or held-out gold.
QWERTY en-zh target top one improves 157→174/300 and top five 197→223/300;
Colemak improves 154→169 and 197→223. Every explicit-separator, Chinese-only and
English-only aggregate is unchanged. English guards remain 192/200 top one,
200/200 top five and 8/200 wrong-language per layout. There are no paired target
losses on these groups or the prior GSD/guard/feedback/mixed/Japanese sets.

A new Roman interpretation can briefly lead while the next Chinese syllable is
unfinished. This is a typing UX cost even when the final target is retained.
Detailed paired prefixes, the old diagnostic's 24 frozen-prefix changes, probe
results and latency are recorded in the score stream's Phase 2 report. Automatic
homophone selection and short ambiguous tokens still require candidate choice.
