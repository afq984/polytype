import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,readingKeys,encode,rankingId} from '../web/engine.mjs';
import {cases,numericSentences,chineseControls} from '../eval/numbers-cases.mjs';

test('numeric development annotations cover the declared contracts and layouts',()=>{
  assert.equal(numericSentences.length,144);
  assert.equal(chineseControls.length,48);
  assert.equal(cases.length,1536);
  assert.equal(new Set(cases.map(row=>row.id)).size,cases.length);
  for(const entry of [...numericSentences,...chineseControls]){
    const rows=cases.filter(row=>row.sourceId===entry.id);
    assert.equal(rows.length,8,entry.id);
    for(const segment of entry.segments.filter(s=>s.lang==='zh')){
      assert.equal(segment.reading.split(/\s+/).length,[...segment.text].length,entry.id);
    }
    for(const row of rows){
      assert.ok(row.raw.length<=400,row.id);
      assert.equal(row.provenance,'hand-authored synthetic development');
    }
  }
});

const engine=createEngine(),requests=[];
const decode=(raw,options)=>{
  requests.push({version:1,op:'decode',input:raw,options});
  return engine.decode(raw,options);
};
const roman=(text,layout)=>layout==='qwerty'?text:encode(text);

test('numbers and identifiers survive literal and converted first-tone boundaries',()=>{
  assert.ok(rankingId.endsWith('+numbers-v1'));
  for(const layout of ['qwerty','colemak'])for(const japanese of [false,true]){
    const options={layout,japanese};
    for(const token of ['15','17','2025','5090','x3','v3','Q3','M2','3.8-27B','+0.3','-2.5','70%','11:25','1/2','v1.5','NT$120','11/']){
      const nonFirst=readingKeys('ㄋㄧˇ ㄏㄠˇ').join('');
      assert.equal(decode(nonFirst+' '+roman(token,layout),options)[0].text,'你好 '+token,`${layout}: ${token}`);
      const first=readingKeys('ㄍㄤ').join('');
      for(const spaces of ['',' ','  '])assert.equal(decode(first+spaces+roman(token,layout),options)[0].text,'剛'+spaces+token);
      assert.equal(decode(first+roman(token,layout)+' '+readingKeys('ㄋㄧˇ').join(''),options)[0].text,'剛'+token+' 你');
    }
  }
});

test('clean digit-key Chinese continuations keep their dictionary evidence',()=>{
  for(const layout of ['qwerty','colemak'])for(const [reading,text] of [
    ['ㄢ','安'],['ㄅㄚ','八'],['ㄉㄚ','搭'],['ㄓ','之'],['ㄞˋ','愛'],
  ])assert.equal(decode(readingKeys(reading).join(''),{layout})[0].text,text);
  for(const layout of ['qwerty','colemak']){
    const raw=readingKeys('ㄒㄧㄣ ㄉㄧㄢˋ ㄊㄨˊ').join('');
    const candidates=decode(raw,{layout});
    assert.ok(candidates.some(c=>c.text==='心電圖'));
    assert.ok(!candidates.some(c=>c.parts.some(p=>p.lang==='TW')&&c.parts.some(p=>p.lang==='EN'&&p.raw==='2u04wj6')));
    assert.deepEqual(engine.decodeConstrained(raw,[],{layout}),candidates);
    const lock={start:0,end:4,lang:'TW',text:'心'};
    assert.equal(engine.decodeConstrained(raw,[lock],{layout})[0].text,'心電圖');
  }
});

test('numeric punctuation respects colon context and disabled languages',()=>{
  for(const layout of ['qwerty','colemak']){
    const chinese=readingKeys('ㄋㄧˇ ㄏㄠˇ').join('');
    assert.equal(decode(chinese+':',{layout})[0].text,'你好：');
    assert.equal(decode(chinese+' '+roman('11:25',layout),{layout})[0].text,'你好 11:25');
    const raw=chinese+' '+roman('x3',layout);
    assert.ok(!decode(raw,{layout,english:false}).some(c=>c.parts.some(p=>p.lang==='EN')));
    const first=readingKeys('ㄍㄤ').join('');
    const constrained=engine.decodeConstrained(first+roman('v3',layout),[{start:first.length,end:first.length+2,lang:'EN',text:'v3'}],{layout});
    assert.equal(constrained[0].text,'剛v3');
  }
});

test('per-engine custom conversions supply Chinese evidence for digit keys',()=>{
  const custom=createEngine();
  try{
    custom.setCustomEntries([{reading:'ㄅ˙',text:'自訂'}]);
    for(const layout of ['qwerty','colemak']){
      assert.equal(custom.decode('17 ',{layout})[0].text,'自訂 ');
      assert.equal(decode('17 ',{layout})[0].text,'17 ');
    }
  }finally{custom.dispose()}
});

test('native/WASM numeric traces agree and empty locks preserve ordinary decode',()=>{
  // The full development set exercises more shapes than the focused assertions.
  for(const row of cases){
    const candidates=decode(row.raw,row.options);
    assert.deepEqual(engine.decodeConstrained(row.raw,[],row.options),candidates,row.id);
  }
  const native=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});
  assert.equal(native.status,0,native.stderr);
  const results=native.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
  const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e9)/1e9:v));
  assert.equal(results.length,requests.length);
  requests.forEach((r,i)=>assert.deepEqual(normalize(results[i]),normalize(engine.decode(r.input,r.options)),r.input));
  const child=spawnSync('target/release/polytype-search',['--experiment=current+no-numbers'],{input:JSON.stringify({raw:readingKeys('ㄋㄧˇ ㄏㄠˇ').join('')+' x3',options:{layout:'qwerty'},width:12})+'\n',encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  assert.equal(JSON.parse(child.stdout).ok.candidates[0].text,'你好 ㄌˇ');
  engine.dispose();
});
