import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,physicalKey} from '../web/engine.mjs';
import {numericProbes} from '../eval/punctuation-cases.mjs';
import {encodeMixedInput} from '../eval/cases.mjs';

const map=[['<','，'],['>','。'],['?','？'],['!','！'],[':','：'],["'",'、'],['"','；'],['[','「'],[']','」'],['{','『'],['}','』'],['(','（'],[')','）']];
const requests=[];
const engine=createEngine();
const decode=(raw,options)=>{
  requests.push({version:1,op:'decode',input:raw,options});
  return engine.decode(raw,options);
};

test('Chinese punctuation prefers the standard map and keeps ASCII in both layouts',()=>{
  for(const layout of ['qwerty','colemak'])for(const [key,full] of map){
    for(const english of [true,false]){
      const options={layout,english,japanese:english};
      for(const space of ['', ' ', '  ']){
        const stem='你好'+space,candidates=decode('us3lc3'+space+key,options);
        assert.equal(engine.commitCandidate(candidates[0]),stem+full,`${layout} ${key}`);
        assert.ok(candidates.some(c=>engine.commitCandidate(c)===stem+key),`${layout}: ${key} selectable`);
      }
    }
  }
  for(const raw of ['/j5 <','/j5  <']){
    assert.equal(decode(raw,{layout:'qwerty'})[0].text,raw==='/j5 <'?'中，':'中 ，');
  }
  assert.equal(decode('us3lc3[us3lc3]',{layout:'qwerty'})[0].text,'你好「你好」');
  assert.equal(decode('us3lc3{us3lc3}',{layout:'qwerty'})[0].text,'你好『你好』');
});

test('Chinese punctuation context survives consecutive physical and pasted full-width marks',()=>{
  const stem=engine.readingKeys('ㄌㄜ˙').join('');
  for(const layout of ['qwerty','colemak'])for(const tail of ['(?','（?','（？','?)','？)','？）']){
    const expected='了'+tail.replaceAll('(','（').replaceAll(')','）').replaceAll('?','？');
    assert.equal(decode(stem+tail,{layout})[0].text,expected,`${layout}: ${tail}`);
  }
});

test('existing Roman punctuation preferences remain, with mapped alternatives',()=>{
  for(const layout of ['qwerty','colemak'])for(const [key,full] of map){
    const encode=text=>layout==='qwerty'?text:engine.encode(text);
    for(const [prefix,stem,options] of [
      ['', '', {layout,english:true,japanese:false,zhuyin:false}],
      [encode('hello '), 'hello ', {layout}],
      [encode('gakkou '), '学校 ', {layout}],
    ]){
      const candidates=decode(prefix+encode(key),options);
      // Mozc already prefers corner quotes here; preserve its table behavior.
      const mozcBracket=prefix&&['[',']'].includes(key);
      assert.equal(engine.commitCandidate(candidates[0]),stem+(mozcBracket?full:key),`${layout} ${prefix} ${key}`);
      assert.ok(candidates.some(c=>engine.commitCandidate(c)===stem+key),`${layout} ${prefix}: ASCII selectable`);
      assert.ok(candidates.some(c=>engine.commitCandidate(c)===stem+full),`${layout} ${prefix}: ${full} selectable`);
    }
  }
});

test('Japanese bracket preferences match the existing Mozc table in both layouts',()=>{
  for(const layout of ['qwerty','colemak']){
    const encode=text=>layout==='qwerty'?text:engine.encode(text);
    for(const [input,expected] of [['gakkou [','学校 「'],['gakkou ]','学校 」'],['hello[','へっぉ「']]){
      assert.equal(engine.commitCandidate(decode(encode(input),{layout})[0]),expected,`${layout} ${input}`);
    }
  }
});

test('a completed unconverted Zhuyin reading cannot turn quoted English into Chinese',()=>{
  for(const layout of ['qwerty','colemak']){
    const encode=text=>layout==='qwerty'?text:encodeMixedInput(text);
    for(const text of ['The question is, "Should he have known it was coming?"', 'The answer is, "Yes!"']){
      const candidates=decode(encode(text),{layout});
      assert.equal(engine.commitCandidate(candidates[0]),text,`${layout}: ${text}`);
      assert.ok(!candidates.some(c=>c.parts.some(p=>p.lang==='TW')),`${layout}: no unsupported Zhuyin escape`);
    }
  }
  // The dictionary may deliberately convert to literal phonetic text. Preserve
  // that per-engine custom conversion as context; do not gate on Han script.
  const custom=createEngine();
  try {
    custom.setCustomEntries([{reading:'ㄋㄝ',text:'ㄋㄝ'}]);
    assert.equal(custom.decode(custom.readingKeys('ㄋㄝ').join('')+'<',{layout:'qwerty',english:false,japanese:false})[0].text,'ㄋㄝ，');
  } finally {custom.dispose()}
});

test('code guards, contractions and romaji apostrophes keep ASCII',()=>{
  for(const layout of ['qwerty','colemak']){
    const encode=text=>layout==='qwerty'?text:engine.encode(text);
    for(const text of ['for (int i = 0; i < 100; i++)', 'hello world!', 'hello: world', "don't", 'hello < world > hello', 'hello [world]', 'hello {world}', 'hello "world"']){
      const raw=encode(text),candidates=decode(raw,{layout});
      assert.equal(engine.commitCandidate(candidates[0]),text,`${layout} ${text}`);
      for(let i=1;i<=raw.length;i++)assert.ok(decode(raw.slice(0,i),{layout}).some(c=>engine.commitCandidate(c)===text.slice(0,i)),`${layout} literal prefix ${i}`);
    }
    assert.equal(decode('us3lc3'+encode("'s priority"),{layout})[0].text,"你好's priority");
    assert.equal(decode('us3lc3 '+encode('hello!'),{layout})[0].text,'你好 hello!');
    assert.equal(decode(encode('hello ')+'us3lc3!',{layout})[0].text,'hello 你好！');
    const jp=decode(encode("shin'you"),{layout,english:false,zhuyin:false});
    assert.equal(engine.commitCandidate(jp[0]),'信用');
  }
});

test('non-BMP literal text cannot alias a punctuation key through truncation',()=>{
  for(const unit of ['<','>','?',':']){
    const raw='hello'+String.fromCodePoint(0x10000+unit.charCodeAt(0));
    const candidates=decode(raw,{layout:'qwerty',japanese:false,zhuyin:false});
    assert.equal(candidates.length,1);
    assert.equal(engine.commitCandidate(candidates[0]),raw);
  }
});

test('physical keys already produce every mapped punctuation key in both layouts',()=>{
  const positions=[['Comma','<',true],['Period','>',true],['Slash','?',true],['Digit1','!',true],['Digit9','(',true],['Digit0',')',true],['Semicolon',':',true],['Quote',"'",false],['Quote','"',true],['BracketLeft','[',false],['BracketRight',']',false],['BracketLeft','{',true],['BracketRight','}',true]];
  for(const layout of ['qwerty','colemak'])for(const [code,key,shiftKey] of positions)assert.equal(physicalKey({code,shiftKey},layout),key);
  assert.equal(physicalKey({code:'KeyP',shiftKey:true},'colemak'),'P');
});

test('the policy ablation reproduces pre-punctuation behavior with current dictionaries',()=>{
  const raw='us3lc3?',options={layout:'qwerty'};
  const run=(name,input=raw)=>{
    const request=JSON.stringify({raw:input,options,width:12})+'\n';
    const p=spawnSync('target/release/polytype-search',['--experiment='+name],{input:request,encoding:'utf8'});
    assert.equal(p.status,0,p.stderr);
    return JSON.parse(p.stdout).ok.candidates;
  };
  const normalize=value=>JSON.parse(JSON.stringify(value,(k,v)=>k==='score'?Math.round(v*1e9)/1e9:v));
  assert.deepEqual(normalize(run('current')),normalize(engine.decode(raw,options)));
  const legacy=run('current+no-punctuation');
  assert.equal(legacy[0].text,'你好?');
  assert.ok(!legacy.some(c=>c.text==='你好？'));
  const oldParentheses=run('current+no-parentheses','us3lc3(');
  assert.equal(oldParentheses[0].text,'你好(');
  assert.ok(!oldParentheses.some(c=>c.text==='你好（'));
});

test('native and WASM match punctuation, numbers and every code prefix in both layouts',()=>{
  numericProbes.forEach(row=>decode(row.raw,row.options));
  const child=spawnSync('target/debug/polytype-json',[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});
  assert.equal(child.status,0,child.stderr);
  const native=child.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
  const normalize=value=>JSON.parse(JSON.stringify(value,(k,v)=>k==='score'?Math.round(v*1e9)/1e9:v));
  assert.equal(native.length,requests.length);
  requests.forEach((r,i)=>assert.deepEqual(normalize(engine.decode(r.input,r.options)),normalize(native[i]),`${r.options.layout}: ${r.input}`));
  engine.dispose();
});
