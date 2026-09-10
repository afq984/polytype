# Pages build and deployment

The source remote is git@github.com:afq984/polytype.git. Successful main push builds
create and deploy the demo on GitHub-hosted Actions runners.

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

## Artifact hygiene

Builds include only allowlisted assets, exclude local captures and repository
metadata, and check for accidental private paths or credential markers.
`npm run audit:public` checks both demo formats, including the standalone's nested
embedded payloads. Rust path remapping keeps builder paths out of compiled output.
For Pages these checks run on GitHub-hosted runners, not the developer's machine;
the same safeguards also apply to locally built artifacts.

These are hygiene checks, not a comprehensive secret scan of source history or
Actions logs. Keep secrets and personal test exports out of commits and build
inputs. Third-party attribution and license notices are retained.

Typed text and custom dictionaries remain browser-local. Explicit debug reports
contain the visitor's browser details and typed input, not the builder's details;
review before sharing. Local case export is also explicit. GitHub Pages itself
receives normal HTTP requests. Browser-local storage is origin-scoped, so Pages
projects under the same account may share an origin; use a dedicated origin if
isolation from other projects is required.

## Licenses

Polytype's original code is MIT licensed; third-party licenses remain separate.
See LICENSE and THIRD_PARTY.md. Both demo formats bundle the project license and
the dictionary/dependency notices.

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

The live site is https://afq984.github.io/polytype/. If deployment fails
because Pages was not enabled, enable it and rerun the failed job in Actions.

Deployment receives only the audited dist artifact, with Pages/OIDC write
permissions confined to the deploy job. Build jobs have read-only contents access
and checkout does not persist credentials. Build and deployment passed on GitHub:
[first deployment run](https://github.com/afq984/polytype/actions/runs/34477585358).
Browser smoke tests also passed against the live site.

References: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[Rust path remapping](https://doc.rust-lang.org/rustc/command-line-arguments.html#--remap-path-prefix-remap-source-names-in-output).
