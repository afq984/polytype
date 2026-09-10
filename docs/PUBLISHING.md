# Pages build and privacy boundary

The source remote is git@github.com:afq984/polytype.git. Public main starts at a
fresh audited root snapshot. Successful main push builds deploy the audited demo.

## Build and test

Use Node.js 22+ and Rust 1.95.0 (the CI-pinned compiler), with the WASM target and
matching CLI. No npm install is needed; dictionaries and Cargo.lock are checked in.
First-time Cargo/toolchain installation needs network access.

```sh
rustup toolchain install 1.95.0 --profile minimal --target wasm32-unknown-unknown
rustup override set 1.95.0
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm test
npm run build:pages
npm run build:standalone
npm run audit:public
npm run preview:pages
```

Open http://127.0.0.1:4174/polytype/ to test the project-site path. In another
terminal, run `DEMO_URL=http://127.0.0.1:4174/polytype/ npm run test:browser`.
Set CHROME_BIN if Chrome is not on PATH. The browser check also exercises the
standalone HTML and missing-WASM handling. Stop the preview with Ctrl-C.

`dist/` is the only Pages upload directory: HTML, CSS, local ES modules, WASM,
dictionary license notices, and `.nojekyll`. All URLs are relative, so the demo
also works at a repository subpath. Source files, evaluation reports, user test
exports, build caches, VCS metadata, and standalone HTML are not copied into it.
Unexpected files or links in dist cause the build to fail; inspect and move them
out before rebuilding. Do not upload the checkout or target directory.

## Privacy audit

Rust build flags remap the builder's home, Cargo home, compiler sysroot and
checkout paths to neutral paths before compilation. The generated WASM previously
included absolute builder paths in panic-location strings, even with debug info
stripped. Merely checking HTML source would have missed the same paths inside the
standalone's nested base64 modules and WASM.

`audit:public` checks both generated formats, recursively decoding embedded data
URLs. It rejects this builder's home/hostname/working directory, network addresses
and available machine/boot identifiers, common private
absolute paths and credential markers, and rejects unexpected files, symlinks,
hard links and missing files in dist. Failures report categories, not secret
values. Tests exercise the scanner, nested binary payloads, and file boundaries.
The Pages build independently checks dist before reporting success.

This is a defense against known leaks, not a general secret detector. Review
content and dependency/build changes before distribution; arbitrary encodings,
unrecognized secrets and remote service behavior are outside this check. GitHub
Actions logs are not covered by the static-artifact check; never provide private
inputs, credentials or personal test exports to the build. CI needs only checked-in
public source/data and its short-lived platform token. No environment dump,
build-machine manifest, source maps, telemetry or remote assets are added.
Timezone and author/committer metadata are intentionally not scrubbed. Upstream
dictionary/corpus attribution and license notices are preserved.

Typed text and custom dictionaries remain browser-local. Explicit debug reports
contain the visitor's browser details and typed input, not the builder's details;
review before sharing. Local case export is also explicit. GitHub Pages itself
receives normal HTTP requests. Browser-local storage is origin-scoped, so Pages
projects under the same account may share an origin; use a dedicated origin if
isolation from other projects is required.

## Before making a GitHub repository public

**Old local history is not publication-safe.** The private-prepublication bookmark
retains it locally for recovery. It is unrelated to public main, which starts
at a new root snapshot. Never merge the private bookmark into main, push it,
push all bookmarks/tags, or upload the original handoff archive. Publish only the
explicit main bookmark (`jj git push --remote origin --bookmark main`).
Before pushing, audit all new public commits, not just the final working tree.
Flattening does not sanitize the private objects stored locally.

Polytype's original code is MIT licensed; third-party licenses remain separate.
See LICENSE and THIRD_PARTY.md. Both demo formats bundle the project license and
the dictionary/dependency notices.

The local preparation audit scanned 73 current tracked files without findings,
and 11 ancestor snapshots: both affected files appeared in nine snapshots each.
The generated WASM also passed the current-host network/machine-identifier check.
These counts describe that audit, not a guarantee about future revisions.

## Enable automatic deployment

In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**
as the source. Do not select a branch/folder publishing source or add another
starter workflow; this repository already has a custom workflow.

The workflow deploys after all build, test and privacy checks pass on pushes to
main. Pull requests only build/test. Manually run **Demo build and Pages deployment**
on main and check **deploy** to publish; leave it unchecked for a build-only run.
Other branches and events cannot enter the deploy job.

Under **Settings → Environments → github-pages**, allow main as a deployment
branch. Leave required reviewers/wait timers off if deployment should be fully
automatic. Keep Enforce HTTPS enabled in Pages; no custom domain is assumed.
Actions must be enabled with the workflow's actions allowed by repository or
organization policy. The deploy job requests pages:write and id-token:write from
the automatic GITHUB_TOKEN; no personal access token or new secret is required.
The repository-wide default token permission can remain read-only.

The expected site is https://afq984.github.io/polytype/. If the first deploy fails
because Pages was not enabled, enable it and rerun the failed job in Actions.

Deployment receives only the audited dist artifact, with Pages/OIDC write
permissions confined to the deploy job. Build jobs have read-only contents access
and checkout does not persist credentials. The initial source build passed on
GitHub, including tests, browser checks, privacy checks and artifact upload:
[initial Actions run](https://github.com/afq984/polytype/actions/runs/34476864318).
Pages deployment was skipped and its settings/permissions remain untested.

References: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[Rust path remapping](https://doc.rust-lang.org/rustc/command-line-arguments.html#--remap-path-prefix-remap-source-names-in-output).
