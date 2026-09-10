import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, link, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicFiles, inspectBytes, auditDirectory} from '../scripts/public-artifact.mjs';

test('privacy scan checks nested modules and binary WASM payloads', () => {
  const privatePath = '/' + ['home', 'example-builder', 'project'].join('/');
  const wasm = Buffer.concat([Buffer.from([0, 97, 115, 109]), Buffer.from(privatePath)]);
  const module = 'data:application/wasm;base64,' + wasm.toString('base64');
  const html = 'data:text/javascript;base64,' + Buffer.from(module).toString('base64');
  assert.deepEqual(inspectBytes(html, []), ['private absolute path']);
  assert.deepEqual(inspectBytes('builder-name', ['builder-name']), ['builder identifier']);
  assert.deepEqual(inspectBytes('ghp_' + 'x'.repeat(30), []), ['credential marker']);
  assert.deepEqual(inspectBytes('/polytype/src/lib.rs /cargo-home/registry /rust-sysroot/library', []), []);
});

test('artifact audit requires the exact file set and rejects links and extras', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'polytype-artifact-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  await mkdir(join(directory, 'pkg'));
  for (const name of [...publicFiles, '.nojekyll']) await writeFile(join(directory, name), 'safe');
  assert.equal(await auditDirectory(directory), 10);
  await writeFile(join(directory, '.env'), 'not public');
  await assert.rejects(auditDirectory(directory), /unexpected/);
  await rm(join(directory, '.env'));
  const target = join(directory, 'index.html');
  await rm(target);
  await assert.rejects(auditDirectory(directory), /missing/);
  await symlink(join(directory, 'style.css'), target);
  await assert.rejects(auditDirectory(directory), /symbolic link/);
  await rm(target);
  await link(join(directory, 'style.css'), target);
  await assert.rejects(auditDirectory(directory), /hard link/);
  await rm(target);
  await writeFile(target, 'data:text/javascript;base64,' + Buffer.from('/' + ['Users', 'example', 'private'].join('/')).toString('base64'));
  await assert.rejects(auditDirectory(directory), /Privacy audit failed/);
});
