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
const decode=(raw,options,constraints)=>{
  requests.push({version:1,op:'decode',input:raw,options,...(constraints?{constraints}:{})});
  return constraints?engine.decodeConstrained(raw,constraints,options):engine.decode(raw,options);
};
const roman=(text,layout)=>layout==='qwerty'?text:encode(text);

test('numbers and identifiers survive literal and converted first-tone boundaries',()=>{
  assert.ok(rankingId.endsWith('+numbers-v2'));
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

test('clean unfinished Zhuyin keeps its display and a lower numeric alternative',()=>{
  for(const layout of ['qwerty','colemak'])for(const japanese of [false,true]){
    const options={layout,japanese};
    const first=readingKeys('ㄍㄤ').join('');
    const nonFirst=readingKeys('ㄋㄧˇ ㄏㄠˇ').join('');
    for(const [prefix,text] of [['5','ㄓ'],['5j','ㄓㄨ'],['5j/','ㄓㄨㄥ'],['wu0','ㄊㄧㄢ'],['ru8','ㄐㄧㄚ'],['1','ㄅ']]){
      // These are physical Zhuyin keys in both layouts, not Roman strings.
      const literal=layout==='colemak'?engine.colemak(prefix):prefix;
      for(const [stem,converted] of [['',''],[nonFirst+' ','你好 '],[first,'剛'],[first+' ','剛 ']]){
        const raw=stem+prefix,candidates=decode(raw,options);
        assert.equal(candidates[0].text,converted+text,`${layout}: ${raw}`);
        assert.ok(candidates.slice(1).some(c=>c.text===converted+literal),`${layout}: lower alternative ${raw}`);
        assert.deepEqual(engine.decodeConstrained(raw,[],options),candidates);
      }
      assert.equal(decode(prefix,{...options,zhuyin:false})[0].text,literal);
    }
    // Unordered slots are clean; replacements, repeated slots and an invalid
    // complete syllable can still supply the stronger numeric interpretation.
    assert.equal(decode('/j5',options)[0].text,'ㄓㄨㄥ');
    assert.equal(decode('104wu',options)[0].text,'辦ㄊㄧ');
    assert.equal(decode('5.',options)[0].text,'ㄓㄡ');
    for(const token of ['15','17','2025','11','rj8'])assert.equal(decode(roman(token,layout),options)[0].text,token);
    // Completion by punctuation/Space enables numeric evidence, subject to
    // the existing dictionary guard: a valid first tone still becomes Chinese.
    assert.equal(decode(roman('5:',layout),options)[0].text,'5:');
    assert.equal(decode('5 ',options)[0].text,'之');
    assert.equal(decode('1 ',options)[0].text,'1 ');
    const locked=decode(first+'wu0',options,[{start:first.length,end:first.length+3,lang:'EN',text:layout==='colemak'?'wl0':'wu0'}]);
    assert.equal(locked[0].text,layout==='colemak'?'剛wl0':'剛wu0');
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
  requests.forEach((r,i)=>assert.deepEqual(normalize(results[i]),normalize(r.constraints?engine.decodeConstrained(r.input,r.constraints,r.options):engine.decode(r.input,r.options)),r.input));
  const child=spawnSync('target/release/polytype-search',['--experiment=current+no-numbers'],{input:JSON.stringify({raw:readingKeys('ㄋㄧˇ ㄏㄠˇ').join('')+' x3',options:{layout:'qwerty'},width:12})+'\n',encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  assert.equal(JSON.parse(child.stdout).ok.candidates[0].text,'你好 ㄌˇ');
  engine.dispose();
});
