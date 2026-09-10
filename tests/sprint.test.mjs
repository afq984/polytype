import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createEngine} from '../web/engine.mjs';
import {encodeMixedInput,mixedCases} from '../eval/cases.mjs';

test('English import has pinned provenance and bundled notices',()=>{
 const root=new URL('../',import.meta.url);
 const source=JSON.parse(readFileSync(new URL('data/english-source.json',root)));
 const data=readFileSync(new URL('data/english.tsv',root));
 const license=readFileSync(new URL('data/sources/scowl/Copyright',root));
 const hash=v=>createHash('sha256').update(v).digest('hex');
 assert.equal(hash(data),source.sha256);assert.equal(hash(license),source.licenseSha256);
 assert.equal(source.entries,101191);assert.equal(source.sources.length,19);
 const rows=data.toString().trim().split('\n');assert.equal(rows.length,source.entries);
 assert.equal(new Set(rows.map(line=>line.split('\t')[0])).size,source.entries);
 assert.ok(readFileSync(new URL('web/dictionary-notices.txt',root),'utf8').includes(license.toString()));
 // The importer reads only the pinned archive, never local evaluation data.
 assert.ok(!readFileSync(new URL('scripts/import-english.mjs',root),'utf8').includes('../eval/'));
});

test('sprint keeps English controls, explicit kana, case and spaces usable',()=>{
 const engine=createEngine();
 try {
  assert.equal(engine.dictionarySize().englishImported,101191);
  for(const layout of ['colemak','qwerty'])for(const zhuyin of [false,true]) {
   const raw=text=>layout==='colemak'?encodeMixedInput(text):text;
   for(const [input,text] of [
    ['please rename the configuration file.','please rename the configuration file.'],
    ['the server is unavailable.','the server is unavailable.'],
    ['please undo the changes.','please undo the changes.'],
    ['we need to review this.','we need to review this.'],
    ['no thanks','no thanks'],['ha ha','ha ha'],['to the airport','to the airport'],
    ['hello ha','hello ha'],['hello kan','hello kan'],
    ['sakura ga saku.','さくら が さく.'],['ashita no yotei','あした の よてい'],
    ['Tanaka','Tanaka'],['Wi-Fi','Wi-Fi'],['xtsu','っ'],['lya','ゃ'],
   ])assert.equal(engine.decode(raw(input),{layout,zhuyin})[0]?.text,text,`${layout}/${zhuyin}: ${input}`);
  }
  for(const row of mixedCases.filter(row=>/mixed-0[1245]-/.test(row.id))) {
   assert.equal(engine.decode(row.raw,row.options)[0].text,row.text,row.id);
  }
 }finally{engine.dispose()}
});
