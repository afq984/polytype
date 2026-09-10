# Candidate-diversity sprint

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
