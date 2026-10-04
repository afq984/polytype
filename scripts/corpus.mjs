// Preparation for external, explicitly reviewed typing benchmarks. No network I/O.
import {readFile, writeFile, mkdir, realpath, stat, lstat, access, rename, rm} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname, join, relative, isAbsolute, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const runtime = fileURLToPath(new URL('..', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
const splits = ['unassigned', 'development', 'heldout', 'regression', 'challenge'];
const active = row => ['development', 'heldout', 'regression'].includes(row.split);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.trim().length > 0;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
const has = async path => {try {await access(path); return true;} catch (e) {if (['ENOENT', 'ENOTDIR'].includes(e.code)) return false; throw e;}};
class CorpusError extends Error {}
function requireThat(condition, message) {if (!condition) throw new CorpusError(message);}

// Resolve existing ancestors too: a new path through a symlink must not bypass
// the repository boundary. Ignore rules alone do not exclude Bazel glob inputs.
export async function externalPath(path) {
  const original = resolve(path);
  let ancestor = original;
  while (!await has(ancestor)) {
    requireThat(dirname(ancestor) !== ancestor, 'No existing path ancestor.');
    ancestor = dirname(ancestor);
  }
  const canonical = resolve(await realpath(ancestor), relative(ancestor, original));
  for (const excluded of [runtime, process.env.BUILD_WORKSPACE_DIRECTORY].filter(Boolean)) {
    const base = await realpath(excluded);
    const rel = relative(base, canonical);
    requireThat(rel !== '' && (rel === '..' || rel.startsWith('../') || isAbsolute(rel)), 'Corpus paths must be outside the source workspace and build runtime.');
  }
  for (let parent = canonical;; parent = dirname(parent)) {
    // A Git directory has HEAD; a linked worktree uses a .git file.
    // Empty .git directories (including sandbox guard mounts) are not repositories.
    const git = join(parent, '.git');
    const gitRepository = await has(git) && ((await stat(git)).isFile() || await has(join(git, 'HEAD')));
    requireThat(!await has(join(parent, '.jj')) && !gitRepository, 'Corpus paths must be outside every jj/Git repository.');
    if (dirname(parent) === parent) break;
  }
  return canonical;
}

export function parseJSONL(text, label = 'cases') {
  const rows = [];
  for (const [index, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    try {rows.push(JSON.parse(line));} catch {throw new CorpusError(`Invalid JSON in ${label} row ${index + 1}.`);}
  }
  return rows;
}
async function readJSON(path) {
  try {return JSON.parse(await readFile(path, 'utf8'));}
  catch (error) {if (error instanceof SyntaxError) throw new CorpusError(`Invalid JSON in ${basename(path)}.`); throw error;}
}
async function plainFile(root, name) {
  const path = join(root, name), info = await lstat(path);
  requireThat(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'Corpus files must be ordinary files, not symbolic or hard links.');
  return path;
}
function validOptions(value) {
  return object(value) && ['qwerty', 'colemak'].includes(value.layout)
    && ['english', 'japanese', 'zhuyin'].every(key => typeof value[key] === 'boolean')
    && Object.keys(value).every(key => ['layout', 'english', 'japanese', 'zhuyin'].includes(key));
}

export function validateCorpus(sources, rows) {
  requireThat(Array.isArray(sources) && Array.isArray(rows), 'Sources and cases must be arrays.');
  const sourceMap = new Map();
  for (const [index, source] of sources.entries()) {
    const label = `Source ${index + 1}`;
    requireThat(object(source) && identifier(source.id) && !sourceMap.has(source.id), `${label}: invalid or duplicate source ID.`);
    requireThat(['self-authored', 'user-provided', 'third-party', 'synthetic', 'existing-regression'].includes(source.kind), `${label}: invalid source kind.`);
    requireThat(['title', 'locator', 'revision', 'license', 'attribution', 'evidence'].every(key => typeof source[key] === 'string'), `${label}: missing provenance fields.`);
    requireThat(['pending', 'allowed'].includes(source.localEvaluation) && ['unreviewed', 'allowed', 'restricted'].includes(source.redistribution), `${label}: invalid rights status.`);
    requireThat(source.localEvaluation !== 'allowed' || string(source.evidence), `${label}: allowed local evaluation requires recorded evidence.`);
    sourceMap.set(source.id, source);
  }
  const ids = new Set(), units = new Map(), groups = new Map(), duplicateKeys = new Map(), heldoutKeys = new Map();
  const blockers = [];
  for (const [index, row] of rows.entries()) {
    const label = `Case row ${index + 1}`;
    requireThat(object(row) && ['id', 'unitId', 'sourceId', 'sourceGroup'].every(key => identifier(row[key])), `${label}: invalid IDs.`);
    requireThat(!ids.has(row.id), `${label}: duplicate case ID.`); ids.add(row.id);
    requireThat(sourceMap.has(row.sourceId), `${label}: unknown source ID.`);
    requireThat(splits.includes(row.split) && typeof row.seenDuringDevelopment === 'boolean', `${label}: invalid split or exposure status.`);
    requireThat(row.inputVariant === undefined || identifier(row.inputVariant), `${label}: invalid input variant ID.`);
    requireThat(string(row.domain) && Array.isArray(row.languages) && row.languages.length > 0 && new Set(row.languages).size === row.languages.length && row.languages.every(lang => ['zh', 'ja', 'en'].includes(lang)), `${label}: specify domain and unique intended languages.`);
    requireThat(Array.isArray(row.features) && row.features.every(string), `${label}: features must be strings.`);
    requireThat(typeof row.text === 'string' && row.text.length > 0 && row.text.length <= 2000 && row.text.isWellFormed(), `${label}: expected text must contain 1–2000 valid UTF-16 units.`);
    requireThat(Array.isArray(row.acceptable) && row.acceptable.every(text => string(text) && text.length <= 2000 && text.isWellFormed()) && new Set([row.text, ...row.acceptable]).size === row.acceptable.length + 1, `${label}: invalid or duplicate acceptable outputs.`);
    requireThat(row.raw === null || (typeof row.raw === 'string' && row.raw.length > 0 && row.raw.length <= 400 && row.raw.isWellFormed()), `${label}: raw must be null or contain 1–400 valid UTF-16 units.`);
    requireThat(row.options === null || validOptions(row.options), `${label}: specify all layout/language options.`);
    requireThat(['typed', 'transcribed', 'derived', 'unknown'].includes(row.captureKind) && ['none', 'required', 'unknown'].includes(row.customDictionary), `${label}: invalid capture or custom dictionary status.`);
    requireThat(object(row.review) && ['pending', 'confirmed'].includes(row.review.status), `${label}: invalid review status.`);
    if (row.review.status === 'confirmed') {
      const date = row.review.reviewedAt;
      requireThat(string(row.review.reviewer) && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, `${label}: confirmation requires reviewer and valid review date.`);
    }
    const source = sourceMap.get(row.sourceId);
    requireThat(row.split !== 'heldout' || (!row.seenDuringDevelopment && !['synthetic', 'existing-regression'].includes(source.kind)), `${label}: exposed, synthetic or historical cases cannot be held out.`);
    const unitKey = JSON.stringify([row.sourceId, row.sourceGroup, row.split, row.domain, [...row.languages].sort(), row.text, row.acceptable]);
    if (units.has(row.unitId)) requireThat(units.get(row.unitId).key === unitKey, `${label}: variants of one unit disagree on provenance, split or target.`);
    else units.set(row.unitId, {key:unitKey, rows:[]});
    units.get(row.unitId).rows.push(row);
    // Related excerpts, alternative spellings and layout variants travel together.
    const group = row.sourceId + '/' + row.sourceGroup;
    const exposureKeys = ['group:' + group, ...[row.text, ...row.acceptable].map(text => 'target:' + text.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase())];
    if (row.raw !== null && row.options !== null) exposureKeys.push('raw:' + JSON.stringify([row.raw, row.options.layout, row.options.english, row.options.japanese, row.options.zhuyin]));
    for (const key of exposureKeys) {
      const previous = heldoutKeys.get(key) ?? new Set();
      requireThat(![...previous].some(split => split !== row.split && (split === 'heldout' || row.split === 'heldout')), `${label}: held-out source/input/target overlaps another queue or split.`);
      previous.add(row.split); heldoutKeys.set(key, previous);
    }
    if (active(row)) {
      requireThat(!groups.has(group) || groups.get(group) === row.split, `${label}: one source group crosses benchmark splits.`);
      groups.set(group, row.split);
      const keys = [row.text, ...row.acceptable].map(text => 'target:' + text.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase());
      if (row.raw !== null && row.options !== null) keys.push('raw:' + JSON.stringify([row.raw, row.options.layout, row.options.english, row.options.japanese, row.options.zhuyin]));
      for (const key of keys) {
        requireThat(!duplicateKeys.has(key) || duplicateKeys.get(key) === row.split, `${label}: duplicate input or target crosses benchmark splits.`);
        duplicateKeys.set(key, row.split);
      }
      const reasons = [];
      if (row.review.status !== 'confirmed') reasons.push('target/input review pending');
      if (source.localEvaluation !== 'allowed') reasons.push('local-use provenance review pending');
      if (row.raw === null || row.options === null || row.captureKind === 'unknown') reasons.push('input annotation incomplete');
      if (row.customDictionary !== 'none') reasons.push('custom dictionary dependency unresolved');
      if (row.options && !row.options.english && !row.options.japanese && !row.options.zhuyin) reasons.push('all languages disabled');
      if (reasons.length) blockers.push({row:index + 1, reasons});
    }
  }
  let pairedLayoutUnits = 0;
  for (const unit of units.values()) {
    if (!active(unit.rows[0])) continue;
    const configurations = new Map();
    for (const row of unit.rows) {
      if (!row.options) continue;
      const key = JSON.stringify([row.inputVariant ?? 'primary', row.options.english, row.options.japanese, row.options.zhuyin]);
      if (!configurations.has(key)) configurations.set(key, new Set());
      requireThat(!configurations.get(key).has(row.options.layout), 'Duplicate layout/options variant within one unit.');
      configurations.get(key).add(row.options.layout);
    }
    if (configurations.size && [...configurations.values()].every(layouts => layouts.size === 2)) pairedLayoutUnits++;
  }
  const countUnits = predicate => new Set(rows.filter(predicate).map(row => row.unitId)).size;
  return {rows:rows.length, units:units.size, splits:Object.fromEntries(splits.map(split => [split, {rows:rows.filter(row => row.split === split).length, units:countUnits(row => row.split === split)}])),
    confirmedRows:rows.filter(row => row.review.status === 'confirmed').length,
    activeUnits:countUnits(active), pairedLayoutUnits, blockers, readyToFreeze:rows.some(active) && blockers.length === 0};
}

const template = {
  id:'case-0001-colemak', unitId:'case-0001', inputVariant:'primary', sourceId:'personal-typing', sourceGroup:'session-0001',
  split:'unassigned', domain:'everyday', languages:['zh', 'ja', 'en'], features:[],
  raw:null, text:'REPLACE WITH THE INTENDED OUTPUT', acceptable:[], options:null,
  captureKind:'unknown', customDictionary:'unknown', seenDuringDevelopment:true,
  review:{status:'pending', reviewer:null, reviewedAt:null}, notes:'Preserve exact spaces. Confirm input and output together.',
};
async function loadCorpus(root) {
  const sources = await readJSON(await plainFile(root, 'sources.json'));
  const rows = parseJSONL(await readFile(await plainFile(root, 'cases.jsonl'), 'utf8'));
  return {sources, rows, summary:validateCorpus(sources, rows)};
}
const usage = 'Use bazelisk run //:corpus -- init DIR | import DIR EXPORT.jsonl SOURCE_ID | check DIR | freeze DIR NAME | evaluate DIR NAME development|regression|heldout RUN_NAME [--open-heldout]';

export async function main(args) {
  const [command, directory, ...rest] = args;
  requireThat(directory && ['init', 'import', 'check', 'freeze', 'evaluate'].includes(command), usage);
  const root = await externalPath(directory);
  if (command === 'init') {
    requireThat(rest.length === 0, usage);
    await mkdir(root, {mode:0o700}); // Exclusive: never overwrite an existing corpus.
    await writeFile(join(root, '.gitignore'), '*\n', {mode:0o600, flag:'wx'});
    await writeFile(join(root, 'sources.json'), json([{id:'personal-typing', kind:'self-authored', title:'Personal typing samples', locator:'', revision:'', license:'Undeclared; private by default', attribution:'', localEvaluation:'pending', redistribution:'unreviewed', evidence:''}]), {mode:0o600, flag:'wx'});
    await writeFile(join(root, 'cases.jsonl'), '', {mode:0o600, flag:'wx'});
    await writeFile(join(root, 'case-template.json'), json(template), {mode:0o600, flag:'wx'});
    await writeFile(join(root, 'README.md'), await readFile(new URL('../eval/COLLECTION.md', import.meta.url)), {mode:0o600, flag:'wx'});
    return {initialized:true, cases:0, note:'Private preparation only; no corpus has been collected or reviewed.'};
  }
  requireThat((await stat(root)).isDirectory(), 'Expected a corpus directory.');
  if (command === 'evaluate') {
    const [name, split, runName, flag] = rest;
    requireThat(identifier(name) && identifier(runName) && ['development', 'regression', 'heldout'].includes(split) && (flag === undefined || flag === '--open-heldout') && rest.length <= 4, usage);
    requireThat(split !== 'heldout' || flag === '--open-heldout', 'Held-out evaluation requires --open-heldout; results expose this split to development.');
    const snapshot = await externalPath(join(root, 'snapshots', name));
    const manifest = await readJSON(await plainFile(snapshot, 'manifest.json'));
    requireThat(manifest.format === 'polytype-corpus-snapshot-v1', 'Unsupported snapshot format.');
    for (const file of ['sources.json', 'cases.jsonl', 'development.jsonl', 'heldout.jsonl', 'regression.jsonl']) {
      requireThat(hash(await readFile(await plainFile(snapshot, file))) === manifest.sha256[file], 'Snapshot contents changed; create a new named snapshot.');
    }
    const rows = parseJSONL(await readFile(join(snapshot, 'cases.jsonl'), 'utf8')).filter(row => row.split === split);
    requireThat(rows.length > 0, 'Selected split is empty.');
    const output = await externalPath(join(root, 'runs', runName));
    await mkdir(dirname(output), {recursive:true, mode:0o700});
    await mkdir(output, {mode:0o700});
    await writeFile(join(output, 'started.json'), json({snapshot:name, split, startedAt:new Date().toISOString(), heldoutOpened:split === 'heldout'}), {mode:0o600, flag:'wx'});
    let report;
    try {
      // The legacy evaluator emits raw/expected/candidate text. Capture it here;
      // never inherit stdout/stderr into Bazel logs or CI output.
      report = JSON.parse(execFileSync(process.execPath, [join(runtime, 'scripts/evaluate.mjs'), join(snapshot, split + '.jsonl')], {cwd:runtime, encoding:'utf8', stdio:['ignore', 'pipe', 'pipe'], maxBuffer:128 * 1024 * 1024}));
    } catch {throw new CorpusError('Evaluation failed; no source text was printed. Check the snapshot and current engine locally.');}
    report.benchmark = {format:'polytype-corpus-run-v1', snapshot:name, split, manifestSha256:hash(await readFile(join(snapshot, 'manifest.json'))),
      wasmSha256:hash(await readFile(join(runtime, 'web/pkg/polytype_bg.wasm'))),
      adapterSha256:hash(await readFile(join(runtime, 'web/engine.mjs'))),
      evaluatorSha256:hash(await readFile(join(runtime, 'scripts/evaluate.mjs'))),
      preparationSha256:hash(await readFile(fileURLToPath(import.meta.url))),
      note:'Prototype is historical. Save the expanded results as the current baseline. CER measures text edits, not user correction actions.'};
    // Keep per-layout/stratum counts separate: variants are not independent text.
    for (const result of Object.values(report.profiles)) {
      result.benchmarkGroups = {};
      for (const [index, row] of rows.entries()) {
        const measured = result.rows[index];
        const accepted = new Set([row.text, ...row.acceptable]);
        const acceptedRank = measured.candidates.findIndex(text => accepted.has(text)) + 1;
        measured.acceptableRank = acceptedRank;
        for (const group of ['layout:' + row.options.layout, 'languages:' + [...row.languages].sort().join('+') + '/' + row.options.layout, 'domain:' + row.domain + '/' + row.options.layout]) {
          const metric = result.benchmarkGroups[group] ??= {rows:0, units:[], top1:0, top5:0, acceptableTop1:0, acceptableTop5:0, edits:0, characters:0};
          metric.rows++; if (!metric.units.includes(row.unitId)) metric.units.push(row.unitId);
          metric.top1 += Number(measured.rank === 1); metric.top5 += Number(measured.rank > 0);
          metric.acceptableTop1 += Number(acceptedRank === 1); metric.acceptableTop5 += Number(acceptedRank > 0);
          metric.edits += measured.edits; metric.characters += measured.characters;
        }
      }
      for (const metric of Object.values(result.benchmarkGroups)) {metric.units = metric.units.length; metric.characterErrorRate = metric.edits / Math.max(1, metric.characters);}
    }
    await writeFile(join(output, 'report.json'), json(report), {mode:0o600, flag:'wx'});
    return {evaluated:true, split, rows:rows.length, units:new Set(rows.map(row => row.unitId)).size, note:'Detailed results written only to the external run directory.'};
  }
  const {sources, rows, summary} = await loadCorpus(root);
  if (command === 'check') {requireThat(rest.length === 0, usage); return summary;}
  if (command === 'import') {
    const [path, sourceId] = rest;
    requireThat(rest.length === 2 && sources.some(source => source.id === sourceId), 'Import requires an existing source ID.');
    const captures = parseJSONL(await readFile(await externalPath(path), 'utf8'), 'capture');
    const captureKey = row => JSON.stringify([row.raw, row.text, row.options.layout, row.options.english, row.options.japanese, row.options.zhuyin]);
    const seen = new Map(rows.filter(row => row.options).map(row => [captureKey(row), row]));
    const added = [];
    for (const [index, capture] of captures.entries()) {
      requireThat(object(capture) && typeof capture.raw === 'string' && capture.raw.length > 0 && capture.raw.length <= 400 && string(capture.text) && validOptions(capture.options) && (capture.blind === undefined || typeof capture.blind === 'boolean'), `Capture row ${index + 1}: invalid input, target or options.`);
      const key = captureKey(capture);
      if (seen.has(key)) {
        // A later visible capture exposes an earlier blind item; never unsee it.
        if (capture.blind !== true) seen.get(key).seenDuringDevelopment = true;
        continue;
      }
      let number = rows.length + added.length + 1;
      while (rows.some(row => row.id === `capture-${number}`) || added.some(row => row.id === `capture-${number}`)) number++;
      const row = {...template, ...(capture.blind === true ? {blind:true, seenDuringDevelopment:false, captureKind:'typed'} : {}), id:`capture-${number}`, unitId:`capture-${number}`, sourceId, sourceGroup:'needs-grouping', raw:capture.raw, text:capture.text, options:capture.options,
        customDictionary:capture.dictionary?.custom === 0 ? 'none' : 'unknown',
        notes:'Imported browser snapshot; set languages/domain/features, group related texts, and confirm the exact target and input. Capture is a final buffer, not an edit-event log.'};
      added.push(row);seen.set(key, row);
    }
    validateCorpus(sources, [...rows, ...added]);
    const temporary = join(root, '.cases-' + randomUUID() + '.tmp');
    try {
      await writeFile(temporary, jsonl([...rows, ...added]), {mode:0o600, flag:'wx'});
      await rename(temporary, join(root, 'cases.jsonl'));
    } finally {await rm(temporary, {force:true});}
    return {imported:added.length, duplicates:captures.length - added.length, note:'All imports are pending and unassigned; only blind captures are initially unexposed and eligible for held-out review.'};
  }
  requireThat(command === 'freeze' && rest.length === 1 && identifier(rest[0]), usage);
  requireThat(summary.readyToFreeze, 'Not ready to freeze. Run check and resolve active-row blockers first.');
  requireThat(rows.filter(active).every(row => row.sourceGroup !== 'needs-grouping'), 'Group related captures before assigning splits.');
  const selected = rows.filter(active);
  const snapshot = await externalPath(join(root, 'snapshots', rest[0]));
  await mkdir(dirname(snapshot), {recursive:true, mode:0o700});
  await mkdir(snapshot, {mode:0o700});
  const files = {'sources.json':json(sources.filter(source => selected.some(row => row.sourceId === source.id))), 'cases.jsonl':jsonl(selected)};
  for (const split of ['development', 'heldout', 'regression']) files[split + '.jsonl'] = jsonl(selected.filter(row => row.split === split));
  for (const [name, data] of Object.entries(files)) await writeFile(join(snapshot, name), data, {mode:0o600, flag:'wx'});
  const manifest = {format:'polytype-corpus-snapshot-v1', createdAt:new Date().toISOString(), summary,
    sha256:Object.fromEntries(Object.entries(files).map(([name, data]) => [name, hash(data)])),
    note:'A snapshot freezes annotations, not benchmark sufficiency or licensing approval. Unassigned/challenge rows are excluded. Never import evaluation text into dictionaries.'};
  await writeFile(join(snapshot, 'manifest.json'), json(manifest), {mode:0o600, flag:'wx'});
  return {frozen:true, rows:selected.length, units:summary.activeUnits, note:'No decoding performed; held-out text has not been evaluated.'};
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {console.log(json(await main(process.argv.slice(2))).trimEnd());}
  catch (error) {
    console.error(error instanceof CorpusError ? error.message : 'Corpus operation failed. Check external paths, permissions and whether the destination already exists. No source text was printed.');
    process.exitCode = 1;
  }
}
