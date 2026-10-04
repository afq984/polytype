import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, symlink, link, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {main, externalPath, validateCorpus, parseJSONL} from '../scripts/corpus.mjs';

const source = {id:'authored', kind:'self-authored', title:'Original test text', locator:'', revision:'', license:'MIT', attribution:'Polytype test authors', localEvaluation:'allowed', redistribution:'allowed', evidence:'Original synthetic test fixture, authored for this project.'};
const rowsFor = (unit, split, raw, text = raw) => ['colemak', 'qwerty'].map(layout => ({
  id:unit + '-' + layout, unitId:unit, sourceId:'authored', sourceGroup:unit,
  split, domain:'everyday', languages:['en'], features:['numbers'], raw, text, acceptable:[],
  options:{layout, english:true, japanese:false, zhuyin:false}, captureKind:'transcribed', customDictionary:'none',
  seenDuringDevelopment:split !== 'heldout', review:{status:'confirmed', reviewer:'fixture-author', reviewedAt:'2026-09-13'},
}));
async function temporary(t) {
  const path = await mkdtemp(join(process.env.TEST_TMPDIR || tmpdir(), 'polytype-corpus-test-'));
  t.after(() => rm(path, {recursive:true, force:true}));
  return path;
}
const writeRows = (root, rows) => writeFile(join(root, 'cases.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n');

test('external corpus paths reject repositories, symlink aliases and internal file links', async t => {
  const parent = await temporary(t), repo = join(parent, 'repo');
  await mkdir(repo); await mkdir(join(repo, '.jj'));
  await symlink(repo, join(parent, 'alias'));
  await assert.rejects(externalPath(join(repo, 'new-corpus')), /outside every/);
  await assert.rejects(externalPath(join(parent, 'alias/new-corpus')), /outside every/);
  await assert.rejects(externalPath(fileURLToPath(new URL('../eval', import.meta.url))), /outside/);
  const gitRepo = join(parent, 'git-repo'); await mkdir(gitRepo); await mkdir(join(gitRepo, '.git'));
  await writeFile(join(gitRepo, '.git/HEAD'), 'ref: refs/heads/main\n');
  await assert.rejects(externalPath(join(gitRepo, 'new-corpus')), /outside every/);
  const worktree = join(parent, 'worktree'); await mkdir(worktree); await writeFile(join(worktree, '.git'), 'gitdir: ../git-repo/.git\n');
  await assert.rejects(externalPath(join(worktree, 'new-corpus')), /outside every/);
  const root = join(parent, 'corpus'); await main(['init', root]);
  const external = join(parent, 'external.json'); await writeFile(external, '[]');
  await rm(join(root, 'sources.json')); await symlink(external, join(root, 'sources.json'));
  await assert.rejects(main(['check', root]), /ordinary files/);
  await rm(join(root, 'sources.json')); await link(external, join(root, 'sources.json'));
  await assert.rejects(main(['check', root]), /ordinary files/);
});

test('capture import preserves exact spaces/options without certifying or exposing text', async t => {
  const parent = await temporary(t), root = join(parent, 'corpus');
  await main(['init', root]);
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  await writeFile(join(root, 'sources.json'), JSON.stringify([source]));
  const capture = {raw:'private-fixture  ', text:'private-fixture  ', options:{layout:'colemak', english:true, japanese:true, zhuyin:true}, dictionary:{custom:0}};
  const path = join(parent, 'export.jsonl'); await writeFile(path, JSON.stringify(capture));
  const result = await main(['import', root, path, 'authored']);
  assert.equal(result.imported, 1);
  assert.ok(!JSON.stringify(result).includes('private-fixture'));
  assert.equal((await main(['import', root, path, 'authored'])).imported, 0);
  const [row] = parseJSONL(await readFile(join(root, 'cases.jsonl'), 'utf8'));
  assert.equal(row.raw, capture.raw); assert.equal(row.text, capture.text);
  assert.deepEqual(row.options, capture.options);
  assert.equal(row.review.status, 'pending'); assert.equal(row.seenDuringDevelopment, true);
  assert.equal(row.split, 'unassigned'); assert.equal(row.customDictionary, 'none');
  await assert.rejects(main(['freeze', root, 'unreviewed']), /Not ready/);
  row.split = 'heldout'; assert.throws(() => validateCorpus([source], [row]), /cannot be held out/);
  assert.equal((await stat(join(root, 'cases.jsonl'))).mode & 0o777, 0o600);
});

test('blind capture imports are typed and eligible for reviewed held-out use', async t => {
  const parent = await temporary(t), root = join(parent, 'corpus');
  await main(['init', root]); await writeFile(join(root, 'sources.json'), JSON.stringify([source]));
  const capture = {blind:true, raw:'blind-fixture  ', text:'Blind fixture  ', options:{layout:'colemak', english:true, japanese:false, zhuyin:true}, dictionary:{custom:0}};
  const path = join(parent, 'export.jsonl'); await writeFile(path, JSON.stringify(capture));
  assert.equal((await main(['import', root, path, 'authored'])).imported, 1);
  const [row] = parseJSONL(await readFile(join(root, 'cases.jsonl'), 'utf8'));
  assert.equal(row.blind, true); assert.equal(row.captureKind, 'typed'); assert.equal(row.seenDuringDevelopment, false);
  assert.equal(row.raw, capture.raw); assert.equal(row.text, capture.text); assert.deepEqual(row.options, capture.options);
  assert.equal(row.split, 'unassigned'); assert.equal(row.review.status, 'pending');
  row.split = 'heldout'; row.sourceGroup = 'blind-session'; row.languages = ['en'];
  row.review = {status:'confirmed', reviewer:'fixture-author', reviewedAt:'2026-09-13'};
  await writeRows(root, [row]);
  assert.equal((await main(['check', root])).readyToFreeze, true);
  assert.equal((await main(['freeze', root, 'blind'])).rows, 1);
  // Later exposure cannot be hidden by deduplication or undo a prior review.
  await writeFile(path, JSON.stringify({...capture, blind:false}));
  await assert.rejects(main(['import', root, path, 'authored']), /cannot be held out/);
  row.split = 'development'; await writeRows(root, [row]);
  assert.equal((await main(['import', root, path, 'authored'])).duplicates, 1);
  const [exposed] = parseJSONL(await readFile(join(root, 'cases.jsonl'), 'utf8'));
  assert.equal(exposed.seenDuringDevelopment, true); assert.equal(exposed.review.status, 'confirmed');
  await writeFile(path, JSON.stringify(capture)); await main(['import', root, path, 'authored']);
  assert.equal(parseJSONL(await readFile(join(root, 'cases.jsonl'), 'utf8'))[0].seenDuringDevelopment, true);
  await writeFile(path, JSON.stringify({...capture, blind:'true'}));
  await assert.rejects(main(['import', root, path, 'authored']), /invalid input/);
});

test('snapshot readiness distinguishes pending review, rights, custom entries and informational layout coverage', () => {
  const rows = rowsFor('one', 'development', '42');
  assert.equal(validateCorpus([source], rows).readyToFreeze, true);
  for (const mutate of [
    row => {row.review.status = 'pending';}, row => {row.customDictionary = 'required';},
    row => {row.raw = null;}, row => {row.captureKind = 'unknown';},
  ]) {
    const changed = structuredClone(rows); mutate(changed[0]);
    assert.equal(validateCorpus([source], changed).readyToFreeze, false);
  }
  assert.equal(validateCorpus([{...source, localEvaluation:'pending'}], rows).readyToFreeze, false);
  const single = validateCorpus([source], rows.slice(0, 1));
  assert.equal(single.readyToFreeze, true); assert.equal(single.pairedLayoutUnits, 0);
  assert.equal(validateCorpus([source], rows).pairedLayoutUnits, 1);
  assert.throws(() => validateCorpus([source], [...rows, {...rows[0], id:'duplicate'}]), /Duplicate layout/);
  const challenge = {...rows[0], id:'challenge', unitId:'challenge', sourceGroup:'challenge', split:'challenge', raw:null, options:null, review:{status:'pending'}};
  assert.equal(validateCorpus([source], [...rows, challenge]).readyToFreeze, true);
  assert.throws(() => validateCorpus([source], [{...rows[0], raw:'a'.repeat(401)}]), /400/);
  assert.throws(() => validateCorpus([source], [{...rows[0], raw:'\ud800'}]), /UTF-16/);
});

test('one reviewed layout can freeze independently', async t => {
  const parent = await temporary(t), root = join(parent, 'corpus');
  await main(['init', root]);
  await writeFile(join(root, 'sources.json'), JSON.stringify([source]));
  await writeRows(root, rowsFor('single', 'heldout', '57').slice(0, 1));
  const summary = await main(['check', root]);
  assert.equal(summary.pairedLayoutUnits, 0); assert.equal(summary.readyToFreeze, true);
  assert.equal((await main(['freeze', root, 'single-layout'])).rows, 1);
});

test('holdout checks catch grouped, normalized and acceptable-target leakage, including challenge queues', () => {
  const dev = rowsFor('dev', 'development', 'alpha', 'Full Name');
  const held = rowsFor('held', 'heldout', 'beta', 'different');
  assert.equal(validateCorpus([source], [...dev, ...held]).readyToFreeze, true);
  assert.throws(() => validateCorpus([source], [...dev, ...held.map(row => ({...row, sourceGroup:'dev'}))]), /overlaps|crosses/);
  assert.throws(() => validateCorpus([source], [...dev, ...held.map(row => ({...row, text:'full  name'}))]), /overlaps|crosses/);
  assert.throws(() => validateCorpus([source], [...dev, ...held.map(row => ({...row, acceptable:['Full Name']}))]), /overlaps|crosses/);
  assert.throws(() => validateCorpus([source], [...dev.map(row => ({...row, split:'challenge'})), ...held.map(row => ({...row, text:'Full Name'}))]), /overlaps|crosses/);
  assert.throws(() => validateCorpus([{...source, kind:'existing-regression'}], held), /cannot be held out/);
  assert.throws(() => validateCorpus([source], [...dev, {...dev[0], id:'other', split:'regression'}]), /variants/);
});

test('frozen external reports preserve baseline identity, split boundaries and private output', async t => {
  const parent = await temporary(t), root = join(parent, 'corpus');
  await main(['init', root]);
  await writeFile(join(root, 'sources.json'), JSON.stringify([source]));
  const rows = [...rowsFor('dev', 'development', '42', 'forty-two').map(row => ({...row, acceptable:['42']})), ...rowsFor('held', 'heldout', '57')];
  await writeRows(root, rows);
  const frozen = await main(['freeze', root, 'pilot']);
  assert.equal(frozen.units, 2); assert.equal(frozen.rows, 4);
  await assert.rejects(main(['freeze', root, 'pilot']));
  await assert.rejects(main(['evaluate', root, 'pilot', 'heldout', 'closed']), /open-heldout/);
  const result = await main(['evaluate', root, 'pilot', 'development', 'baseline']);
  assert.ok(!JSON.stringify(result).includes('forty-two'));
  const report = JSON.parse(await readFile(join(root, 'runs/baseline/report.json'), 'utf8'));
  assert.equal(report.benchmark.split, 'development');
  assert.match(report.benchmark.wasmSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.profiles.expanded.rows.length, 2);
  assert.equal(report.profiles.expanded.benchmarkGroups['layout:colemak'].top1, 0);
  assert.equal(report.profiles.expanded.benchmarkGroups['layout:colemak'].acceptableTop1, 1);
  await assert.rejects(main(['evaluate', root, 'pilot', 'development', 'baseline']));
  await main(['evaluate', root, 'pilot', 'heldout', 'opened', '--open-heldout']);
  assert.equal(JSON.parse(await readFile(join(root, 'runs/opened/started.json'), 'utf8')).heldoutOpened, true);
  await writeFile(join(root, 'snapshots/pilot/development.jsonl'), 'tampered\n');
  await assert.rejects(main(['evaluate', root, 'pilot', 'development', 'tampered']), /Snapshot contents changed/);
});

test('CLI errors omit malformed source contents', async t => {
  const parent = await temporary(t), root = join(parent, 'corpus');
  await main(['init', root]);
  await writeFile(join(root, 'cases.jsonl'), '{"private-sentinel" invalid JSON');
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/corpus.mjs', import.meta.url)), 'check', root], {encoding:'utf8'});
  assert.equal(child.status, 1);
  assert.ok(!`${child.stdout}${child.stderr}`.includes('private-sentinel'));
  assert.match(child.stderr, /Invalid JSON in cases row 1/);
});

test('CLI runs through the symlinks used by Bazel runfiles', async t => {
  const parent = await temporary(t), entry = join(parent, 'entry.mjs'), root = join(parent, 'corpus');
  await symlink(fileURLToPath(new URL('../scripts/corpus.mjs', import.meta.url)), entry);
  const child = spawnSync(process.execPath, [entry, 'init', root], {encoding:'utf8'});
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).initialized, true);
  assert.equal(await readFile(join(root, 'cases.jsonl'), 'utf8'), '');
});
