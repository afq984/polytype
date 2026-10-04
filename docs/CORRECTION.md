# Local segment correction

Click a preedit segment, or press ArrowDown with the raw editor focused, to open
its alternatives. A chosen alternative locks its original raw span and re-decodes
the rest. The full preview shows neighboring changes before applying.
The menu replaces sentence candidates in the compose card. Its compact preview
scrolls horizontally for long text; long menus scroll inside the candidate slot.
Opening the menu preserves the page scroll position and the raw caret.
Correction controls sit in the status line; key help is in Typing tips. Enter then
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
Local Chinese choices use the shared frequency, custom-priority and discarded-key
scoring from ordinary search. Japanese dictionary and script choices share its
scoring helpers too; neighboring language bonuses belong to the full preview.

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

Converted Chinese locks provide the same contextual punctuation evidence as
ordinary converted parts. Unsupported Zhuyin and RAW locks do not gain that
evidence. Roman choices can start after a mapped Chinese mark; the full lattice
still enforces whether the preceding input actually creates that boundary.

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

## Bounded recovery evaluation

Use `bazelisk run //:evaluate_local -- CASES.jsonl --correction`, or add
`--extra-cases=PATH.mjs --correction` to evaluate an additional case module.
The optional metric starts from ordinary top one and searches the real correction
API to depth two with a budget of 2,000 attempted distinct constraint states per
case. It reports 0, <=1, <=2 and unresolved, separately from whole-candidate top
five, with menu truncation and budget exhaustion labelled. Successful paths are
saved as choice/unlock actions and can be replayed through native/WASM. Captured
constraints are replayed for ordinary expanded evaluation but ignored as starting
locks for this metric, so they do not supply free corrections. Prototype evaluation
uses the uncorrected input and labels captured constraints as unsupported.

Unresolved is not proof of unreachability. These are development measurements,
not held-out accuracy. A single-span edit plus commit costs three mouse clicks or
three keys from an already-positioned caret; navigating, splitting and merging add
actions. Automated UI-action counting is deferred.


## Local ambiguity cue

A dotted underline replaces the ordinary Chinese underline when an unlocked
segment's `confidenceMargin` is at most 0.5. Its accessible description invites
review with ArrowDown or a click. Nothing flips automatically. Locks, spaces,
punctuation, English/Japanese and unsupported single-choice spans have no cue;
blind capture never requests segments or renders cues. Height and keys stay the same.

The Rust segment API computes the chosen Chinese local score minus the best
different finalized Chinese output for the identical raw span, before the menu's
nine-item cap. It shares Chinese source scoring and beam-12 resegmentation with
the alternatives API. `confidenceMargin` is null without a competitor, for
non-Chinese segments, locks and split units without their own output. This is
local score ambiguity, not calibrated probability or sentence-level correctness;
cross-language and missing-source errors can be unmarked. Ordinary candidate
text, scores and traces are unchanged.

`bazelisk run //:confidence_diagnostics` measures the 300 ASCEND development
sentences in target QWERTY en-zh, using gold reading/key spans to compare each
editable top-one segment to the corresponding target output. No user dictionary
is loaded. Predeclared thresholds were -0.5, 0, .25, .5, 1 and 2. There are 3,129
editable segments and 160 wrong segments, with no unscorable spans.

| Threshold | Marked | Wrong marked | Precision | Recall | Mark rate |
| --- | --- | --- | --- | --- | --- |
| -0.5 / 0 | 0 | 0 | n/a | 0% | 0% |
| .25 | 36 | 17 | 47.2% | 10.6% | 1.15% |
| .5 | 89 | 57 | 64.0% | 35.6% | 2.84% |
| 1 | 206 | 109 | 52.9% | 68.1% | 6.58% |
| 2 | 779 | 141 | 18.1% | 88.1% | 24.90% |

The .5 threshold catches over a third of errors while marking under 3% of
segments. Thirty-two correct segments receive a cue; 103 wrong segments do not.
These selected development readings are visible evidence used for threshold
selection, not held-out validation or representative accuracy.

## Explicit Remember

Apply a Chinese or English alternative, then reopen the locked segment's menu.
**Remember** saves that applied choice in this browser; merely previewing,
applying or committing never learns anything. Click Remember, or use the existing
ArrowDown navigation to reach it after the local alternatives and press Enter.
The action is highlighted and announced separately. All existing numbered
conversion, arrow, Enter, Escape, Space and Tab bindings keep their meanings.
Remember is hidden without an eligible applied choice. Japanese, raw keys,
punctuation and unfinished Chinese choices cannot be remembered here.

Chinese entries use composed readings supplied by the Rust alternatives API as
`rememberReading`, including normalized slot replacement and tone. They use the
existing `polytype-custom-tw-v1` reading/text array and atomic per-engine dictionary
replacement, with the explicitly remembered entry first. The existing dictionary
panel displays them and removes them. Nothing is added to checked-in dictionaries.

English uses a separate `polytype-custom-en-v1` array of exact case-preserving
spellings, at most 200 words, each 1–40 ASCII letters/digits/apostrophe/hyphen/
underscore units with at least one letter. Trailing period/comma/semicolon stays
in output and is omitted from the remembered spelling. No case folding, fuzzy
matching, word counts, context statistics or automatic additions occur. Rust
maps physical keys through the selected layout and prefers the existing literal
English path for a matching whole token through the correction lattice. The
lattice retains language boundaries, including converted first-tone Space;
explicit composition locks win. If remembered preferences cannot produce a full
path, the engine retries with explicit locks only. Preferences apply only when
English is enabled. Removing the entry restores ordinary ranking for future
compositions; existing explicit locks remain until unlocked.

`Engine::set_custom_english_entries` / protocol `setCustomEnglishEntries` /
web `setCustomEnglishEntries` atomically validate and replace the per-engine word
list. Chinese replacement preserves English entries and vice versa. Prototype
engines reject custom English. `dictionarySize.englishCustom` exposes the count;
empty user data preserves ordinary candidates byte for byte. The dictionary
panel lists removable English words and **Export dictionary (JSON)** exports
`{version:1,chinese:[{reading,text}],english:[word]}`. Restoring exports uses the
explicit engine setters; this prototype has no dictionary import control.

Denied storage keeps entries and export available in the current session.
Corrupt/unreadable stored lists are preserved and never overwritten by subsequent
session edits. Clearing browser data can remove saved entries. Debug and case
captures still omit dictionary lists; `customEntryDependent` flags nonempty user
dictionaries and counts include English entries. English-dependent captures append
`+remember-en-v1` to their ranking identity. Reproduction needs separately restored
user entries. Tests, the evaluator and confidence diagnostics instantiate empty
engines and never load browser storage. Blind capture hides menus and markers.
