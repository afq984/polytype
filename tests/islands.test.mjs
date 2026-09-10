import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';
import {captureA,captureB,islandCases} from '../eval/island-cases.mjs';
const baseline=JSON.parse(readFileSync(new URL('../eval/island-baseline.json',import.meta.url)));
const normalize=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='score'?Math.round(x*1e9)/1e9:x));

test('English islands survive with unchanged scores and tone boundaries',()=>{
  const e=createEngine();
  try{
    const a=e.decode(captureA,{layout:'colemak'});
    assert.equal(e.commitCandidate(a[0]),'量到的 p95 latency 曾加了 11.6% 還在範圍之內');
    assert.ok(a.slice(0,2).some(c=>e.commitCandidate(c)==='量到的 p95 latency 增加了 11.6% 還在範圍之內'));
    assert.ok(a.some(c=>e.commitCandidate(c)===e.colemak(captureA)));
    for(const raw of [captureA,captureB])for(let i=1;i<=raw.length;i++){
      const prefix=raw.slice(0,i);
      assert.ok(e.decode(prefix,{layout:'colemak'}).some(c=>e.commitCandidate(c)===e.colemak(prefix)),`literal prefix ${i}`);
    }
    assert.ok(!e.decode(captureB,{layout:'colemak'}).some(c=>e.commitCandidate(c).includes('跟claude')),'first-tone experiment must not ship');
    assert.ok(e.commitCandidate(e.decode(captureB.replace('ep cuaigk','ep  cuaigk'),{layout:'colemak'})[0]).includes('跟 claude 討論'));
    for(const row of baseline.rows){
      const candidates=e.decode(row.raw,row.options),texts=candidates.map(c=>e.commitCandidate(c));
      if(row.text&&row.candidates[0]?.text===row.text)assert.equal(texts[0],row.text,row.id);
      if(row.text&&row.candidates.some(c=>[row.text,...(row.alternatives??[])].includes(c.text)))assert.ok(texts.some(t=>[row.text,...(row.alternatives??[])].includes(t)),row.id);
      if(row.chinese||row.id.startsWith('probe-')||row.id.startsWith('abbreviation-'))assert.equal(texts[0],row.candidates[0]?.text,row.id);
      for(const old of row.candidates){const same=candidates.find(c=>e.commitCandidate(c)===old.text);if(same)assert.ok(Math.abs(same.score-old.score)<1e-9,row.id+' score')}
    }
    for(const english of [false,true])for(const japanese of [false,true])for(const zhuyin of [false,true]){
      const c=e.decode(captureA,{layout:'colemak',english,japanese,zhuyin});
      if(!english&&!japanese&&!zhuyin)assert.deepEqual(c,[]);
      for(const p of c.flatMap(c=>c.parts))if(['EN','JP','TW'].includes(p.lang))assert.ok(({EN:english,JP:japanese,TW:zhuyin})[p.lang]);
    }
  }finally{e.dispose()}
});

test('native and WASM match island cases and Chinese typing prefixes',()=>{
  const rows=baseline.rows,requests=rows.map(r=>({version:1,op:'decode',input:r.raw,options:r.options}));
  const p=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});
  assert.equal(p.status,0,p.stderr);
  const results=p.stdout.trim().split('\n').map(s=>JSON.parse(s).ok),e=createEngine();
  try{requests.forEach((r,i)=>assert.deepEqual(normalize(e.decode(r.input,r.options)),normalize(results[i]),rows[i].id))}finally{e.dispose()}
  assert.ok(islandCases.length>60);
});

test('doubled n before y: Colemak dljjo;i should commit しんよう',{todo:'Separate user-reported romaji issue, deferred'},()=>{
  const e=createEngine();
  try{assert.equal(e.commitCandidate(e.decode('dljjo;i',{layout:'colemak',english:false,zhuyin:false})[0]),'しんよう')}
  finally{e.dispose()}
});
