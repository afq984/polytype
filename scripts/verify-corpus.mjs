// Explicit network step: verifies source excerpts, not used by evaluation/builds.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url);
const corpus = JSON.parse(await readFile(new URL('eval/corpus.json',root),'utf8'));
const base=`https://raw.githubusercontent.com/${corpus.source}/${corpus.revision}/`;
const path='zh_gsd-ud-test.conllu';
const response=await fetch(base+path);assert.equal(response.status,200);
const text=await response.text();
const sentences=new Map(text.split('\n\n').map(block=>[block.match(/^# sent_id = (.+)$/m)?.[1],block.match(/^# text = (.+)$/m)?.[1]]));
for(const entry of corpus.cases)assert.ok(sentences.get(entry.sourceSent)?.includes(entry.text),entry.id);
await mkdir(new URL('eval/sources/',root),{recursive:true});
for(const name of ['LICENSE.txt','README.md']){
 const r=await fetch(base+name);assert.equal(r.status,200);
 await writeFile(new URL('eval/sources/UD_Chinese-GSD-'+name,root),await r.text());
}
await writeFile(new URL('eval/sources/manifest.json',root),JSON.stringify({repository:corpus.source,revision:corpus.revision,url:base+path,sha256:createHash('sha256').update(text).digest('hex'),verified:corpus.cases.length,license:corpus.license},null,2)+'\n');
console.log(`Verified ${corpus.cases.length} contiguous source excerpts.`);
