import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,readingKeys} from '../web/engine.mjs';
import {encodeMixedInput} from '../eval/cases.mjs';
const engine=createEngine(),requests=[];
const decode=(raw,options)=>{requests.push({version:1,op:'decode',input:raw,options});return engine.decode(raw,options)};
const roman=(text,layout)=>layout==='qwerty'?text:encodeMixedInput(text);

test('converted first-tone Space opens Roman words, code, punctuation and romaji',()=>{
  for(const layout of ['qwerty','colemak']){
    const stem=readingKeys('ㄍㄤ').join(''),options={layout};
    for(const [word,expected] of [['call','call'],['hello','hello'],['11/','11/'],['123','123'],['v2','v2'],['JSON','JSON'],['OK','OK'],['OO','OO'],[':','：'],['/','/'],['gakkou','学校']]){
      assert.equal(engine.commitCandidate(decode(stem+roman(word,layout),options)[0]),'剛'+expected,`${layout}: ${word}`);
    }
    for(const spaces of [' ','  '])assert.equal(decode(stem+spaces+roman('call',layout),options)[0].text,'剛'+spaces+'call');
    const phrase=readingKeys('ㄨㄛˇ ㄍㄤ').join('');
    assert.equal(decode(phrase+roman('call',layout),options)[0].text,'我剛call');
    assert.equal(decode(stem+roman('call',layout)+' '+readingKeys('ㄋㄧˇ').join(''),options)[0].text,'剛call 你');
    const disabled=decode(stem+roman('gakkou',layout),{layout,japanese:false});
    assert.ok(!disabled.some(c=>c.parts.some(p=>p.lang==='JP')));
    const chineseOnly=decode(stem+roman('call',layout),{layout,english:false,japanese:false});
    assert.ok(!chineseOnly.some(c=>c.parts.some(p=>p.lang==='EN'||p.lang==='JP')));
  }
});

test('the opening cost preserves short English words and repeated-word phrases',()=>{
  for(const layout of ['qwerty','colemak'])for(const text of ['They own blogger, of course.','What if Google expanded?','i i mean many girls','This is a bug.']){
    assert.equal(decode(roman(text,layout),{layout})[0].text,text,`${layout}: ${text}`);
  }
});

test('unsupported phonetic completion and absent Space cannot open a Roman switch',()=>{
  for(const layout of ['qwerty','colemak']){
    for(const raw of [readingKeys('ㄅ').join('')+roman('call',layout),readingKeys('ㄍ').join('')+roman('call',layout),'/ '+roman('call',layout),'e;'+roman('call',layout),readingKeys('ㄨㄛˇ ㄩㄥˋ').join('')+roman('Python',layout)]){
      const candidates=decode(raw,{layout});
      assert.ok(!candidates.some(c=>c.parts.some((p,i)=>['EN','JP'].includes(p.lang)&&c.parts.slice(0,i).some(q=>q.lang==='TW'))),`${layout}: ${raw}`);
    }
  }
  // An explicit custom conversion is dictionary evidence even for this reading.
  const custom=createEngine();
  try{custom.setCustomEntries([{reading:'ㄥ',text:'自訂'}]);assert.equal(custom.decode('/ call',{layout:'qwerty'})[0].text,'自訂call')}
  finally{custom.dispose()}
});

test('native/WASM traces agree and the boundary policy has an exact main ablation',()=>{
  const input=requests.map(r=>JSON.stringify(r)).join('\n')+'\n';
  const native=spawnSync('target/debug/polytype-json',[],{input,encoding:'utf8',maxBuffer:32e6});
  assert.equal(native.status,0,native.stderr);
  const results=native.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
  const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e9)/1e9:v));
  assert.equal(results.length,requests.length);
  requests.forEach((r,i)=>assert.deepEqual(normalize(results[i]),normalize(engine.decode(r.input,r.options)),r.input));
  const raw=readingKeys('ㄍㄤ').join('')+'call',options={layout:'qwerty'};
  const child=spawnSync('target/release/polytype-search',['--experiment=current+no-tone-switch'],{input:JSON.stringify({raw,options,width:12})+'\n',encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  assert.ok(!JSON.parse(child.stdout).ok.candidates.some(c=>c.text==='剛call'));
  engine.dispose();
});
