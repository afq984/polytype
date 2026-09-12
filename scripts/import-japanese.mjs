// Reproducible subset of Mozc's open-source dictionary; never reads evaluation text.
// Usage: node scripts/import-japanese.mjs [--from-dir=DIR]
// --from-dir reproduces the import from previously downloaded upstream files;
// their checksums are still verified against the pinned manifest.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const revision = '60af02ff797275f2ba1b7fddccdec916798d112e';
const base = `https://raw.githubusercontent.com/google/mozc/${revision}/src/data/dictionary_oss/`;
const inputs = [...Array.from({length:10},(_,i)=>`dictionary0${i}.txt`), 'id.def', 'connection_single_column.txt', 'README.txt'];
const localDir = process.argv.slice(2).find(arg=>arg.startsWith('--from-dir='))?.slice('--from-dir='.length);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestUrl = new URL('data/japanese-source.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
if (manifest.revision !== revision) throw new Error('Romaji table and dictionary must be pinned to the same Mozc revision');
const prior = manifest.dictionary?.inputs ?? [];
const files = new Map();
for (const path of inputs) {
  const bytes = localDir ? await readFile(new URL(path, `file://${localDir.replace(/\/?$/, '/')}`)) : Buffer.from(await (await fetch(base+path).then(r=>{if(!r.ok)throw new Error(`${r.status}: ${path}`);return r})).arrayBuffer());
  const hash = sha256(bytes);
  const expected = prior.find(source=>source.path===path)?.sha256;
  if (expected && hash!==expected) throw new Error(`Source checksum mismatch: ${path}`);
  files.set(path, {hash, text:bytes.toString('utf8')});
}
// Part-of-speech classes from id.def. Symbols, sentence boundaries, fillers,
// numerals and other non-lexical ids are excluded.
const pos = new Map(files.get('id.def').text.trim().split('\n').map(line=>{const i=line.indexOf(' ');return [line.slice(0,i), line.slice(i+1).split(',')]}));
function lexical(id) {
  const [p0, p1] = pos.get(id) ?? [];
  if (['記号','BOS/EOS','その他','フィラー'].includes(p0) || !p0) return false;
  if (p0 === '名詞' && p1 === '数') return false; // Numeral units such as 澗 carry zero word cost; digits are typed directly.
  return true;
}
// Mozc's word costs are class-relative; the connection matrix carries the rest.
// A word converted on its own is scored by Mozc as BOS -> word -> EOS, so that
// standalone cost is used for both selection and alternative order. Row-major
// entries follow the matrix size on the first line: cost(rid, lid) = matrix[rid * n + lid].
const connectionLines = files.get('connection_single_column.txt').text.split('\n');
const size = Number(connectionLines[0]);
if (!(size > 0) || connectionLines.length < size * size + 1) throw new Error('Unexpected connection matrix shape');
const matrix = new Int32Array(size * size);
for (let i = 0; i < size * size; i++) matrix[i] = Number(connectionLines[i + 1]);
const standalone = (lid, rid, cost) => matrix[lid] + cost + matrix[rid * size];
// The limit is a browser-size budget, not a claim that excluded words are wrong.
const limit = 70000;
const perReading = 8;
const stats = {rows:0, invalidReading:0, excludedPos:0, duplicate:0, overLimit:0, overReadingCap:0};
const best = new Map();
for (let i = 0; i < 10; i++) {
  for (const line of files.get(`dictionary0${i}.txt`).text.split('\n')) {
    if (!line) continue;
    stats.rows++;
    const [reading, lid, rid, cost, surface] = line.split('\t');
    if (!/^[ぁ-ゔー]+$/u.test(reading) || !surface) {stats.invalidReading++; continue;}
    if (!lexical(lid)) {stats.excludedPos++; continue;}
    const key = reading + '\t' + surface, value = standalone(Number(lid), Number(rid), Number(cost));
    const existing = best.get(key);
    if (existing) {stats.duplicate++; if (value < existing.cost) {existing.cost = value; existing.pos = pos.get(lid)[0];} continue;}
    best.set(key, {reading, surface, cost:value, pos:pos.get(lid)[0]});
  }
}
const order = (a,b)=>a.cost-b.cost || (a.reading<b.reading?-1:a.reading>b.reading?1:a.surface<b.surface?-1:a.surface>b.surface?1:0);
const ordered = [...best.values()].sort(order);
const selected = ordered.slice(0, limit);
stats.overLimit = ordered.length - selected.length;
const maxStandaloneCost = selected.at(-1)?.cost ?? null;
selected.sort((a,b)=>(a.reading<b.reading?-1:a.reading>b.reading?1:0) || order(a,b));
const counts = new Map();
const rows = selected.filter(row=>{
  const n = (counts.get(row.reading) ?? 0) + 1;
  counts.set(row.reading, n);
  if (n > perReading) {stats.overReadingCap++; return false;}
  return true;
});
const classes = {};
for (const row of rows) classes[row.pos] = (classes[row.pos] ?? 0) + 1;
const output = rows.map(row=>`${row.reading}\t${row.surface}\t${row.cost}\n`).join('');
await mkdir(new URL('data/sources/mozc/', root), {recursive:true});
await writeFile(new URL('data/japanese.tsv', root), output);
await writeFile(new URL('data/sources/mozc/README.txt', root), files.get('README.txt').text);
manifest.name = 'Mozc default romaji table and open-source dictionary subset';
manifest.selection = 'Unmodified upstream romaji table for the expanded composer (prototype retains data/kana.json), plus the dictionary subset described below.';
const readme = manifest.sources.find(source=>source.path.endsWith('/README.txt'));
const readmeSource = {path:'src/data/dictionary_oss/README.txt', url:base+'README.txt', sha256:files.get('README.txt').hash};
if (readme) Object.assign(readme, readmeSource); else manifest.sources.push(readmeSource);
manifest.dictionary = {
  name:'Mozc open-source dictionary subset (IPAdic-derived, with Okinawa dictionary entries)',
  selection:`Rows with hiragana readings, keyed by reading and surface at their lowest standalone cost (BOS connection + word cost + EOS connection from the pinned connection matrix). The ${limit} lowest-cost pairs, at most ${perReading} surfaces per reading; symbols, sentence boundaries, fillers and numerals excluded. The stored cost orders alternatives only. No evaluation input.`,
  inputs:inputs.map(path=>({path:`src/data/dictionary_oss/${path}`, url:base+path, sha256:files.get(path).hash})),
  limit, perReading, maxStandaloneCost, classes,
  entries:rows.length, readings:counts.size, uniqueSurfaces:new Set(rows.map(row=>row.surface)).size,
  hiraganaIdentical:rows.filter(row=>row.reading===row.surface).length,
  skipped:stats, sha256:sha256(output),
};
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({entries:rows.length, readings:counts.size, bytes:Buffer.byteLength(output), maxStandaloneCost:manifest.dictionary.maxStandaloneCost, classes, skipped:stats}, null, 2));
