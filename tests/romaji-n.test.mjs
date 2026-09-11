import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';
import {composeJapanese as referenceCompose} from './reference/japanese.mjs';

const readings=[
  ['n','ん'],['nn','ん'],['nnn','んん'],['nnnn','んん'],
  ['na','な'],['nya','にゃ'],['nna','んあ'],['nni','んい'],['nnu','んう'],['nne','んえ'],['nno','んお'],
  ['nnya','んや'],['nnyu','んゆ'],['nnyo','んよ'],['nnna','んな'],['nnnya','んにゃ'],
  ['shinyou','しにょう'],["shin'you",'しんよう'],['shinnyou','しんよう'],['sinnyou','しんよう'],
  ['konna','こんあ'],['konnna','こんな'],["kon'na",'こんな'],
  ['konnyaku','こんやく'],['konnnyaku','こんにゃく'],['kannya','かんや'],
  ['konnichiha','こんいちは'],['konnnichiha','こんにちは'],["kon'nichiha",'こんにちは'],
  ['kanpai','かんぱい'],['kannpai','かんぱい'],['SHINNYOU','しんよう'],
];
const normalize=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='score'?Math.round(x*1e9)/1e9:x));

test('nn consumes both keys; prefixes and replayed backspaces keep only genuinely pending input',()=>{
  const e=createEngine();
  try{
    for(const [raw,expected] of readings)assert.equal(e.composeJapanese(raw,{final:true}).text,expected,raw);
    const sequence=[['s','s','s'],['sh','sh','sh'],['shi','し',''],['shin','しn','n'],['shinn','しん',''],['shinny','しんy','y'],['shinnyo','しんよ',''],['shinnyou','しんよう','']];
    for(const [raw,text,pending] of [...sequence,...sequence.toReversed()]){
      const c=e.composeJapanese(raw);assert.equal(c.text,text,raw);assert.equal(c.pending,pending,raw);
    }
    assert.equal(e.composeJapanese('konnn').text,'こんn');
    assert.equal(e.composeJapanese('konnnn').text,'こんん');
  }finally{e.dispose()}
});

test('standard kana candidates, punctuation and greeting lookup agree in both layouts',()=>{
  const e=createEngine();
  try{
    for(const layout of ['colemak','qwerty'])for(const [roman,text] of readings){
      if(roman==='SHINNYOU')continue; // Uppercase input is covered directly above.
      const raw=layout==='colemak'?e.encode(roman):roman;
      for(const suffix of ['','.',',',';',' ']){
        const input=raw+(layout==='colemak'?e.encode(suffix):suffix);
        const options={layout,english:false,japanese:true,zhuyin:false};
        const c=e.decode(input,options),commits=c.map(c=>e.commitCandidate(c));
        assert.ok(commits.includes(text+suffix),`${layout} ${roman+suffix}: hira`);
        // A lone pending n has identical display in both scripts and is already
        // deduplicated by the existing search; nn and all resolved forms differ.
        if(roman!=='n'||suffix)assert.ok(commits.includes(e.toKatakana(text)+suffix),`${layout} ${roman+suffix}: kata`);
        if(roman==='konnichiha')assert.ok(!commits.includes('こんにちは'+suffix),'no legacy lookup shortcut');
      }
    }
    assert.equal(e.commitCandidate(e.decode('dljjo;i',{layout:'colemak'})[0]),'しんよう');
    for(const spelling of ['konnnichiha',"kon'nichiha"]){
      const candidates=e.decode(spelling,{layout:'qwerty'});
      assert.equal(e.commitCandidate(candidates[0]),'こんにちは');
      assert.ok(candidates[0].parts.some(p=>p.note.endsWith('→ Japanese')),'greeting dictionary evidence preserved');
    }
  }finally{e.dispose()}
});

test('native/WASM n-convention parity, including every prefix and frozen prototype behavior',()=>{
  const prefixes=[...new Set(readings.flatMap(([raw])=>Array.from({length:raw.length+1},(_,i)=>raw.slice(0,i))))];
  for(const profile of ['expanded','prototype']){
    const e=createEngine({dictionary:profile}),requests=[],expected=[];
    try{
      for(const raw of prefixes){
        for(const final of [false,true]){
          const result=e.composeJapanese(raw,{final});
          if(profile==='prototype')assert.deepEqual(result,referenceCompose(raw,{final}),raw);
          requests.push({version:1,op:'composeJapanese',input:raw,final});expected.push(result);
        }
        for(const layout of ['colemak','qwerty']){
          const input=layout==='colemak'?e.encode(raw):raw,options={layout};
          requests.push({version:1,op:'decode',input,options});expected.push(e.decode(input,options));
        }
      }
      const p=spawnSync('target/debug/polytype-json',profile==='prototype'?['--prototype']:[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:32e6});
      assert.equal(p.status,0,p.stderr);
      const results=p.stdout.trim().split('\n').map(s=>JSON.parse(s).ok);
      assert.equal(results.length,expected.length);
      results.forEach((r,i)=>assert.deepEqual(normalize(r),normalize(expected[i]),profile+' '+JSON.stringify(requests[i])));
    }finally{e.dispose()}
  }
});
