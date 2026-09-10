# Candidate-diversity sprint

Historical experiment: the checked-in reports predate continuation retention.
Current normal diagnostics also include the [English-island change](ISLANDS.md).
The native `--experiment=baseline` mode reproduces family-v1 at width 12;
`--baseline` remains the older pre-family baseline. Do not overwrite these
historical reports and attribute later improvements to family retention alone.

## Frozen experiment plan

diversity-controls.json contains 24 synthetic controls plus two explicitly
ambiguous probes. They were authored before baseline diagnostics and are not
used by dictionary importers. Run roman controls in both layouts, all languages
and EN+JP; Chinese-containing controls use all languages in both layouts.
These targets are development annotations, not a held-out accuracy claim.

Compare the unchanged beam of 12 against 48 and 192, retaining full final beams
for diagnostics. Wider finite searches are evidence, not an oracle. Record
whether targets are recovered, survive below top five, or are not found within
tested limits. Count near-duplicate kana-script variants separately from distinct
language/segmentation choices. Preserve the original six provisional targets.

Only make a retention change if wider search or variant diagnostics demonstrate
lost useful paths. Freeze scoring weights and dictionary data. Keep the prototype
profile identical. Do not implement segment constraints or a correction UI here.

Acceptance: no loss of existing correct top-one or top-five cases; preserve
Chinese baseline 12/20 top one and 17/20 top five, all guards and feedback, exact
spaces, explicit katakana selection and pending-n commit. Report every changed
or unresolved case rather than redefining targets. Measure latency against the
baseline in alternating same-machine runs, targeting no more than 15% p95
regression; report repeated measurements rather than a portable absolute limit.

## Implementation and reproduction

The shipping expanded search keeps its total beam width of 12. When full, it
evicts a lower-ranked kana-script sibling from an overrepresented family before
discarding a distinct interpretation. The soft cap is two per family in search,
one when selecting the final five; unused capacity may still hold siblings.
Original scores, literal-English retention and prototype behavior are unchanged.

Families use interned parent IDs and each part's raw span, language, output,
pending state, completion and commit output. Only rule-generated hiragana versus
katakana is folded. Different dictionary outputs, segmentation and context stay
distinct, including across spaces. This is not a last-language bucket. Less useful
script permutations can disappear from a full list; explicit single-token
katakana alternatives and selected-script commit remain tested.

```sh
npm run diagnose:search -- eval/diversity-baseline.json --baseline
npm run diagnose:search -- eval/diversity-after.json
node scripts/compare-search.mjs
npm run evaluate
```

The native diagnostic binary requires the opt-in diagnostics feature and accepts
widths from 5 through 192. The web protocol has no beam-width or baseline switch.
The baseline mode reconstructs the pre-sprint retention policy with identical
scores/data. Reports retain all cases, exact ranks, acceptable-alternative ranks,
full-beam ranks and family counts. The independent literal fallback is present
in displayed candidates but not in the raw lattice dump.

See [results and unresolved cases](diversity-report.md). No scores or dictionary
entries were changed. The two original top-one TODOs remain unresolved; a useful
alternative is not evidence that the provisional target is unambiguous gold.

For latency, preserve a pre-sprint built web/ snapshot (engine.mjs, keyboard.mjs,
pkg glue/WASM, and a parent package.json with type:module), then run:

```sh
node scripts/benchmark-search.mjs /path/to/baseline/web/engine.mjs eval/diversity-latency.json
```

The report records five alternating-order measurements after warmup, without
embedding the snapshot path or machine identity. Run without competing builds.

## Measured outcome

The three previously all-English collapses now produce mixed-language top-one
output. Exact top-one remains 4/6 in each setting; top-five rises to 5/6 in both
QWERTY settings and Colemak EN+JP, while Colemak/all stays 4/6. All four mixed
configurations now have 5.9% CER (previously 14.0% QWERTY/all and 19.9% Colemak/all).
The Latin-name target is rank 3 in the three improved settings. It remains missing
in Colemak/all at width 12, and the combined rebase/mite target remains unresolved.

No previously correct top-one or acceptable top-five control was lost. Chinese
remains 12/20 top one, 17/20 top five; guards 22/22 and feedback 5/5 are unchanged.
The eight failing mixed configurations now display five interpretation families
instead of two (including literal fallback). More diversity is not itself proof
of correctness; the report keeps exact target ranks and remaining errors.

The final latency run used 3,889 prefixes per round and verified the preserved
baseline WASM snapshot against all 163 recorded baseline candidate lists first.
Median paired p95 increased 11.6%, within the predeclared 15% budget; individual
rounds increased 9.0–12.0%. See diversity-latency.json for raw measurements.
This is a measured CPU-cost tradeoff, not a claim of equal performance.
