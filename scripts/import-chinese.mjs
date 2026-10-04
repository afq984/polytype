// Reproducible, corpus-independent subset of McBopomofo's source lexicon.
// --phrase-limit=40000 (or all), --from-dir=DIR and --output-dir=DIR permit
// checksum-verified coverage experiments without overwriting the shipped cut.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {heterophonyDefaultLog,heterophonyStep,upstreamNormalization,readingCounter} from './chinese-readings.mjs';
const root = new URL('../', import.meta.url);
const option = name => process.argv.slice(2).find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
const requestedLimit = option('phrase-limit') ?? '40000';
if (requestedLimit!=='all' && !/^[1-9]\d*$/.test(requestedLimit)) throw new Error('Phrase limit must be a positive integer or all');
const phraseLimit = requestedLimit==='all' ? Infinity : Number(requestedLimit);
if (requestedLimit!=='all' && !Number.isSafeInteger(phraseLimit)) throw new Error('Phrase limit must be a safe integer');
const localDir = option('from-dir');
const outputRoot = option('output-dir') ? pathToFileURL(resolve(option('output-dir'))+'/') : root;
const revision = 'f5ba010ce8795d283ee336ca7d16380f200bd2ec';
const base = `https://raw.githubusercontent.com/openvanilla/McBopomofo/${revision}/`;
const readingSources = {
  'Source/Data/heterophony1.list':'7fddbb6a66022b1809181484c7627d79dee4231849cb2d3c8c8cd4578b3d22cb',
  'Source/Data/heterophony2.list':'4afd69a2702ae3af533cd01b755f81d77a430ace91311a8229319334aec24e37',
  'Source/Data/heterophony3.list':'8be3f37fe419744c3792df1bdfc67a0abdb215dbbb759c92204d4f8d68a32cd9',
  'Source/Data/exclusion.txt':'d0d72eb220d31d5800658de8d788a9e2531b504e9f05ffe633fb11d43d217a3d',
};
const sources = ['Source/Data/BPMFBase.txt', 'Source/Data/BPMFMappings.txt', 'Source/Data/phrase.occ', 'LICENSE.txt',...Object.keys(readingSources)];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('data/sources/mcbopomofo/', outputRoot), {recursive:true});
const prior = await readFile(new URL('data/chinese-source.json', root), 'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;return null});
const inputs = await Promise.all(sources.map(async path => {
  const bytes = localDir ? await readFile(join(localDir,path)) : await fetch(base+path).then(async response=>{
    if (!response.ok) throw new Error(`${response.status}: ${path}`);
    return Buffer.from(await response.arrayBuffer());
  });
  const hash = sha256(bytes);
  const expected = readingSources[path] ?? prior?.sources.find(source=>source.path===path)?.sha256;
  if (expected && hash!==expected) throw new Error(`Source checksum mismatch: ${path}`);
  return {path, hash, text:bytes.toString('utf8')};
}));
const occurrence = new Map(inputs[2].text.trim().split('\n').map(line=>{
  const [text, count] = line.split(/\s+/); return [text, Number(count)];
}));
const upstreamNorm=upstreamNormalization(occurrence,inputs[7].text);
const readingCount=readingCounter(inputs.slice(4,7).map(input=>input.text),upstreamNorm);
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
  rows.set(id, [reading,text,readingCount(text,reading,count)]);
}
for (const line of inputs[0].text.trim().split('\n')) {
  const [text,reading,,,encoding] = line.trim().split(/\s+/);
  if (encoding!=='big5') {stats.nonBig5Single++;continue;}
  add(text,[reading]);
}
for (const line of inputs[1].text.trim().split('\n')) {
  const [text,...syllables] = line.trim().split(/\s+/); add(text,syllables);
}
// Keep the exact surface-count order/cut for historical structural ablations.
// Modern dictionaries sort single-reading choices by their conditioned counts.
const order=(a,b)=>occurrence.get(b[1])-occurrence.get(a[1]) || (a[1]<b[1]?-1:a[1]>b[1]?1:a[0]<b[0]?-1:1);
const ordered = [...rows.values()].sort(order);
const singles = ordered.filter(row=>!row[0].includes(' '));
const phrases = ordered.filter(row=>row[0].includes(' ')).slice(0,phraseLimit);
const selected = [...singles,...phrases].sort(order);
const output = selected.map(row=>row.join('\t')).join('\n')+'\n';
await writeFile(new URL('data/chinese.tsv',outputRoot),output);
await writeFile(new URL('data/sources/mcbopomofo/LICENSE.txt',outputRoot),inputs[3].text);
const manifest = {name:'McBopomofo',revision,license:'MIT; upstream describes BPMFMappings ancestry as libtabe BSD',
  selection:`All positive-frequency Big5 single-character readings; ${requestedLimit==='all'?'all':`top ${phraseLimit.toLocaleString('en-US')}`} positive-frequency phrase/readings. Han output only. No evaluation-corpus input.`,
  sources:inputs.map(x=>({path:x.path,url:base+x.path,sha256:x.hash})),
  readingCounts:{rule:'McBopomofo base-10 log heterophony adjustment; original positive surface counts retained for primary/unlisted characters and phrases',
    compiler:{path:'Source/Data/curation/compilers/main_compiler.py',sha256:'1ba950bc915ef423d3f01b44066e5aa6539293a11da13042f9f30f2c9fa572c4'},
    normalizer:{path:'Source/Data/curation/builders/frequency_builder.py',sha256:'8042e65097ff209464e702a846e6cea42aa566dc8197f0f712b9e947dd4b26e7'},
    upstreamNorm,defaultLog:heterophonyDefaultLog,defaultCount:upstreamNorm*10**heterophonyDefaultLog,logStep:heterophonyStep,
    secondaryMultiplier:10**-heterophonyStep,tertiaryMultiplier:10**(-2*heterophonyStep),
    // Diagnostic-only restoration; no extra source vocabulary or decoder alias.
    historicalSingleCounts:Object.fromEntries(selected.filter(row=>row[2]!==occurrence.get(row[1])).map(row=>[row[1],occurrence.get(row[1])]))},
  entries:selected.length,uniqueOutputs:new Set(selected.map(row=>row[1])).size,singles:singles.length,phrases:phrases.length,
  skipped:stats,sha256:sha256(output)};
await writeFile(new URL('data/chinese-source.json',outputRoot),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({entries:manifest.entries,uniqueOutputs:manifest.uniqueOutputs,singles:manifest.singles,phrases:manifest.phrases,bytes:Buffer.byteLength(output),skipped:stats},null,2));
