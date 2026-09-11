# Bazel build contract

Bazel is the sole supported build, test and development entry point. Cargo.toml
and Cargo.lock remain dependency metadata for rules_rust and Rust editors;
package.json only declares ES modules and the Node version. There is no npm
installation or separate Cargo build workflow.

## Supported host and hermeticity boundary

The supported host is Linux x86_64, producing Linux x86_64 binaries and
wasm32-unknown-unknown WebAssembly. Install Bazelisk on a Linux system with a
working C/C++ linker and development sysroot (for example, Debian/Ubuntu's
`build-essential`). Bazel includes its own Java runtime.

| Input | Pin |
| --- | --- |
| Bazel | 8.6.0 in .bazelversion |
| Rust, Cargo, rustfmt and clippy | 1.95.0, including the WASM standard library |
| Node.js | 26.8.1 Linux x64 archive and SHA-256 in MODULE.bazel |
| wasm-bindgen library and CLI | 0.2.128; CLI archive SHA-256 in MODULE.bazel |
| Rust dependencies | Cargo.lock checksums; Bazel module resolution in MODULE.bazel.lock |
| Build rules | Exact versions in MODULE.bazel and registry checksums in MODULE.bazel.lock |
| Dictionaries and fixtures | Checked-in data, pinned source provenance and notices |

Rust archive checksums are supplied by the pinned rules_rust release's
`rust/private/known_shas.bzl`. The build never selects host Rust or Node tools.
There are no JavaScript package dependencies or TypeScript compiler inputs today.
Both native and WASM builds use size optimization, one codegen unit and full LTO.

The host kernel, C/C++ linker, libc/development sysroot, shell and browser/system
libraries are outside the agreed boundary. Consequently, installing Bazelisk
alone on a bare Linux image without development libraries is not sufficient yet.
Native byte identity is checked on a fixed host; it is not promised across
different linkers/sysroots. Timing and browser behavior also depend on the host.
Pinning those components is deferred. Other operating systems/architectures and
cross-host byte identity have not been validated.

## Commands and outputs

```sh
bazelisk test //...
bazelisk build //:pages //:standalone //:evaluation
bazelisk run //:serve
```

`test //...` includes native tests with diagnostics, JavaScript/WASM acceptance
and differential parity, Rust formatting/clippy, and artifact privacy checks.
The two existing ranking TODOs are retained as TODOs. Build outputs are separate
from the checkout:

| Target | Output / behavior |
| --- | --- |
| //:pages | bazel-bin/demo.pages/, the only deployable Pages directory |
| //:standalone | bazel-bin/Polytype-Demo.html, usable offline |
| //:wasm | bazel-bin/crates/polytype-wasm/bindings/ |
| //:polytype-json | Native JSON-lines decoder; `bazelisk run //:polytype-json` |
| //:polytype-search | Native diagnostic transport |
| //:evaluation | bazel-bin/evaluation/report.json and REPORT.md |
| //:serve | Local demo at http://127.0.0.1:4173/ |
| //:preview | Pages preview at http://127.0.0.1:4174/polytype/ |
| //:refresh_demo | Explicitly updates checked-in Polytype-Demo.html and notices |
| //:measure_evaluation | Explicit host-dependent latency measurements, JSON on stdout |
| //:evaluate_local | `bazelisk run //:evaluate_local -- /path/to/cases.jsonl` |
| //:diagnose | `bazelisk run //:diagnose -- /path/to/report.json` |
| //:benchmark | Comparison against an explicitly supplied historical WASM engine |

`demo.runtime` is an internal staging tree containing tests, dictionaries and
native tools. Never publish it. Node build actions copy declared inputs and
generate all notices and assets in the sandbox. Reports and maintenance tools
use disposable writable copies; normal builds/tests never modify source files.
The frozen JavaScript reference is unchanged and remains test-only.

The browser test is deliberately manual and outside `//...`:

```sh
bazelisk test //:browser_test --test_env=CHROME_BIN=/path/to/chrome
```

It starts and stops its own localhost server on an available port, checks the
Pages subpath and standalone HTML, and verifies visible missing-WASM handling.
Chrome and its runtime libraries must be installed separately.

## Downloads and reproducibility

The first build needs network access for checksum-verified toolchains, rules and
crates. Normal build/test actions do not fetch dictionary sources or packages.
After bootstrapping, a warm repository cache can be used without fetching:

```sh
bazelisk fetch //...
bazelisk test --nofetch //...
bazelisk run //:reproducibility_check
```

The reproducibility command runs tests and builds twice in independent output
bases with action/remote caches disabled, blocking ambient Rust/Node executables
on PATH. It also reruns the behavior tests with repository fetching disabled and
test-result caching disabled. It compares SHA-256 hashes of the Pages assets,
standalone HTML, evaluation reports and native binaries. It needs Bazelisk on
PATH and may download repositories initially. Temporary output bases are removed
after the check; the host linker/sysroot remains the same for both runs.

Default evaluation reports exclude timings so their bytes are reproducible.
`bazelisk run //:measure_evaluation` prints fresh latency measurements alongside
the same semantic metrics; these timings are not cached as build outputs.

CI uses `--lockfile_mode=error` to reject unresolved module changes. For dependency
updates, edit Cargo manifests and run `CARGO_BAZEL_REPIN=1 bazelisk build //:pages`;
crate_universe resolves them with pinned Cargo and updates Cargo.lock. Review the
lock changes and regenerate MODULE.bazel.lock with `bazelisk build //:pages`. Update the notice repo
labels in MODULE.bazel and build/BUILD.bazel when crate names/versions change;
the packaging action checks that their exact set matches Cargo.lock and rejects
missing or unreviewed license terms. Keep wasm-bindgen CLI/library pins aligned.

Dictionary/corpus refreshes remain explicit network maintenance commands:

```sh
bazelisk run //:import_chinese
bazelisk run //:import_english
bazelisk run //:verify_corpus
```

These commands verify the existing pinned provenance and copy only their known
outputs back into the workspace. The SCOWL importer additionally uses host `tar`.
Review changes, run tests and refresh the checked-in demo afterward. Evaluation
text never populates a dictionary. Personal evaluation files are passed explicitly
to `evaluate_local` and are not added to build inputs or uploaded.

Rule references: [rules_rust Bzlmod](https://bazelbuild.github.io/rules_rust/rust_bzlmod.html),
[crate_universe](https://bazelbuild.github.io/rules_rust/crate_universe_bzlmod.html),
[wasm-bindgen rules](https://bazelbuild.github.io/rules_rust/rust_wasm_bindgen.html),
and [Node toolchains](https://bazel-contrib.github.io/rules_nodejs/Toolchains.html).
