// Join pinned ECDICT ranks onto the unchanged SCOWL vocabulary. No corpus input.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

const root = new URL('../', import.meta.url);
const revision = 'bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b';
const base = `https://raw.githubusercontent.com/skywind3000/ECDICT/${revision}/`;
const pins = {
  'ecdict.csv':'1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf',
  'LICENSE':'f8552dd246f61a4e064569eae6194a01c6b3d63b03bf27c6ca863593c549ed0f',
  'README.md':'0c3f95fc7e15f7eccf65feedb58ba3ebace1fe7b7cbdd1af60c9ace4cef9094b',
};
const args = process.argv.slice(2);
if (args.some(arg=>!arg.startsWith('--from-dir=') && !arg.startsWith('--output-dir='))) throw new Error('Use [--from-dir=DIR] [--output-dir=DIR]');
const local = args.find(arg=>arg.startsWith('--from-dir='))?.slice('--from-dir='.length);
const destination = args.find(arg=>arg.startsWith('--output-dir='))?.slice('--output-dir='.length);
const outputRoot = destination ? new URL('file://' + resolve(destination) + '/') : root;
const hash = bytes=>createHash('sha256').update(bytes).digest('hex');
const files = {};
for (const [name, expected] of Object.entries(pins)) {
  const bytes = local ? await readFile(join(local, name)) : Buffer.from(await (await fetch(base+name).then(response=>{
    if (!response.ok) throw new Error(`${response.status}: ${name}`);
    return response;
  })).arrayBuffer());
  if (hash(bytes)!==expected) throw new Error(`ECDICT checksum mismatch: ${name}`);
  files[name] = bytes;
}

// ECDICT contains quoted commas, escaped quotes and occasional physical newlines.
// Keep this parser independent of the evaluation importers.
function* csv(text) {
  let row=[], field='', quoted=false;
  for (let i=0; i<text.length; i++) {
    const c=text[i];
    if (c==='"') {
      if (quoted && text[i+1]==='"') {field+='"'; i++;}
      else if (quoted || field==='') quoted=!quoted;
      else throw new Error('Unexpected CSV quote');
    } else if (!quoted && (c===',' || c==='\n')) {
      row.push(field.replace(/\r$/, '')); field='';
      if (c==='\n') {yield row; row=[];}
    } else field+=c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length) {row.push(field.replace(/\r$/, '')); yield row;}
}
const vocabularyBytes = await readFile(new URL('data/english.tsv', root));
const scowl = JSON.parse(await readFile(new URL('data/english-source.json', root)));
if (hash(vocabularyBytes)!==scowl.sha256) throw new Error('SCOWL vocabulary checksum mismatch');
const vocabulary = new Set(vocabularyBytes.toString().trimEnd().split('\n').map(line=>line.split('\t')[0]));
const iterator = csv(files['ecdict.csv'].toString('utf8'));
const header = iterator.next().value;
const indexes = Object.fromEntries(['word','frq','bnc','exchange'].map(key=>{
  const index=header.indexOf(key);
  if (index<0) throw new Error(`Missing ECDICT column: ${key}`);
  return [key,index];
}));
const ranks = new Map(), rows=[];
const merge = (map, word, kind, rank)=>{
  if (!map.has(word)) map.set(word, {});
  const value=map.get(word);
  value[kind]=Math.min(value[kind]??Infinity, rank);
};
for (const fields of iterator) {
  if (fields.length!==header.length) throw new Error('Unexpected ECDICT row shape');
  const word=fields[indexes.word].toLowerCase();
  if (!vocabulary.has(word)) continue;
  const exchange=fields[indexes.exchange].split('/').map(value=>value.split(':'));
  rows.push({word, exchange});
  for (const kind of ['frq','bnc']) {
    const text=fields[indexes[kind]];
    if (text && !/^\d+$/.test(text)) throw new Error(`Invalid ${kind} rank`);
    const rank=Number(text);
    if (rank>0) merge(ranks, word, kind, rank);
  }
}
// One-hop morphological estimates use only independently ranked SCOWL lemmas.
// A factor of two discounts a lemma's evidence; never recursively propagate.
const forms = new Map();
for (const {word, exchange} of rows) for (const [kind, spelling] of exchange) {
  if (!spelling) continue;
  const form=spelling.toLowerCase();
  const from=kind==='0'?form:word, to=kind==='0'?word:form;
  if (kind!=='0' && !['p','d','i','3','r','t','s'].includes(kind)) continue;
  if (!vocabulary.has(to)) continue;
  for (const [corpus, rank] of Object.entries(ranks.get(from)??{})) merge(forms, to, corpus, 2*rank);
}
const counts={directFrq:0, inferredFrq:0, directBnc:0, inferredBnc:0, unranked:0};
const selected=new Map();
for (const word of [...vocabulary].sort()) {
  const direct=ranks.get(word)??{}, inferred=forms.get(word)??{};
  const choices=[['directFrq',direct.frq],['inferredFrq',inferred.frq],['directBnc',direct.bnc],['inferredBnc',inferred.bnc]];
  const choice=choices.find(([,rank])=>rank>0);
  if (!choice) {counts.unranked++; continue;}
  counts[choice[0]]++;
  selected.set(word, choice[1]);
}
// Lossless format: 16-byte header, SCOWL presence bitset, then little-endian
// 17-bit positive ranks for present words in the unchanged SCOWL file order.
// The pinned maximum is 99,992; fail rather than silently truncate new inputs.
const rankBits=17, headerBytes=16, presenceBytes=Math.ceil(vocabulary.size/8);
const rankBytes=Math.ceil(selected.size*rankBits/8);
const output=Buffer.alloc(headerBytes+presenceBytes+rankBytes);
output.write('EFR1', 0, 'ascii');
output.writeUInt32LE(vocabulary.size, 4);
output.writeUInt32LE(selected.size, 8);
output[12]=rankBits; // Bytes 13..15 are reserved zero.
let index=0, rankIndex=0;
for (const word of vocabulary) {
  const rank=selected.get(word);
  if (rank!==undefined) {
    if (rank<1 || rank>=2**rankBits) throw new Error('Rank exceeds compact format');
    output[headerBytes+(index>>3)]|=1<<(index&7);
    const bit=rankIndex++*rankBits, byte=headerBytes+presenceBytes+(bit>>3);
    const packed=rank<<(bit&7);
    for (let offset=0; offset<3; offset++) output[byte+offset]|=(packed>>>(8*offset))&255;
  }
  index++;
}
if (output.length>150000) throw new Error('English rank table exceeds the 150 KB import budget');
await mkdir(new URL('data/sources/ecdict/', outputRoot), {recursive:true});
await writeFile(new URL('data/english-frequency.bin', outputRoot), output);
await writeFile(new URL('data/sources/ecdict/LICENSE', outputRoot), files.LICENSE);
await writeFile(new URL('data/english-frequency-source.json', outputRoot), JSON.stringify({
  source:'ECDICT — skywind3000 / Linwei and contributors', revision,
  repository:'https://github.com/skywind3000/ECDICT', license:'MIT',
  inputs:Object.entries(pins).map(([path, sha256])=>({path, url:base+path, sha256})),
  vocabulary:{path:'data/english.tsv', entries:vocabulary.size, sha256:hash(vocabularyBytes)},
  selection:'Exact lowercase join onto SCOWL only; minimum positive rank for duplicate headwords. Prefer direct contemporary frq, then one-hop inferred frq (2x lemma rank), then direct bnc, then inferred bnc. Morphology uses only SCOWL lemmas and ECDICT exchange 0/p/d/i/3/r/t/s; no recursive propagation. No definitions, translations, examples or evaluation input.',
  format:{magic:'EFR1', headerBytes, order:'data/english.tsv file order', presence:'one bit per spelling, least-significant bit first; 1 = ranked, 0 = fallback', ranks:'positive integers packed least-significant bit first, only for present spellings', rankBits, reserved:'header bytes 13..15 zero', maxRank:Math.max(...selected.values()), lossless:true},
  ranksSha256:hash([...selected].map(([word, rank])=>`${word}\t${rank}\n`).join('')),
  fallbackRank:200000, entries:selected.size, bytes:Buffer.byteLength(output), counts, sha256:hash(output),
}, null, 2)+'\n');
console.log(JSON.stringify({entries:selected.size, bytes:Buffer.byteLength(output), counts}));
