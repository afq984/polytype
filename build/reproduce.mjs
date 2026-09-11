// Two independent action caches, sharing only Bazel's downloaded repositories.
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const workspace = process.env.BUILD_WORKSPACE_DIRECTORY;
if (!workspace) throw new Error('Use bazelisk run //:reproducibility_check');
const scratch = await mkdtemp(join(tmpdir(), 'polytype-reproduce-'));
async function unlockDirectories(path) {
  // Bazel makes output directories read-only. Do not follow runfile symlinks
  // into the workspace, downloaded repositories or shared installation.
  await chmod(path, 0o700);
  for (const entry of await readdir(path, {withFileTypes:true})) {
    if (entry.isDirectory()) await unlockDirectories(join(path, entry.name));
  }
}
try {
  const manifests = [];
  for (const iteration of ['first', 'second']) {
    const base = join(scratch, iteration);
    // Keep wrappers inside this output base so Bazel's hermetic /tmp exposes them.
    const poison = join(base, 'host-language-tools');
    await mkdir(poison, {recursive:true});
    for (const name of ['cargo', 'rustc', 'rustup', 'rustfmt', 'clippy-driver', 'node', 'npm', 'npx', 'wasm-bindgen']) {
      await writeFile(join(poison, name), `#!/bin/sh\necho 'Unexpected host language tool: ${name}' >&2\nexit 97\n`, {mode:0o755});
    }
    const env = {...process.env, PATH:poison + ':' + process.env.PATH};
    const startup = ['--batch', '--nosystem_rc', '--nohome_rc', '--output_base=' + base];
    const options = ['--lockfile_mode=error', '--disk_cache=', '--remote_cache=', '--remote_executor=', '--symlink_prefix=/', '--action_env=PATH=' + env.PATH, '--test_env=PATH=' + env.PATH];
    const bazel = argv => execFileSync('bazelisk', [...startup, ...argv], {cwd:workspace, env, stdio:'inherit'});
    bazel(['test', ...options, '//...']);
    // Rerun tests without fetching or cached test results after bootstrapping.
    bazel(['test', ...options, '--nofetch', '--cache_test_results=no', '//:js_test', '//crates/polytype-core:all']);
    const outputs = join(base, 'execroot/_main/bazel-out/k8-opt/bin');
    const hashes = {};
    async function collect(relative) {
      const path = join(outputs, relative);
      const entries = await readdir(path, {withFileTypes:true}).catch(error => {
        if (error.code !== 'ENOTDIR') throw error;
        return null;
      });
      if (entries) {
        for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name, 'en'))) await collect(relative + '/' + entry.name);
      } else {
        hashes[relative] = createHash('sha256').update(await readFile(path)).digest('hex');
      }
    }
    for (const name of ['demo.pages', 'Polytype-Demo.html', 'evaluation', 'crates/polytype-core/polytype-json', 'crates/polytype-core/polytype-search']) await collect(name);
    manifests.push(hashes);
  }
  assert.deepEqual(manifests[1], manifests[0], 'Independent builds produced different bytes');
  console.log(JSON.stringify({artifacts:manifests[0], identical:true}, null, 2));
  console.log('Two fresh builds and uncached tests passed with host Rust/Node commands blocked. Native equality is measured on this host only.');
} finally {
  await unlockDirectories(scratch);
  await rm(scratch, {recursive:true, force:true});
}
