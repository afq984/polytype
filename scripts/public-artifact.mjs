import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {lstat, readdir, readFile} from 'node:fs/promises';
import {homedir, hostname, networkInterfaces} from 'node:os';
import {join, resolve} from 'node:path';

export const publicFiles = Object.freeze([
  'index.html', 'style.css', 'bootstrap.mjs', 'app.mjs', 'engine.mjs',
  'keyboard.mjs', 'dictionary-notices.txt', 'pkg/polytype.js', 'pkg/polytype_bg.wasm',
]);

const builderIdentifiers = [homedir(), hostname(), process.cwd()];
for (const entry of Object.values(networkInterfaces()).flat()) {
  if (!entry.internal) builderIdentifiers.push(entry.address, entry.mac);
}
for (const path of ['/etc/machine-id', '/proc/sys/kernel/random/boot_id']) {
  try { builderIdentifiers.push(readFileSync(path, 'utf8').trim()); } catch { /* Not available on every OS. */ }
}

// Do not print matched values: an audit failure must not itself disclose secrets.
// This is a leak tripwire, not a proof that arbitrary content contains no secrets.
export function inspectBytes(bytes, privateValues = builderIdentifiers) {
  const findings = new Set();
  const seen = new Set();
  let decodedBytes = 0;
  function inspect(buffer, depth) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (seen.has(hash)) return;
    seen.add(hash);
    const text = buffer.toString('utf8');
    if (privateValues.some(value => value && value.length >= 4 && text.includes(value))) findings.add('builder identifier');
    if (/(?:\/(?:home|Users|private|tmp|var\/tmp|runner|workspace|workspaces)\/|[A-Za-z]:[\\/](?:Users|work|agent)[\\/])/.test(text)) findings.add('private absolute path');
    if (/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|gho_|ghs_)[A-Za-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}\b/.test(text)) findings.add('credential marker');
    // Standalone modules contain other base64 modules, including the WASM.
    for (const match of text.matchAll(/data:[\w.+/-]+;base64,([A-Za-z0-9+/=]+)/g)) {
      if (depth >= 12) { findings.add('embedded payload nesting limit'); break; }
      const decoded = Buffer.from(match[1], 'base64');
      decodedBytes += decoded.length;
      if (decodedBytes > 64 * 1024 * 1024) { findings.add('embedded payload size limit'); break; }
      inspect(decoded, depth + 1);
    }
  }
  inspect(Buffer.from(bytes), 0);
  return [...findings];
}

export async function auditDirectory(directory) {
  const root = resolve(directory);
  const expected = new Set([...publicFiles, '.nojekyll']);
  const found = new Set();
  if (!(await lstat(root)).isDirectory()) throw new Error('Artifact root must be a real directory');
  async function walk(relative = '') {
    for (const name of await readdir(join(root, relative))) {
      const path = relative ? relative + '/' + name : name;
      const stat = await lstat(join(root, path));
      if (stat.isSymbolicLink()) throw new Error('Artifact contains a symbolic link');
      if (stat.isDirectory() && path === 'pkg') { await walk(path); continue; }
      if (!stat.isFile() || stat.nlink !== 1 || !expected.has(path)) throw new Error('Artifact contains an unexpected file, directory, or hard link');
      found.add(path);
      const findings = inspectBytes(await readFile(join(root, path)));
      if (findings.length) throw new Error(`Privacy audit failed in ${path}: ${findings.join(', ')}`);
    }
  }
  await walk();
  if ([...expected].some(path => !found.has(path))) throw new Error('Artifact is missing required files');
  return found.size;
}
