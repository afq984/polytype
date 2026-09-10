// Reproducible SCOWL subset; deliberately never reads evaluation text.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const url='https://deb.debian.org/debian/pool/main/s/scowl/scowl_2020.12.07.orig.tar.gz';
const sha256='5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc';
const hash=b=>createHash('sha256').update(b).digest('hex');
const response=await fetch(url);if(!response.ok)throw new Error(`Download failed: ${response.status}`);
const archive=Buffer.from(await response.arrayBuffer());
if(hash(archive)!==sha256)throw new Error('SCOWL archive checksum mismatch');
const tar=args=>execFileSync('tar',args,{input:archive,maxBuffer:16*1024*1024});
const files=tar(['-tz']).toString().trim().split('\n').filter(name=>/\/final\/(english-words|american-words|english-contractions)\.(10|20|35|40|50|55|60)$/.test(name)).sort();
if(files.length!==19)throw new Error(`Unexpected source file count: ${files.length}`);
const words=new Map(),sources=[];
for(const name of files){
 const bytes=tar(['-xzO',name]),tier=Number(name.split('.').at(-1));
 sources.push({path:name,sha256:hash(bytes)});
 for(const word of bytes.toString('utf8').trim().split(/\r?\n/)) {
  if(/^[a-z]+(?:['-][a-z]+)*$/.test(word))words.set(word,Math.min(tier,words.get(word)??100));
 }
}
const output=[...words].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([word,tier])=>`${word}\t${tier}\n`).join('');
const license=tar(['-xzO','scowl-2020.12.07/Copyright']);
await mkdir(new URL('../data/sources/scowl/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/sources/scowl/Copyright',import.meta.url),license);
await writeFile(new URL('../data/english.tsv',import.meta.url),output);
await writeFile(new URL('../data/english-source.json',import.meta.url),JSON.stringify({
 source:'SCOWL 2020.12.07 — Kevin Atkinson and contributors',url,archiveSha256:sha256,
 selection:'Lowercase ASCII words/contractions, English and American lists, levels 10–60; minimum tier per spelling. Tiers are coverage categories, not calibrated frequencies. No evaluation input.',
 entries:words.size,sha256:hash(output),licenseSha256:hash(license),sources,
},null,2)+'\n');
console.log(`Imported ${words.size} English spellings.`);
