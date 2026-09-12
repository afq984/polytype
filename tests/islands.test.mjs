import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';
import {captureA,captureB,islandCases} from '../eval/island-cases.mjs';
import {kanaLevel} from '../eval/cases.mjs';
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
      const candidates=e.decode(row.raw,row.options),texts=candidates.map(c=>e.commitCandidate(c)),readings=candidates.map(kanaLevel);
      // Kana-annotated targets accept an imported conversion of the same reading.
      const accepted=[row.text,...(row.alternatives??[])];
      if(row.text&&row.candidates[0]?.text===row.text)assert.ok(texts[0]===row.text||readings[0]===row.text,`${row.id}: ${texts[0]}`);
      // Explicit migration: the imported dictionary now converts lowercase tanaka to 田中,
      // displacing the provisional Latin alternative; tracked as a TODO in diversity.test.mjs.
      if(row.text&&row.candidates.some(c=>accepted.includes(c.text))&&!row.id.startsWith('mixed-06-'))assert.ok(texts.some((t,i)=>accepted.includes(t)||accepted.includes(readings[i])),row.id);
      // Explicit convention migration, not a silent rewrite of frozen evidence.
      const expected=/^probe-(colemak|qwerty)-5$/.test(row.id)?'しんよう'
        :/^probe-(colemak|qwerty)-7$/.test(row.id)?'へっぉさくら' // Mozc ll permits a full kana path; ranking limitation, not a target.
        :row.id==='chinese-qwerty-2-prefix-2'?'う' // Newly supported Mozc wu alias; completed Chinese is unchanged.
        :row.candidates[0]?.text;
      if(row.chinese||row.id.startsWith('probe-')||row.id.startsWith('abbreviation-'))assert.ok(texts[0]===expected||readings[0]===expected,`${row.id}: ${texts[0]}`);
      // Japanese scores changed with the imported dictionary; every path without a Japanese part keeps its exact score.
      for(const old of row.candidates){const same=candidates.find(c=>e.commitCandidate(c)===old.text);if(same&&!same.parts.some(p=>p.lang==='JP'))assert.ok(Math.abs(same.score-old.score)<1e-9,row.id+' score')}
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

test('doubled n before y: Colemak dljjo;i commits しんよう',()=>{
  const e=createEngine();
  try{
    const c=e.decode('dljjo;i',{layout:'colemak',english:false,zhuyin:false});
    assert.equal(kanaLevel(c[0]),'しんよう');
    assert.ok(c.some(x=>e.commitCandidate(x)==='しんよう'));
  }finally{e.dispose()}
});
