import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine,readingKeys} from '../web/engine.mjs';
import {cases,feedbackCases,guardCases,kanaLevel} from '../eval/cases.mjs';

test('user ranking feedback and language guards retain their intended top output',()=>{
  const engine=createEngine();
  try {
    for(const row of [...feedbackCases,...guardCases]) {
      // Kana-annotated guards accept an imported conversion of the same reading.
      const best=engine.decode(row.raw)[0];
      assert.ok(engine.commitCandidate(best)===row.text||kanaLevel(best)===row.text,`${row.id}: ${engine.commitCandidate(best)}`);
    }
    for(const row of feedbackCases)for(let i=1;i<=row.raw.length;i++) {
      assert.ok(engine.decode(row.raw.slice(0,i)).length,`${row.id}: prefix ${i}`);
    }
  }finally{engine.dispose()}
});

test('expanded data matches pinned manifest and remains independent of evaluation',()=>{
  const source=readFileSync(new URL('../data/chinese.tsv',import.meta.url));
  const manifest=JSON.parse(readFileSync(new URL('../data/chinese-source.json',import.meta.url)));
  assert.equal(createHash('sha256').update(source).digest('hex'),manifest.sha256);
  assert.equal(source.toString().trim().split('\n').length,manifest.entries);
  assert.equal(manifest.entries,28184);
  // No whole evaluation excerpts have been inserted as dictionary entries.
  const words=new Set(source.toString().trim().split('\n').map(line=>line.split('\t')[1]));
  for(const row of cases.filter(row=>row.group==='real-text'))assert.ok(!words.has(row.text),row.id);
});

test('expanded native and WASM candidates agree on real text and language guards',()=>{
  const engine=createEngine();
  try{
    const requests=cases.map(row=>({version:1,op:'decode',input:row.raw,options:row.options}));
    const child=spawnSync(fileURLToPath(new URL('../target/debug/polytype-json'+(process.platform==='win32'?'.exe':''),import.meta.url)),[],{
      input:requests.map(row=>JSON.stringify(row)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024,
    });
    assert.equal(child.status,0,child.stderr);
    const results=child.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
    const normalized=value=>JSON.parse(JSON.stringify(value,(key,val)=>key==='score'?Math.round(val*1e10)/1e10:val));
    assert.equal(results.length,cases.length);
    cases.forEach((row,i)=>assert.deepEqual(normalized(engine.decode(row.raw,row.options)),normalized(results[i]),row.id));
    assert.equal(engine.dictionarySize().imported,28184);
  }finally{engine.dispose()}
});

test('custom entries take priority over imported homophones and reset cleanly',()=>{
  const engine=createEngine();
  try{
    const raw=readingKeys('ㄗ ㄌㄧㄠˋ ㄎㄨˋ').join('');
    assert.equal(engine.decode(raw)[0].text,'資料庫');
    engine.setCustomEntries([{reading:'ㄗ ㄌㄧㄠˋ ㄎㄨˋ',text:'我的資料庫'}]);
    assert.equal(engine.decode(raw)[0].text,'我的資料庫');
    assert.throws(()=>engine.setCustomEntries([{reading:'bad',text:'bad'}]));
    assert.equal(engine.decode(raw)[0].text,'我的資料庫');
    engine.setCustomEntries([]);
    assert.equal(engine.decode(raw)[0].text,'資料庫');
  }finally{engine.dispose()}
});
