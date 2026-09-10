import {cp, lstat, mkdir, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicFiles, auditDirectory} from './public-artifact.mjs';

const root = new URL('../', import.meta.url);
const destination = new URL('dist/', root);
// Never recursively copy the checkout or silently remove unexpected files.
// Reject stale/foreign files before overwriting only our known generated files.
async function checkExisting(directory, prefix = '') {
  const stat = await lstat(directory).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (!stat) return;
  if (!stat.isDirectory()) throw new Error('Build destination must be a real directory');
  for (const name of await readdir(directory)) {
    const path = prefix + name;
    const entry = new URL(name, directory);
    const info = await lstat(entry);
    if (path === 'pkg' && info.isDirectory()) await checkExisting(new URL('pkg/', directory), 'pkg/');
    else if (!info.isFile() || info.nlink !== 1 || ![...publicFiles, '.nojekyll'].includes(path)) {
      throw new Error('Unexpected item in dist; inspect and move it before rebuilding');
    }
  }
}
await checkExisting(destination);
for (const directory of ['web/', 'web/pkg/']) {
  if (!(await lstat(new URL(directory, root))).isDirectory()) throw new Error('Public source directories must not be symlinks');
}
await mkdir(new URL('pkg/', destination), {recursive: true});
for (const file of publicFiles) {
  const source = new URL('web/' + file, root);
  const info = await lstat(source);
  if (!info.isFile() || info.nlink !== 1) throw new Error('Public source must be a regular unlinked file');
  await cp(source, new URL(file, destination));
}
await writeFile(new URL('.nojekyll', destination), '');
const count = await auditDirectory(fileURLToPath(destination));
console.log(`Built dist/: ${count} allowlisted, privacy-checked files.`);
