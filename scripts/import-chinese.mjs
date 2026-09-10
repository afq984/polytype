// Reproducible, corpus-independent subset of McBopomofo's source lexicon.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const revision = 'f5ba010ce8795d283ee336ca7d16380f200bd2ec';
const base = `https://raw.githubusercontent.com/openvanilla/McBopomofo/${revision}/`;
const sources = ['Source/Data/BPMFBase.txt', 'Source/Data/BPMFMappings.txt', 'Source/Data/phrase.occ', 'LICENSE.txt'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('data/sources/mcbopomofo/', root), {recursive:true});
const prior = await readFile(new URL('data/chinese-source.json', root), 'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;return null});
const inputs = await Promise.all(sources.map(async path => {
  const response = await fetch(base+path);
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = sha256(bytes);
  const expected = prior?.sources.find(source=>source.path===path)?.sha256;
  if (expected && hash!==expected) throw new Error(`Source checksum mismatch: ${path}`);
  return {path, hash, text:bytes.toString('utf8')};
}));
const occurrence = new Map(inputs[2].text.trim().split('\n').map(line=>{
  const [text, count] = line.split(/\s+/); return [text, Number(count)];
}));
const stats = {invalid:0, zeroFrequency:0, nonBig5Single:0, duplicate:0};
const values = [...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ'];
function validSyllable(s) {
  if (!/^[ㄅ-ㄩ]{1,3}[ˊˇˋ˙]?$/.test(s)) return false;
  const categories = [...s.replace(/[ˊˇˋ˙]$/, '')].map(c=>{const i=values.indexOf(c);return i<21?0:i<24?1:2});
  return new Set(categories).size === categories.length;
}
const rows = new Map();
function add(text, syllables) {
  if (!/^\p{Script=Han}+$/u.test(text) || [...text].length!==syllables.length || syllables.length>12 || !syllables.every(validSyllable)) {stats.invalid++;return;}
  const count = occurrence.get(text) || 0;
  if (!Number.isFinite(count) || count<=0) {stats.zeroFrequency++;return;}
  const reading = syllables.join(' '), id=reading+'\t'+text;
  if (rows.has(id)) {stats.duplicate++;return;}
  rows.set(id, [reading,text,count]);
}
for (const line of inputs[0].text.trim().split('\n')) {
  const [text,reading,,,encoding] = line.trim().split(/\s+/);
  if (encoding!=='big5') {stats.nonBig5Single++;continue;}
  add(text,[reading]);
}
for (const line of inputs[1].text.trim().split('\n')) {
  const [text,...syllables] = line.trim().split(/\s+/); add(text,syllables);
}
const ordered = [...rows.values()].sort((a,b)=>b[2]-a[2] || (a[1]<b[1]?-1:a[1]>b[1]?1:a[0]<b[0]?-1:1));
const singles = ordered.filter(row=>!row[0].includes(' '));
const phrases = ordered.filter(row=>row[0].includes(' ')).slice(0,20000);
const selected = [...singles,...phrases].sort((a,b)=>b[2]-a[2] || (a[1]<b[1]?-1:a[1]>b[1]?1:a[0]<b[0]?-1:1));
const output = selected.map(row=>row.join('\t')).join('\n')+'\n';
await writeFile(new URL('data/chinese.tsv',root),output);
await writeFile(new URL('data/sources/mcbopomofo/LICENSE.txt',root),inputs[3].text);
const manifest = {name:'McBopomofo',revision,license:'MIT; upstream describes BPMFMappings ancestry as libtabe BSD',
  selection:'All positive-frequency Big5 single-character readings; top 20,000 positive-frequency phrase/readings. Han output only. No evaluation-corpus input.',
  sources:inputs.map(x=>({path:x.path,url:base+x.path,sha256:x.hash})),
  entries:selected.length,uniqueOutputs:new Set(selected.map(row=>row[1])).size,singles:singles.length,phrases:phrases.length,
  skipped:stats,sha256:sha256(output)};
await writeFile(new URL('data/chinese-source.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({entries:manifest.entries,uniqueOutputs:manifest.uniqueOutputs,singles:manifest.singles,phrases:manifest.phrases,bytes:Buffer.byteLength(output),skipped:stats},null,2));
