import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine,examplesForLayout,physicalKey,encode} from '../web/engine.mjs';
import {kanaLevel} from '../eval/cases.mjs';

test('code punctuation cannot erase the literal-English path',()=>{
 const engine=createEngine();
 try {
  for(const layout of ['colemak','qwerty'])for(const text of ['for (int i = 0; i < 100; i++)','x += 1;','a < b && b > c','hello @world']) {
   const raw=layout==='colemak'?encode(text):text;
   for(let i=1;i<=raw.length;i++) {
    const candidates=engine.decode(raw.slice(0,i),{layout});
    assert.ok(candidates.some(c=>c.text===text.slice(0,i)),`${layout} prefix ${i}: ${text}`);
   }
   if(text.startsWith('for ('))assert.equal(engine.decode(raw,{layout})[0].text,text);
  }
 }finally{engine.dispose()}
});

test('layout and language options constrain the core before ranking',()=>{
 const engine=createEngine();
 try {
  assert.equal(engine.decode('hello',{layout:'qwerty',japanese:false,zhuyin:false})[0].text,'hello');
  assert.equal(engine.decode('gakkou',{layout:'qwerty',english:false,zhuyin:false})[0].text,'学校');
  assert.equal(kanaLevel(engine.decode('gakkou',{layout:'qwerty',english:false,zhuyin:false})[0]),'がっこう');
  assert.equal(engine.decode('us3lc3',{layout:'qwerty',english:false,japanese:false})[0].text,'你好');
  assert.equal(engine.decode('gakkou us3lc3 hello',{layout:'qwerty'})[0].text,'学校 你好 hello');
  assert.deepEqual(engine.decode('hello',{layout:'qwerty',english:false,japanese:false,zhuyin:false}),[]);
  // Mozc's ll rule makes this valid kana, even though English usually wins.
  assert.equal(engine.decode('hello',{layout:'qwerty',english:false,zhuyin:false})[0].text,'へっぉ');
  assert.equal(engine.decode('flldal')[0].text,'小さい'); // options do not leak
  for(const options of [{layout:'dvorak'},{english:'false'},{typo:true},null]) {
   assert.throws(()=>engine.decode('hello',options));
  }
  const requests=[];
  for(const layout of ['colemak','qwerty'])for(let mask=0;mask<8;mask++) {
   const options={layout,english:!!(mask&1),japanese:!!(mask&2),zhuyin:!!(mask&4)};
   for(const input of ['', 'hello', 'gakkou us3lc3 hello', "5j4up 's", 'sujo/5 ', 'Hello: this is a test.', 'for (int i = 0; i < 100; i++)',encode('for (int i = 0; i < 100; i++)')]) {
    requests.push({version:1,op:'decode',input,options});
    for(const candidate of engine.decode(input,options))for(const part of candidate.parts) {
     const enabled={EN:options.english,JP:options.japanese,TW:options.zhuyin};
     if(part.lang in enabled)assert.equal(enabled[part.lang],true,JSON.stringify({input,options,part}));
    }
   }
  }
  const native=spawnSync(fileURLToPath(new URL('../target/debug/polytype-json',import.meta.url)),[],{
   input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:8*1024*1024,
  });
  assert.equal(native.status,0,native.stderr);
  const results=native.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
  const normalize=v=>JSON.parse(JSON.stringify(v,(k,v)=>k==='score'?Math.round(v*1e10)/1e10:v));
  assert.equal(results.length,requests.length);
  requests.forEach((r,i)=>assert.deepEqual(normalize(engine.decode(r.input,r.options)),normalize(results[i])));
 }finally{engine.dispose()}
});

test('examples and shifted physical keys respect the selected roman layout',()=>{
 const engine=createEngine();
 try {
  for(const layout of ['colemak','qwerty']) {
   const examples=examplesForLayout(layout);
   assert.equal(examples.length,13);
   assert.equal(engine.decode(examples[0].raw,{layout})[0].text,'小さい 的英文是 small');
   assert.equal(engine.decode(examples.find(e=>e.name==='Kana + Chinese + English').raw,{layout})[0].text,'学校 你好 hello');
   assert.equal(engine.decode(examples.at(-1).raw,{layout})[0].text,'資料庫 hello');
  }
  assert.equal(physicalKey({code:'KeyP',shiftKey:true},'qwerty'),'P');
  assert.equal(physicalKey({code:'KeyP',shiftKey:true},'colemak'),':');
  assert.equal(physicalKey({code:'Semicolon',shiftKey:true},'qwerty'),':');
  assert.equal(physicalKey({code:'KeyP',getModifierState:()=>true},'qwerty'),'P');
 }finally{engine.dispose()}
});
