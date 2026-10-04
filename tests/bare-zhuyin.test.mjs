import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,rankingId} from '../web/engine.mjs';

const engine=createEngine(),requests=[];
const decode=(raw,options)=>{
 requests.push({version:1,op:'decode',input:raw,options});
 return engine.decode(raw,options);
};

test('Space completes unsupported lone initials as bare Zhuyin; a second Space stays literal',()=>{
 assert.ok(rankingId.includes('+bare-zhuyin-v1'));
 for(const layout of ['qwerty','colemak']){
  const options={layout,english:false,japanese:false};
  for(const [key,text] of [['1','ㄅ'],['2','ㄉ'],['a','ㄇ'],['c','ㄏ']]){
   const pending=decode(key,options)[0],complete=decode(key+' ',options)[0];
   assert.equal(pending.text,text);assert.equal(pending.parts[0].complete,false);
   assert.equal(complete.text,text);assert.equal(complete.parts[0].complete,true);
   assert.equal(complete.parts[0].raw,key+' ');assert.equal(complete.parts[0].lang,'TW');
   assert.equal(complete.score,pending.score); // No new evidence or ranking boost.
   assert.equal(decode(key+'  ',options)[0].text,text+' ');
   for(const tone of ['6','3','4','7'])assert.equal(decode(key+tone,options)[0].text,engine.zhuyin(key+tone));
  }
  assert.equal(decode('c c ',options)[0].text,'ㄏㄏ');
  assert.equal(decode('cc ',options)[0].text,'ㄏ'); // Same-category repeat remains one slot.
  assert.equal(decode('1q ',options)[0].text,'ㄆ'); // Category replacement survives.
  assert.equal(decode('1m ',options)[0].text,'ㄅㄩˉ'); // Unsupported full syllable stays phonetic.
 }
});

test('bare chat initials stay top one inside Chinese without changing first-tone boundaries',()=>{
 const stem=engine.readingKeys('ㄏㄞˊ ㄎㄜˇ ㄧˇ').join('');
 const next=engine.readingKeys('ㄅㄨˋ ㄍㄨㄛˋ').join('');
 for(const layout of ['qwerty','colemak']){
  assert.equal(decode(stem+'1  '+next,{layout})[0].text,'還可以ㄅ 不過');
  assert.equal(decode(stem+'c c  '+next,{layout})[0].text,'還可以ㄏㄏ 不過');
  const english=layout==='colemak'?engine.encode('hello'):'hello';
  assert.equal(decode(stem+'1  '+english,{layout})[0].text,'還可以ㄅ hello');
  const firstTone=decode('5j/ ',{layout})[0];
  assert.equal(firstTone.text,'中');assert.equal(firstTone.parts[0].raw,'5j/ ');
  assert.equal(decode('5j/  '+english,{layout})[0].text,'中 hello');
 }
});

test('dictionary readings and ordinary English retain precedence over bare initials',()=>{
 for(const layout of ['qwerty','colemak']){
  for(const raw of ['5 ', 'g6', '/j5 ', 'sujo/5 ', 'm/4']){
   const top=decode(raw,{layout})[0];
   assert.ok(!top.text.includes('ˉ'),raw);
   assert.ok(!top.parts.some(p=>p.note.includes('bare Zhuyin')),raw);
  }
  for(const text of ['a ', 'for ', 'had ', 'hello world']){
   const raw=layout==='colemak'?engine.encode(text):text;
   assert.equal(decode(raw,{layout})[0].text,text);
  }
 }
 const custom=createEngine();
 try{
  custom.setCustomEntries([{reading:'ㄅ',text:'吧'}]);
  assert.equal(custom.decode('1 ',{english:false,japanese:false})[0].text,'吧');
  assert.equal(custom.decode('1  ',{english:false,japanese:false})[0].text,'吧 ');
  assert.equal(decode('1 ',{english:false,japanese:false})[0].text,'ㄅ');
 }finally{custom.dispose()}
});

test('bare fallbacks and numeric literals cannot create a Chinese quote boundary',()=>{
 for(const layout of ['qwerty','colemak']){
  const text='a "hello"',raw=layout==='colemak'?engine.encode(text):text;
  assert.equal(decode(raw,{layout})[0].text,text);
  // With English enabled this unsupported digit-only reading now has numeric
  // evidence; every Space belongs to the literal numeric interpretation.
  assert.equal(decode('1  <',{layout,japanese:false})[0].text,'1  <');
  const parts=decode('1  ?',{layout,english:false,japanese:false})[0].parts;
  assert.equal(parts.map(p=>p.text).join(''),'ㄅ ?');
 }
});

test('prototype and native ablation preserve first-tone-mark fallback',()=>{
 const prototype=createEngine({dictionary:'prototype'});
 try{assert.equal(prototype.decode('1 ',{english:false,japanese:false})[0].text,'ㄅˉ')}
 finally{prototype.dispose()}
 const request=JSON.stringify({raw:'1 ',options:{english:false,japanese:false},width:12})+'\n';
 const result=spawnSync('target/release/polytype-search',['--experiment=current+no-bare-zhuyin'],{input:request,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).ok.candidates[0].text,'ㄅˉ');
});

test('native and WASM match bare initials, explicit tones, replacements and Chinese chat',()=>{
 const result=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});
 assert.equal(result.status,0,result.stderr);
 const native=result.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
 const normalize=v=>JSON.parse(JSON.stringify(v,(k,v)=>k==='score'?Math.round(v*1e9)/1e9:v));
 assert.equal(native.length,requests.length);
 requests.forEach((r,i)=>assert.deepEqual(normalize(engine.decode(r.input,r.options)),normalize(native[i]),r.input));
 engine.dispose();
});
