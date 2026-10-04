# Local segment correction

Click a preedit segment, or press ArrowDown with the raw editor focused, to open
its alternatives. A chosen alternative locks its original raw span and re-decodes
the rest. The full preview shows neighboring changes before applying. Enter then
commits the selected whole candidate, including every lock. Choices are local to
this composition; they are not learned or stored automatically.

In the menu, Left/Right move between segments, Up/Down highlight alternatives,
and unshifted 1–9 choose a numbered conversion. Enter applies; Escape cancels
the preview. Tab closes the preview and moves focus. Space and other typing close
it and edit at the saved raw caret. Backspace/Delete perform a raw edit and release
locks they touch. Space never opens/selects a candidate. Outside the menu, tone/
number keys and caret navigation retain their meaning; Escape clears composition.

Persistent English, raw-key, hiragana and katakana choices appear when applicable.
English maps physical keys through the selected layout; raw keeps QWERTY physical
positions. New captures use raw encoding version 2: Colemak raw `P` is colon and
raw `:` is uppercase O. Only enabled linguistic languages appear. Chinese phrases expose raw
syllables; Shift+Left/Right or Extend combines adjacent Chinese units up to 12
syllables. Literal separators, punctuation and other locks stop merging. Tone
Space stays inside its syllable. Spacing and automatic language boundaries are
unchanged. Nine ranked conversions are shown, with truncation labelled; local
resegmentation uses beam 12. A missing choice is not proof of unreachability.
An incompatible full preview cannot be applied. Unlocked neighbors may change.

Paired punctuation is also selectable, with exactly two choices and no language
or raw-key actions. The pairs follow the punctuation map: `<`/，, `>`/。, `?`/？,
`!`/！, `:`/：, `'`/、, `"`/；, `[`/「, `]`/」, `{`/『, `}`/』, `(`/（ and `)`/）.
Colemak physical `P` selects the colon pair. Unpaired punctuation stays outside
menus. Punctuation locks preserve raw keys and remain punctuation; they do not
provide dictionary-converted Chinese evidence. Unsupported lone initials show
bare Zhuyin after tone Space in the menu and preview, retaining fallback scores.

Inside edits remove a whole lock; preceding edits shift offsets. Extending a Roman
word or unfinished Zhuyin unit releases its lock; completed Chinese survives new
syllables. Separator removal can release a Roman lock. Ambiguous repeated-text
edits conservatively release affected locks. Settings clear locks; dictionary
changes revalidate them. Unlock/Unlock all preserve raw. Clear, commit, examples,
replay and blind capture reset locks. Blind capture hides correction/predictions.

Explicit debug reports and saved/exported cases carry applied constraints, using
`+segment-v1` only when constraints exist. Uncorrected capture identities stay
unchanged. No typed text or choices are automatically logged or uploaded.

## Native and protocol v1 APIs

`Engine::decode_constrained`, `Engine::segments`, `Engine::alternatives` and
`Engine::rebase_constraints` provide correction in expanded engines. Prototype
engines reject nonempty constraints and correction operations. Omitted/empty
constraints preserve ordinary decode, including its result shape and scores.

```json
{"version":1,"op":"decode","input":"y94 hello","options":{"layout":"qwerty"},"constraints":[{"start":0,"end":3,"text":"再","lang":"TW"}]}
{"version":1,"op":"segments","input":"us3lc3 hello","options":{"layout":"qwerty"},"candidateIndex":0}
{"version":1,"op":"alternatives","input":"us3lc3 hello","options":{"layout":"qwerty"},"candidateIndex":0,"start":0,"end":3}
```

Constraints are request-level fields alongside `options`. Their `[start,end)`
UTF-16 offsets count original tone/replacement keys and align with Unicode scalars.
`text` is finalized output; `lang` is `TW`, `JP`, `EN`, explicit `RAW`, or `punct`
for a mapped punctuation pair. Punctuation spans occupy one original raw unit.
Input is
limited to 400 units; ranges cannot overlap. Source validation is independent of
the menu cap. Invalid/stale choices fail explicitly. Valid constraints with no
complete surrounding path return no candidates; every fallback respects locks.

The web methods are `decodeConstrained(raw, constraints, options)`,
`segments(raw, options, constraints, candidateIndex)` and
`alternatives(raw, span, options, constraints, candidateIndex)`.
`segments` returns part groups, syllable units and legal merge spans; alternatives
returns nine `items`, persistent `actions`, `truncated` and `searchBounded`.

`rebaseConstraints(oldRaw, nextRaw, constraints, options, edit)` returns
`{constraints, removed, edit}`. Optional `{start,end,inserted}` must exactly produce
the new input. The JSON op `rebaseConstraints` uses `input`, `nextInput`,
`constraints`, `options`, and optional `edit`. Without an edit, the core infers a
conservative scalar-aligned splice. Dictionaries remain atomic and per-engine.

This is a Rust search constraint, not a new dictionary entry or JavaScript decoder.
There is no native OS IME, general no-Space switching, Japanese intra-token phrase
conversion, pagination beyond nine, or trailing tone-Space extension in this feature.

A lock can begin directly after a dictionary-converted first-tone completion
Space, including a phrase ending in first tone. The constrained lattice applies
the ordinary tone-switch gate and opening cost; numeric/identifier choices use
the shared boundary evidence. Bare Zhuyin choices remain phonetic and require a
literal separator before an English or Japanese lock. See [first-tone
switching](TONE-SWITCH.md).
