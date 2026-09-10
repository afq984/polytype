import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine} from '../web/engine.mjs';
import {mixedCases} from '../eval/cases.mjs';
import {diversityCases} from '../eval/diversity-cases.mjs';

const baseline=JSON.parse(readFileSync(new URL('../eval/diversity-baseline.json',import.meta.url)));
test('frozen controls and existing correct candidates survive family retention',()=>{
  assert.equal(createHash('sha256').update(readFileSync(new URL('../eval/diversity-controls.json',import.meta.url))).digest('hex'),baseline.controlsSha256);
  assert.equal(diversityCases.length,92);
  const engine=createEngine();
  try{
    for(const row of baseline.rows.filter(row=>row.group!=='diversity-ambiguous')){
      const before=row.runs[0],after=engine.decode(row.raw,row.options),texts=after.map(c=>engine.commitCandidate(c));
      if(before.exactRank===1)assert.equal(texts[0],row.expected,row.id);
      if(before.rank)assert.ok(texts.some(t=>[row.expected,...row.alternatives].includes(t)),row.id);
      for(const old of before.candidates){
        const same=after.find(c=>engine.commitCandidate(c)===old.text);
        if(same)assert.ok(Math.abs(same.score-old.score)<1e-10,`${row.id}: unchanged path score`);
      }
    }
  }finally{engine.dispose()}
});

test('mixed alternatives vary interpretations instead of only kana scripts',()=>{
  const engine=createEngine();
  try{
    for(const row of mixedCases.filter(r=>r.id.startsWith('mixed-03-')||r.id.startsWith('mixed-06-'))){
      const candidates=engine.decode(row.raw,row.options);
      assert.notEqual(candidates[0].text,row.input,`${row.id}: mixed path survives`);
      const folded=candidates.slice(0,4).map(c=>c.text.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)));
      assert.equal(new Set(folded).size,4,`${row.id}: distinct choices`);
      if(row.id.startsWith('mixed-06-')&&!(row.options.layout==='colemak'&&row.options.zhuyin)){
        assert.ok(candidates.some(c=>engine.commitCandidate(c)===row.text),`${row.id}: Latin name alternative`);
      }
    }
    for(const [raw,hira,kata] of [['gakkou','がっこう','ガッコウ'],['kan','かん','カン'],['kan.','かん.','カン.']]){
      const candidates=engine.decode(raw,{layout:'qwerty',english:false,zhuyin:false});
      for(const expected of [hira,kata])assert.ok(candidates.some(c=>engine.commitCandidate(c)===expected));
    }
  }finally{engine.dispose()}
});

test('native and WASM agree on every frozen diversity control',()=>{
  const requests=diversityCases.map(row=>({version:1,op:'decode',input:row.raw,options:row.options}));
  const result=spawnSync(fileURLToPath(new URL('../target/debug/polytype-json',import.meta.url)),[],{
    input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024,
  });
  assert.equal(result.status,0,result.stderr);
  const rows=result.stdout.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(rows.length,requests.length);
  const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e10)/1e10:v));
  const engine=createEngine();
  try{requests.forEach((r,i)=>assert.deepEqual(normalize(engine.decode(r.input,r.options)),normalize(rows[i].ok),diversityCases[i].id))}
  finally{engine.dispose()}
});
