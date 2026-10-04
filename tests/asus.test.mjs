import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';
import {cases,inContractCases,correctionCases,outOfContractCases} from '../eval/asus-cases.mjs';

const failures=new Set(['asus-pc-ban','asus-pc-first-tone','asus-zhi']);

test('ASUS-inspired passing targets preserve literal spaces in both typing contracts',()=>{
  const engine=createEngine();
  try {
    for(const row of inContractCases.filter(row=>!failures.has(row.sourceId))) {
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
    }
    for(const layout of ['qwerty','colemak'])for(const japanese of [false,true]) {
      const rows=inContractCases.filter(row=>row.sourceId==='asus-call-first-tone'&&row.options.layout===layout&&row.options.japanese===japanese);
      const current=rows.find(row=>row.contract==='current'),target=rows.find(row=>row.contract==='target');
      assert.equal(current.text,'剛 call 你');
      assert.equal(target.text,'剛call 你');
      assert.equal(current.raw,'e; '+target.raw.slice(2));
      const attached=outOfContractCases.find(row=>row.sourceId==='asus-attached-call-ni'&&row.options.layout===layout&&row.options.japanese===japanese);
      assert.equal(attached.text,'call你');
      assert.equal(attached.raw.includes(' '),false);
      assert.equal(attached.scope,'out-of-contract');
    }
  } finally {engine.dispose()}
});

// Preserve intended targets as visible failures. Do not freeze today's digits
// or homophone errors as the desired behavior, or demand no-Space switching.
for(const sourceId of failures)test(`${sourceId}: intended top-one target remains unresolved`,{todo:true},()=>{
  const engine=createEngine();
  try {
    for(const row of inContractCases.filter(row=>row.sourceId===sourceId))
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
  } finally {engine.dispose()}
});

test('ASUS-inspired cases and bare-1 reinterpretation agree in native and WASM',()=>{
  const engine=createEngine(),requests=[],expected=[];
  const query=(op,input,options,constraints,fields={})=>{
    const value=op==='decode'?constraints?engine.decodeConstrained(input,constraints,options):engine.decode(input,options)
      :engine.alternatives(input,fields,options,constraints);
    requests.push({version:1,op,input,options,...(constraints?{constraints}:{}),...fields});
    expected.push(value);return value;
  };
  try {
    for(const row of cases) {
      const candidates=query('decode',row.raw,row.options);
      assert.deepEqual(query('decode',row.raw,row.options,[]),candidates,row.id);
    }
    for(const row of correctionCases) {
      const span={start:0,end:1};
      const page=query('alternatives',row.raw,row.options,[],span);
      const digit=page.actions.find(choice=>choice.lang==='EN'&&choice.commitText==='1');
      assert.ok(digit,row.id);
      const locks=[digit.constraint];
      assert.equal(engine.commitCandidate(query('decode',row.raw,row.options,locks)[0]),'1');
      const lockedMenu=query('alternatives',row.raw,row.options,locks,span);
      const phonetic=lockedMenu.items.find(choice=>choice.lang==='TW'&&choice.commitText==='ㄅ');
      assert.ok(phonetic,row.id);
      assert.equal(engine.commitCandidate(query('decode',row.raw,row.options,[phonetic.constraint])[0]),'ㄅ');
    }
    const native=spawnSync('target/debug/polytype-json',[],{
      input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:32e6,
    });
    assert.equal(native.status,0,native.stderr||native.error?.message);
    const results=native.stdout.trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(results.length,expected.length);
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e9)/1e9:v));
    results.forEach((result,index)=>assert.deepEqual(normalize(result.ok),normalize(expected[index]),JSON.stringify(requests[index])));
  } finally {engine.dispose()}
});
