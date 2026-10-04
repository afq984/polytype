import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,physicalKey,rawEncodingVersion,rankingId} from '../web/engine.mjs';
import {encodeMixedInput,kanaLevel} from '../eval/cases.mjs';

test('physical Colemak uppercase O and colon round trip with native/WASM parity',()=>{
 const engine=createEngine(),requests=[];
 try{
  assert.equal(rawEncodingVersion,2);assert.ok(rankingId.endsWith('+physical-keys-v2'));
  const rawO=physicalKey({code:'Semicolon',shiftKey:true},'colemak');
  const rawColon=physicalKey({code:'KeyP',shiftKey:true},'colemak');
  assert.equal(rawO,':');assert.equal(rawColon,'P');
  assert.equal(engine.colemak(rawO),'O');assert.equal(engine.colemak(rawColon),':');
  const ascii=Array.from({length:95},(_,i)=>String.fromCharCode(i+32)).join('');
  assert.equal(engine.colemak(engine.encode(ascii)),ascii);
  const decode=(raw,options)=>{
   requests.push({version:1,op:'decode',input:raw,options});
   return engine.decode(raw,options);
  };
  for(const layout of ['colemak','qwerty']){
   for(const text of ['TODO','OK','iOS','Ohio',"O'Neil",'MLOPS','a: b','http://','for (int i = 0; i < 100; i++)','12:30']){
    const raw=layout==='colemak'?encodeMixedInput(text):text;
    assert.equal(layout==='colemak'?engine.colemak(raw):raw,text);
    const candidates=decode(raw,{layout});
    // Existing all-language URL ambiguity stays visible; the literal is rank 2.
    assert.equal(engine.commitCandidate(candidates[text==='http://'?1:0]),text,`${layout}: ${text}`);
    assert.equal(decode(raw,{layout,japanese:false,zhuyin:false})[0].text,text);
    for(let i=1;i<=raw.length;i++)assert.ok(decode(raw.slice(0,i),{layout}).some(c=>engine.commitCandidate(c)===text.slice(0,i)),`${layout}: prefix ${i} of ${text}`);
   }
   for(const space of ['',' ','  '])assert.equal(decode('us3lc3'+space+':',{layout})[0].text,'你好'+space+'：');
   for(const text of ['TODO','OK','iOS','Ohio',"O'Neil"]){
    const raw='us3lc3 '+(layout==='colemak'?encodeMixedInput(text):text);
    assert.equal(decode(raw,{layout})[0].text,'你好 '+text);
   }
   for(const text of ['gakkou:','gakkou :']){
    const raw=layout==='colemak'?engine.encode(text):text;
    assert.equal(kanaLevel(decode(raw,{layout,english:false,zhuyin:false})[0]),text.replace('gakkou','がっこう'));
   }
  }
  const result=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});
  assert.equal(result.status,0,result.stderr);
  const native=result.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
  const normalize=v=>JSON.parse(JSON.stringify(v,(k,v)=>k==='score'?Math.round(v*1e9)/1e9:v));
  requests.forEach((r,i)=>assert.deepEqual(normalize(engine.decode(r.input,r.options)),normalize(native[i]),r.input));
 }finally{engine.dispose()}
});

test('prototype and the physical-key ablation retain historical Colemak encoding',()=>{
 const prototype=createEngine({dictionary:'prototype'});
 try{assert.equal(prototype.colemak('P:'),';:');assert.equal(prototype.encode('O:'),'O:')}
 finally{prototype.dispose()}
 const request=JSON.stringify({raw:'a: P',options:{layout:'colemak',japanese:false,zhuyin:false},width:12})+'\n';
 const result=spawnSync('target/release/polytype-search',['--experiment=current+no-physical-keys'],{input:request,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).ok.candidates[0].text,'a: ;');
});
