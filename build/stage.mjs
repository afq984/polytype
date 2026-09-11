import {readFile, writeFile, mkdir, copyFile, cp, chmod} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {execFileSync} from 'node:child_process';

const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = resolve(manifest.runtime);
async function copy(source, destination) {
  await mkdir(dirname(destination), {recursive:true});
  await copyFile(source, destination);
}
for (const [name, source] of Object.entries(manifest.sources)) await copy(source, join(root, name));
for (const [name, source] of Object.entries(manifest.bindings)) await copy(source, join(root, 'web/pkg', name));
for (const [source, destination] of [[manifest.native, 'target/debug/polytype-json'], [manifest.search, 'target/release/polytype-search']]) {
  await copy(source, join(root, destination));
  await chmod(join(root, destination), 0o755);
}
// Read only the declared crate license inputs, never a host Cargo registry.
const packages = [];
for (const path of manifest.licenses.filter(path => path.endsWith('/Cargo.toml'))) {
  const text = await readFile(path, 'utf8');
  const field = name => text.match(new RegExp('^' + name + '\\s*=\\s*"([^"]+)"', 'm'))?.[1];
  const license = field('license');
  if (!['MIT','MIT OR Apache-2.0','Unlicense OR MIT','(MIT OR Apache-2.0) AND Unicode-3.0'].includes(license)) {
    throw new Error(`Review changed dependency license: ${field('name')}`);
  }
  const names = ['LICENSE-MIT', ...(license.includes('Unicode-3.0') ? ['LICENSE-UNICODE'] : [])];
  const texts = [];
  for (const name of names) {
    const file = join(dirname(path), name);
    if (!manifest.licenses.includes(file)) throw new Error(`Missing declared license: ${field('name')}/${name}`);
    texts.push(await readFile(file, 'utf8'));
  }
  packages.push({name:field('name'), version:field('version'), names, texts});
}
const locked = (await readFile(join(root, 'Cargo.lock'), 'utf8')).split('[[package]]').slice(1)
  .filter(entry => entry.includes('source =')).map(entry => `${entry.match(/name = "([^"]+)"/)[1]} ${entry.match(/version = "([^"]+)"/)[1]}`).sort();
if (JSON.stringify(locked) !== JSON.stringify(packages.map(p => `${p.name} ${p.version}`).sort())) {
  throw new Error('License inputs do not match Cargo.lock; update MODULE.bazel and build/BUILD.bazel notice labels.');
}
await writeFile(join(root, 'dependency-notices.json'), JSON.stringify(packages));
const run = script => execFileSync(process.execPath, [join(root, 'scripts', script)], {cwd:root, stdio:'inherit'});
run('build-notices.mjs');
run('build-standalone.mjs');
run('build-pages.mjs');
run('audit-public.mjs');
await cp(join(root, 'dist'), resolve(manifest.pages), {recursive:true});
await copy(join(root, 'Polytype-Demo.html'), resolve(manifest.standalone));
