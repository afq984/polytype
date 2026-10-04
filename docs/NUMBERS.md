# Numbers at Chinese boundaries

## Dotted numbers after Roman context

`+roman-dotted-numbers-v2` preserves a well-formed decimal or dotted version
after a literal Space following EN/JP. Components are nonempty ASCII digit
runs separated by periods, with an optional leading sign, trailing percent,
and terminal `. , ; ! ? ) ] }` punctuation. Thus `version 1.03` stays literal
instead of converting replaced ㄡ/ㄢ keys into 版. The token receives the
existing numeric score (2.5 per digit). Chinese readings remain in the whole
candidate list below it, including high-scoring custom words. A ceiling carries
the consumed digits' numeric evidence through Chinese singles and phrases
within the token. It reserves a quarter point below the number and prepays
later punctuation credit, so continuations cannot escape the ceiling. Explicit
Chinese locks still win and the local menu retains Chinese choices. English
must be enabled. Thus `PC 1.03` with custom ㄅㄢˇ→自訂 offers the numeral first
and `PC 自訂` second. A nonnumeric first-tone input such as `deadline 5. u␣`
retains `deadline 週一`, with 州一 still selectable.

`Policy.roman_dotted_numbers` controls this rule alongside `Policy.numbers`;
`current+no-roman-dotted-numbers` reproduces main `a341ff71` traces.
`current+no-dotted-alternatives` disables `Policy.dotted_alternatives` to replay
the Phase 2b exclusion while keeping its numeric preference. Historical
ablations and the prototype keep their preceding behavior. Token analysis is
shared with numbers-v2 and cached once per reachable offset. No scoring/data
change is made to integers, times, Chinese-only typing, or malformed dotted
forms. Letter-prefixed versions such as `v1.03` are outside this pure-digit
dotted grammar. Clean Chinese boundaries retain the existing precedence below.

The broader `roman-numbers-v1` experiment was rejected: digit-only homographs
such as `53` must remain numbers after English. PC 版, soccer 吧 and HK 啊 C
remain rank-two Chinese alternatives recoverable with one local correction.
The [Roman-number development guards](../eval/README.md#roman-dotted-alternatives-phase-2c)
make that ambiguity and the rejected-build regressions visible. These are
synthetic development probes, not held-out coverage.

## Existing Chinese-boundary behavior

Expanded ranking appends `+numbers-v2`. `Policy.numbers` controls the behavior;
`--experiment=current+no-numbers` reproduces the preceding main engine with the
same dictionary. `Policy.numeric_prefix` protects unfinished Chinese;
`current+no-numeric-prefix` reproduces numbers-v1. Historical native ablations
and the prototype stay unchanged.
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

At the end of input, a clean unfinished Zhuyin reading keeps its phonetic
display ahead of the numeric alternative when Chinese is enabled. It must have
no discarded/repeated/replaced keys and match a subset of the slots of an actual
imported or custom syllable; slot order remains unrestricted. Completed preceding
syllables also need clean dictionary coverage. Thus `5`, `5j`, `5j/`, `wu0`,
`ru8` and `1` keep ㄓ, ㄓㄨ, ㄓㄨㄥ, ㄊㄧㄢ, ㄐㄧㄚ and ㄅ while typing.
The cached slot subsets come from dictionary readings, not evaluation text.
The independent English fallback also respects the original Chinese setting.

The lower numeric alternative receives 0.3 per key minus 0.1, just below a clean
phonetic fallback; this pending alternative has no first-tone opening cost so
it stays selectable after Chinese. Ordinary and explicitly locked numeric edges
reuse this score. Without Chinese enabled, or with discarded/replaced keys or
an invalid syllable (`17` = ㄅ˙), ordinary numeric evidence can win immediately.
After a Space or a non-Zhuyin punctuation boundary, complete-token evidence
applies. Physical `.` is also ㄡ, so unfinished `5.` remains ㄓㄡ; QWERTY `5:` is Roman
punctuation. A valid first-tone Space still converts `5␣` to 之, whereas
`1␣` is the literal `1 ` because standalone ㄅ has no clean dictionary reading.

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
An unfinished numeric `5` also matches clean ㄓ, so `只剩 5` has the numeric
answer second until a boundary or explicit selection resolves it. The synthetic
controls and every Chinese prefix are measured in
[the development report](../eval/NUMBERS.md).
This is development evidence for a local prototype, not native IME support or
held-out accuracy.
