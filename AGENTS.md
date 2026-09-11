# Project instructions

Read HANDOFF.md before making changes. This is a prototype, not a finished native IME.

- The decoder source of truth is crates/polytype-core/ and data/. The web runs
  that core through crates/polytype-wasm/. Keep the web UI in web/.
- tests/reference/ is frozen migration evidence, not a second implementation.
  Do not add features there or add a JavaScript decoder fallback.
- Baseline parity uses the prototype dictionary profile; default engines use the
  expanded lexicon. Keep native/WASM parity tests for expanded input too.
- Generate data/chinese.tsv with scripts/import-chinese.mjs. Retain pinned source
  hashes and notices. Never use eval/ text to populate the dictionary. Report
  corpus selection limits and language regressions alongside improvements.
- Regenerate Polytype-Demo.html with bazelisk run //:refresh_demo after source edits.
  Do not edit generated HTML or web/pkg/ directly.
- Use bazelisk test //... for native/WASM behavior, differential parity,
  formatting and clippy. Bazel is the sole supported build workflow.
  Add focused regressions for real bugs.
- Preserve exact spaces: Space can finalize first-tone Zhuyin or be a separator.
  Keep literal-space language boundaries unless the user requests a change.
- The user's OS keyboard is already Colemak. Normalize physical positions once.
  Preserve unordered Zhuyin slots and same-category replacement before tone.
- 用 is ㄩㄥˋ (m/4), not ㄨㄥˋ. Do not add an incorrect alias.
- Preserve selected-candidate commit and atomic, per-engine custom dictionaries.
- Use jj, including in this colocated repository. Follow ~/.claude/CLAUDE.md:
  jj commit -m to start/finalize the work commit; edit @, then jj squash.
  Do not use git commands or jj describe plus jj new to create commits.
- Local development is the default. Do not publish or connect external services
  unless requested. Keep typed content local.
- The private-prepublication bookmark retains unsafe local history. Never push
  it, merge it into main, or use an all-bookmarks/tags push. Push only the explicit
  main bookmark. Audit new public commits for secrets and personal exports before
  pushing; artifact checks on GitHub do not sanitize source history or Actions logs.
- Add dependencies only for concrete purposes; keep Cargo.lock current and the
  wasm-bindgen CLI/library versions aligned.
- Distinguish measured behavior, proposed architecture and known limitations.
  Do not claim native IME support or broad dictionary coverage from this demo.
