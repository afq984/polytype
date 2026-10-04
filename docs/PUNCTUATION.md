# Contextual Chinese punctuation

Expanded ranking `scowl-context-v4+family-v1+island-v1+mozc-v1+jpdict-v1+zh-punct-v1+freq-v1+physical-keys-v2+zh-parens-v1+bare-zhuyin-v1`
uses the following subset of McBopomofo's standard-layout punctuation. Prototype
engines and the frozen reference retain their previous behavior.

Source: [BPMFPunctuations.txt](https://github.com/openvanilla/McBopomofo/blob/f5ba010ce8795d283ee336ca7d16380f200bd2ec/Source/Data/BPMFPunctuations.txt),
the same revision as `data/chinese-source.json`. SHA-256:
`3058fd5fb933a5919900caa7332c2d1a95cd11a2a2ff56e51526a4daa4c95083`.
The upstream MIT notice is already retained in `data/sources/mcbopomofo/`.

| Physical key | Normalized raw | Chinese form | Source lines |
| --- | --- | --- | --- |
| Shift+Comma | `<` | `，` | 242–246 (Standard) |
| Shift+Period | `>` | `。` | 247–252 (Standard) |
| Shift+Slash | `?` | `？` | 203 (generic) |
| Shift+1 | `!` | `！` | 193 (generic) |
| Shift+Semicolon; Colemak Shift+P | `:`; Colemak `P` | `：` | 255 (Standard) |
| Quote without Shift | `'` | `、` | 253 (Standard) |
| Shift+Quote | `"` | `；` | 254 (Standard) |
| Left bracket without Shift | `[` | `「` | 187 (generic) |
| Right bracket without Shift | `]` | `」` | 188 (generic) |
| Shift+Left bracket | `{` | `『` | 208–214 (generic) |
| Shift+Right bracket | `}` | `』` | 215–221 (generic) |
| Shift+9 | `(` | `（` | 201 (generic; Standard inherits this mapping) |
| Shift+0 | `)` | `）` | 202 (generic; Standard inherits this mapping) |

`:` is Roman uppercase O in Colemak encoding version 2, so it is not a Roman
token boundary there. A standalone mark after converted Chinese retains the
physical colon interpretation and full-width preference. Following Roman letters
also permit an uppercase-O word after a literal-space boundary. Colemak Roman colon uses physical raw
`P` and keeps the old colon segmentation and scores. See
[capture migration](../eval/COLLECTION.md) for older raw buffers.

Standard-specific entries override generic entries: in particular, generic
`'` and `"` have different mappings. McBopomofo supplies multiple equal-score
alternatives for `<`, `>`, `{` and `}`. This prototype chooses the first listed
entry for each: comma, ideographic period, double corner opening/closing quote.
These are explicit subset choices, not a claim to implement McBopomofo's full
punctuation palette or candidate UI. Unshifted quote and bracket keys are free
of Zhuyin syllable meanings; Shift is unnecessary for `、「」`.

The last nonspace, nonpunctuation interpretation establishes context. A completed
dictionary-converted Chinese part prefers the mapped form by 0.25 points; its ASCII branch retains
its exact prior score. A completed unsupported reading that remains raw Zhuyin
is not converted Chinese context: it must not gain a new boundary that can
reinterpret quoted English. Dictionary evidence is checked independently of
output script, preserving custom entries that convert to literal phonetic text. Contexts where ASCII was already preferred retain that
preference, with the mapped alternative 0.25 points lower. Existing Japanese
Mozc punctuation choices are preserved. Both branches
remain selectable in the bounded candidate list for the focused single-mark
cases. Multiple marks and homophones still compete for five displayed slots.
ASCII parentheses stay preferred in English, Japanese and code. After Chinese,
parentheses follow the same +0.25 preference and keep ASCII selectable. Context
skips punctuation parts, including pasted `（`/`）`, so `了(?` and `了（?`
both prefer `了（？`. The source has no Standard-specific parenthesis override;
its generic `_punctuation_(` and `_punctuation_)` rows apply to Standard.

Explicitly pasted Chinese marks remain literal. Punctuation clears the current
continuation language as before; literal spaces are preserved and first-tone
spaces still only complete a syllable. The existing attached English possessive
(`注音's`) and Japanese romaji apostrophes remain supported.

Roman token segmentation and its ASCII scores are preserved. A literal trailing
mapped key gains an alternative rather than becoming a global token delimiter;
this keeps operators, quoted code, contractions and time strings intact. Mozc's
romaji table still maps ASCII `[` and `]` to corner quotes: `gakkou [` remains
`学校 「`, `gakkou ]` remains `学校 」`, and `hello[` retains `へっぉ「` at top
one. Japanese punctuation is outside this change's scope. The public romaji
composer is unchanged.
`web/keyboard.mjs` already produces every required raw key, so it is unchanged.

For an ablation with current dictionaries/romaji/beam policy, pass
`--experiment=current+no-parentheses` to disable only this parenthesis extension,
or `--experiment=current+no-punctuation` to disable the full map in the native runner. The
historical `--baseline` and named family-v1 experiments remain unchanged;
`punctuation` enables the new flag within those diagnostic combinations.
No setting or diagnostic flag is added to the web UI/protocol.

## Numbers

`eval/punctuation-cases.mjs` records seven desired numeric probes in both layouts.
No digit/tone rule changes ship. At this baseline, `下午 3 點`, `11.6%` and
`下午 11.6%` work; `下午3點`, `2026 年`, `第 2 版` and `v2` fail. A standalone
`2` followed by Space finalizes ㄉ, rendered as a bare chat fallback without
`ˉ` (the edition probe changes `的 ㄉˉ版` to `的 ㄉ版` but still fails its numeric
target; see [chat initials](ZHUYIN-CHAT.md)). Meanwhile, `2026`
normalizes as Zhuyin with replacement and a second tone. Local punctuation
context cannot reliably disambiguate these without affecting ordinary tone
input. Exact candidate rows and raw keys are in the stream report.

A future explicit literal/numeric span constraint could preserve ASCII digits
and decimals and permit returning to Chinese after a literal separator. That
needs a designed interaction for selection/editing and independent digit-heavy
Chinese controls. Automatically treating unspaced digits as numbers would also
change normal Zhuyin completion; it is not implemented here.
