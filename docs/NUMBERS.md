# Numbers at Chinese boundaries

Expanded ranking appends `+numbers-v1`. `Policy.numbers` controls the behavior;
`--experiment=current+no-numbers` reproduces the preceding main engine with the
same dictionary. Historical native ablations and the prototype stay unchanged.
The browser exposes no experiment flags.

A numeric or short identifier span can start at sentence start, after literal
Spaces immediately following converted Chinese, or at the existing converted
first-tone switch. English must be enabled. The new evidence does not extend
across punctuation to manufacture Chinese context inside English/code. Existing
English/Japanese number continuity remains in place. Attached Chinese/numeric
switching without a Space is outside this feature.

Whole numeric spans preserve ASCII spelling, including internal time/date/range
marks, signs, currency prefixes and percent suffixes. Examples include `17`,
`2025`, `5090`, `x3`, `v3`, `Q3`, `M2`, `11:25`, `1/2`, `+0.3`, `70%`,
`NT$120` and `3.8-27B`. Components contain one digit run with optional letter
prefix/suffix, separated by `._/:-`. Lowercase prefixes are at most three
letters; uppercase prefixes can be longer. Trailing `/`/`-` and Roman sentence
punctuation are accepted as incremental numeric forms. These are conservative
syntax cues, not a parser for every programming language or identifier.

Clean Chinese dictionary evidence takes precedence: parse the original physical
keys, require complete syllables with no discarded units, then check a partition
into imported/custom singles or phrases. The following Space is also tested as a
possible first tone. Thus ordinary digit-key words and `2u04wj6` after 心 cannot
receive the former unconditional digit-bearing identifier bonus. A completed
alphabetic Chinese syllable followed by unfinished keys without a Space also
stays on the Chinese path (`us3l` remains 你ㄠ while typing 你好).

Eligible numeric evidence sums 2.5 per digit and 1.8 per ASCII letter; punctuation
adds no evidence. The existing first-tone opening cost still applies (two per
trailing first tone plus discarded-key cost). Numeric analysis is cached per
reachable offset. Ordinary edges and explicit English locks reuse that analysis
and score. Empty constraints delegate to ordinary decode. Dictionary data,
discard penalties, unordered slots and same-category replacement are unchanged.

Every literal Space prints. A first-tone completion Space prints nothing:
`ㄍㄤ␣17` gives `剛17`; `ㄍㄤ␣␣17` gives `剛 17`. A digit token interpreted
as numeric consumes no tone Space, so `17␣` gives `17 `, while Chinese-only
mode still gives `ㄅ˙ `. Raw `:` after Chinese keeps its `：` preference;
the colon inside a numeric time stays ASCII. A physical Colemak colon/uppercase-O
key cannot turn an already converted Chinese prefix into an identifier.

Some numeric strings are also clean Chinese readings. Conservative precedence
leaves `19␣` as 掰 and `04/16` as 案甭; these remain visible numeric failures.
Conversely, unsupported first-syllable prefixes can temporarily become numeric
until a tone completes their Chinese reading. The synthetic controls and every
Chinese prefix are measured in [the development report](../eval/NUMBERS.md).
This is development evidence for a local prototype, not native IME support or
held-out accuracy.
