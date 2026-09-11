import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';

const root=new URL('../',import.meta.url);
const rows=readFileSync(new URL('data/sources/mozc/romanji-hiragana.tsv',root),'utf8').trimEnd().split('\n').map(line=>line.split('\t'));
const normalize=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='score'?Math.round(x*1e9)/1e9:x));

test('pinned upstream Mozc assets are unmodified; every table rule preserves output and carry',()=>{
  const manifest=JSON.parse(readFileSync(new URL('data/japanese-source.json',root)));
  for(const source of manifest.sources){
    const file=source.path.split('/').at(-1);
    assert.equal(createHash('sha256').update(readFileSync(new URL('data/sources/mozc/'+file,root))).digest('hex'),source.sha256,file);
  }
  const e=createEngine();
  try{
    for(const [raw,kana,pending=''] of rows){
      const c=e.composeJapanese(raw,{final:true});
      assert.ok(c,raw);assert.equal(c.kana,kana,raw);assert.equal(c.pending,pending,raw);
    }
    for(const [raw,text] of [['mma','っま'],['lla','っぁ'],['www','www'],['wwwa','wっわ'],['xka','ヵ'],['xn','ん'],['kwi','くぃ'],["t'yu",'てゅ'],['hello','へっぉ']]){
      assert.equal(e.composeJapanese(raw,{final:true}).text,text,raw);
    }
  }finally{e.dispose()}
});

test('kanji lookup uses the reading, without the tokyo demo alias; distinct n commits survive',()=>{
  const e=createEngine();
  try{
    for(const layout of ['qwerty','colemak']){
      const decode=(roman,english=false)=>e.decode(layout==='colemak'?e.encode(roman):roman,{layout,english,zhuyin:false});
      for(const [spellings,target] of [[['nihongo','nihonngo',"nihon'go"],'日本語'],[['toukyou','toukilyou'],'東京'],[['tiisai','chiisai'],'小さい']]){
        for(const raw of spellings)assert.ok(decode(raw).some(c=>e.commitCandidate(c)===target),raw);
      }
      for(const english of [false,true]){
        const c=decode('tokyo',english);
        assert.ok(!c.some(c=>e.commitCandidate(c)==='東京'));
        const n=decode('n',english).map(c=>e.commitCandidate(c));
        assert.ok(n.includes('ん'));assert.ok(n.includes('ン'));
        if(english)assert.ok(n.includes('n'));
      }
    }
  }finally{e.dispose()}
});

test('Mozc rule prefixes have native/WASM parity and backspace replay restores composition',()=>{
  const inputs=[...new Set(rows.flatMap(([key])=>Array.from({length:key.length+1},(_,i)=>key.slice(0,i))))];
  const requests=inputs.flatMap(input=>[false,true].map(final=>({version:1,op:'composeJapanese',input,final})));
  const e=createEngine();
  try{
    const sequence=[['m','m'],['mm','っm'],['mma','っま'],['x','x'],['xk','xk'],['xka','ヵ'],['w','w'],['ww','っw'],['www','www'],['wwwa','wっわ']];
    for(const [raw,text] of [...sequence,...sequence.toReversed()])assert.equal(e.composeJapanese(raw).text,text,raw);
    const expected=requests.map(r=>e.composeJapanese(r.input,{final:r.final}));
    const p=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:8e6});
    assert.equal(p.status,0,p.stderr);
    assert.deepEqual(p.stdout.trim().split('\n').map(s=>JSON.parse(s).ok),expected);
    for(const raw of ['nihonngo','toukyou','mma','www','n']){
      const options={layout:'qwerty'};
      const p=spawnSync('target/debug/polytype-json',[],{input:JSON.stringify({version:1,op:'decode',input:raw,options})+'\n',encoding:'utf8'});
      assert.equal(p.status,0,p.stderr);
      assert.deepEqual(normalize(JSON.parse(p.stdout).ok),normalize(e.decode(raw,options)));
    }
  }finally{e.dispose()}
});
