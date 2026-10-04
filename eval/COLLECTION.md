# Preparing the everyday typing benchmark

This is a collection and annotation protocol, not a completed benchmark or an
accuracy claim. The initial domain mix is deliberately broad. The user has not
selected a specific domain. Collect everyday typing across Traditional Chinese,
Japanese and English, including their combinations, conversation, names, code,
numbers and punctuation. An unusual mixed-script phrase can be a challenge case
without becoming a required baseline behavior.

## Storage and source terms

Keep new source text, raw keys, annotations, notices, snapshots and detailed
reports in a separate directory **outside every jj/Git workspace**. An ignored
directory inside the checkout is insufficient: Bazel's `eval/**` glob can still
copy its contents into build inputs and caches. The `corpus` tool rejects paths
inside repositories (including paths reached through symlinks). It creates new
directories with mode 0700 and files with mode 0600. Existing directory permissions
are the owner's responsibility. These permissions do not provide encryption.

The repository contains this protocol, tooling and original synthetic test
fixtures only. No new third-party corpus is downloaded by this workflow. Existing
checked-in development corpora and their notices remain unchanged.

Record each source in `sources.json`:

| Field | Record |
| --- | --- |
| `id`, `kind`, `title` | Stable opaque ID, source category and description. |
| `locator`, `revision` | Original source location and pinned revision/date/hash, where applicable. Keep personal identifiers in this external file. |
| `license`, `attribution` | The stated terms and required attribution; use "unknown" when unresolved. |
| `localEvaluation` | `pending` until the person reviewing the source records an appropriate basis for local use; then `allowed`. |
| `redistribution` | `unreviewed`, `restricted` or `allowed`, independently of local use. |
| `evidence` | Source/permission evidence and any restrictions. An `allowed` local-use record needs nonempty evidence. |

The tool records these decisions; it does not determine legal rights. Private
storage does not settle permission to obtain or use a source. Leave unclear
material unassigned until its provenance/use is resolved. Do not infer a license
for the user's text, or permission to redistribute it, from a browser export.
Keep third-party notices alongside the external source. Text-bearing reports and
adapted annotations need their own sharing review. There is no publish command.

## Start a collection

Run these commands from a Polytype workspace. Replace the example external path
with the private directory you want to use; `init` requires a new directory.

```sh
bazelisk run //:corpus -- init /absolute/private/polytype-corpus
bazelisk run //:corpus -- check /absolute/private/polytype-corpus
```

`init` creates `sources.json`, an empty `cases.jsonl`, `case-template.json` and a
copy of this guide. Only records in `cases.jsonl` are active; the template is not
an example result. It starts with unresolved input and review fields.

For captures, use **Save test case…**, review/edit the expected output, **Save
locally**, then **Export cases (JSONL)** in the demo. Move the export outside the
repository before importing. Nothing is captured automatically. Do not select
only failures: preselect short typing sessions or fixed intervals and capture
successful examples too. Exclude material you cannot retain; record that sampling
limit rather than silently treating the remainder as representative.

```sh
bazelisk run //:corpus -- import /absolute/private/polytype-corpus /absolute/private/export.jsonl personal-typing
```

Imports preserve exact `raw`, `text` and explicit input options, deduplicate exact
input/target/options matches, and enter as pending/unassigned. They carry no
automatic review, domain classification, event history or held-out status. Edit
the external JSONL to finish the annotations. Reimporting cannot reset reviews.
Browser exports omit custom dictionary contents; cases with custom dependencies
cannot enter this first benchmark. Keep them in the challenge queue for now.

## Annotation contract

One JSONL record describes one configuration of a text unit:

| Field | Meaning |
| --- | --- |
| `id` | Unique record ID, such as `case-0001-colemak`. |
| `unitId` | Shared by layouts, alternative raw spellings and language-option configurations of the same text. Configuration variants do not count as independent samples. |
| `inputVariant` | Optional spelling-variant ID (default `primary`); one reviewed layout is sufficient; additional layouts are optional. |
| `sourceId`, `sourceGroup` | Source registry ID and related-session/document group. Group excerpts, paraphrases, near-duplicates and variants together. Replace imported `needs-grouping` before freezing. |
| `split` | `unassigned`, `development`, `heldout`, `regression` or `challenge`. |
| `domain`, `languages`, `features` | Describe intended text, not the engine's prediction. Languages use `zh`, `ja`, `en`; features can include first-tone-space, names, numbers, code, punctuation, script-choice and replacements. |
| `raw`, `options` | Exact QWERTY-physical-position encoding (maximum 400 UTF-16 units), with explicit `layout`, `english`, `japanese`, `zhuyin`. Null while unresolved. |
| `text`, `acceptable` | Primary committed target and any separately reviewed acceptable alternatives. Match exact spaces, script, case and punctuation. |
| `captureKind` | `typed`, `transcribed`, `derived` or `unknown`. Blind browser captures import as `typed`; normal snapshots remain `unknown`. These are final buffers, not edit-event logs. |
| `customDictionary` | `none`, `required` or `unknown`; only `none` enters the initial benchmark. |
| `seenDuringDevelopment` | Whether this item or its engine output has informed development. Normal browser imports set this to true; blind imports start false. Historical cases remain exposed. |
| `review` | `status: pending` or `confirmed`, plus reviewer identifier and ISO review date `YYYY-MM-DD`. |
| `notes` | Reading decisions, input limitations and uncertainty; kept outside the repository. |

Before confirming a row, the user/reviewer verifies the input **and** target.
Do not accept the demo's prefilled candidate as gold without checking it. For
Japanese, choose kana versus kanji explicitly; preserve intended Latin words and
names. For Chinese, annotate citation readings independently of the tested
dictionary. Do not normalize away Space: it can finish first-tone Zhuyin or be
a literal language separator. Keep correction/replacement keys if actually typed.

A unit may use a single reviewed layout, including Colemak only. Optional Colemak
and QWERTY variants share the same intended output. `check` reports
`pairedLayoutUnits`: active units with both layouts for every annotated input
variant/language-toggle configuration. This is informational, never a freeze
blocker. Use actual typing or a separately verified transcription. Never apply a Roman
layout conversion to the whole mixed raw buffer: Zhuyin positions stay fixed.
Derived variants must be labelled and reviewed. The current uppercase-O Colemak
encoding limitation belongs in challenge coverage until it can be represented;
do not silently change case or drop a character to make a test pass.

Uncertain readings, disputed script choices, unsupported switching and examples
with unknown keystrokes stay `unassigned` or `challenge`, with pending review.
Do not rewrite a target to match current output. These queues are counted by
`check` but excluded from benchmark snapshots.

## Sampling and split preparation

Start with a 10–15-unit annotation pilot, then aim for **50–100 independent text
units**. This is a proposed initial sample size, not a statistical guarantee.
Cover each single language and each useful language combination. Include short
and longer compositions, successful typing and failures, exact first-tone/literal
spaces, names, numbers, punctuation and code. Record collection dates/method and
gaps in an external `SAMPLING.md`. Additional layouts are configurations of a unit, not independent samples.

Assign approximately 75% of new source groups to development and 25% to heldout
**before decoding or tuning**, balancing language mixes where feasible. Keep all
related text in one split. Historical user cases, the 20 Chinese excerpts, existing
synthetic controls and the six mixed lines remain development/regression evidence;
they can never become new held-out evidence. Synthetic probes are reported
separately from naturally occurring text.

Annotate held-out input/targets independently of engine predictions. The browser
capture workflow exposes predictions and is therefore used for development. For
held-out capture, enable **Blind capture · hide predictions** before typing. It
starts a fresh buffer, suppresses decoding/predictions, and asks for intended text
in a plain field after Enter or Save test case. Use your own OS IME there.
Exports carry `blind: true`; imports start with `seenDuringDevelopment: false`
and `captureKind: "typed"`, pending review and grouping. This flag records the
capture procedure, not proof that text was never seen elsewhere. Later non-blind
imports of the same input/target mark it exposed; blind reimports never unsee it.
For a stronger holdout, have a curator keep the held-out text away from the agent
doing tuning. `check`/`freeze` validate it without decoding; this is procedural
separation, not access control. Automated checks catch exact/normalized duplicate
targets and identical input/options across splits; a reviewer must still identify
semantic near-duplicates and shared source material.

## Check, freeze and record a baseline

```sh
bazelisk run //:corpus -- check /absolute/private/polytype-corpus
bazelisk run //:corpus -- freeze /absolute/private/polytype-corpus pilot-01
bazelisk run //:corpus -- evaluate /absolute/private/polytype-corpus pilot-01 development baseline-dev-01
```

`check` reports counts and numbered annotation blockers without printing text.
`freeze` requires active rows to have reviewed targets/inputs in at least one layout,
resolved local-use provenance and no custom dictionary dependency. It writes a
new exclusive `snapshots/NAME/` containing source metadata, selected cases,
split JSONL and SHA-256 hashes. Names cannot overwrite prior snapshots. Freezing
a small pilot does not mean milestone 1 is complete. No decoding occurs at freeze.

`evaluate` verifies the snapshot hashes, runs the existing prototype/expanded
evaluator and writes full results only to `runs/RUN_NAME/report.json`. Standard
output contains counts, not corpus strings; failed evaluator output is suppressed.
Run locally, never in CI or with an external corpus declared as a Bazel input.
Reports record hashes of the WASM engine, evaluator, preparation tool and snapshot.
Record the source revision and any working-copy changes in `SAMPLING.md` too.

The expanded results are the **current baseline** for later decoder changes.
Prototype results remain a historical comparison. Reports break out exact and
acceptable top-one/top-five counts by layout, intended language mix and domain,
along with CER against the primary target and the [milestone diagnostics](README.md)
(space-normalized counts, English exact, Han CER and wrong-language rate). They count configurations and distinct
units separately. Do not combine prototype-to-expanded gains with new sprint gains.

Held-out evaluation requires an explicit opening:

```sh
bazelisk run //:corpus -- evaluate /absolute/private/polytype-corpus pilot-01 heldout release-check-01 --open-heldout
```

A run records the opening before decoding. Once its results guide changes, that
split is development evidence for the next iteration; collect a new holdout.
The flag records deliberate exposure, not a legal approval. The tool does not
prevent the curator from reading local files or enforce a permanent access lock.

Run `bazelisk test //...` separately to preserve existing regression coverage.
For latency, use the existing same-machine alternating benchmark workflow after
choosing a baseline engine. Neither these untimed reports nor historical prefix
timings measure startup, rendering or actual user correction effort. Record
correction actions manually with a fixed procedure in a separate external log;
CER and candidate rank are not counts of actions.

## Milestone 1 acceptance

- Complete the annotation pilot and resolve ambiguous targets with the user.
- Collect 50–100 independent units with documented sampling limits and language
  coverage, including independently prepared held-out source groups.
- Review the collected layouts, exact spaces, target alternatives and source provenance.
- Freeze a versioned corpus; retain a development baseline with engine identity.
- Predeclare the next experiment's quality/regression and latency criteria before
  opening the holdout. Preserve existing guards and report language regressions.
- Report unrepresentable/challenge cases and missing correction-event measurements
  as gaps. Passing tooling tests alone does not satisfy this milestone.
