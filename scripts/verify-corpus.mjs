// Explicit network step: verifies source excerpts, not used by evaluation/builds.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url);
const corpus = JSON.parse(await readFile(new URL('eval/corpus.json',root),'utf8'));
const japanese = JSON.parse(await readFile(new URL('eval/japanese-words.json',root),'utf8'));
await mkdir(new URL('eval/sources/',root),{recursive:true});
const manifest={};
async function fetchText(url){const r=await fetch(url);assert.equal(r.status,200,url);return r.text();}
async function retainNotices(name,base){
  for(const file of ['LICENSE.txt','README.md'])await writeFile(new URL(`eval/sources/${name}-${file}`,root),await fetchText(base+file));
}
{
  const base=`https://raw.githubusercontent.com/${corpus.source}/${corpus.revision}/`;
  const path='zh_gsd-ud-test.conllu';
  const text=await fetchText(base+path);
  const sentences=new Map(text.split('\n\n').map(block=>[block.match(/^# sent_id = (.+)$/m)?.[1],block.match(/^# text = (.+)$/m)?.[1]]));
  for(const entry of corpus.cases)assert.ok(sentences.get(entry.sourceSent)?.includes(entry.text),entry.id);
  await retainNotices('UD_Chinese-GSD',base);
  manifest['UD_Chinese-GSD']={repository:corpus.source,revision:corpus.revision,url:base+path,sha256:createHash('sha256').update(text).digest('hex'),verified:corpus.cases.length,license:corpus.license};
}
{
  const base=`https://raw.githubusercontent.com/${japanese.source}/${japanese.revision}/`;
  const text=await fetchText(base+japanese.file);
  assert.equal(createHash('sha256').update(text).digest('hex'),japanese.sha256,'pinned Japanese treebank file');
  const blocks=new Map(text.split('\n\n').map(block=>[block.match(/^# sent_id = (.+)$/m)?.[1],block]));
  for(const entry of japanese.cases){
    const block=blocks.get(entry.sourceSent);
    // The long-unit lemma reading and lemma are the last two UnidicInfo fields.
    assert.ok(block?.split('\n').some(line=>line.includes('UnidicInfo=')&&line.endsWith(`,${entry.reading},${entry.text}`)),entry.id);
  }
  await retainNotices('UD_Japanese-GSD',base);
  manifest['UD_Japanese-GSD']={repository:japanese.source,revision:japanese.revision,url:base+japanese.file,sha256:japanese.sha256,verified:japanese.cases.length,license:japanese.license};
}
await writeFile(new URL('eval/sources/manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified ${corpus.cases.length} contiguous Chinese excerpts and ${japanese.cases.length} Japanese long-unit words.`);
