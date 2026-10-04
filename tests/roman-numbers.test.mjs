import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine} from '../web/engine.mjs';
import {cases,guardCases,ambiguityCases} from '../eval/roman-number-cases.mjs';
import {correctionEdits} from '../scripts/correction-metrics.mjs';

test('Roman-context integers, models and times retain literal numbers',()=>{
  const engine=createEngine();
  try {
    for(const row of guardCases.filter(row=>!['decimal','version'].includes(row.category)&&row.sourceId!=='roman-number-mixed-revision'))
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
  } finally {engine.dispose()}
});

test('Roman-context dotted numbers retain their intended literal text',{todo:true},()=>{
  const engine=createEngine();
  try {
    for(const row of guardCases.filter(row=>['decimal','version'].includes(row.category)||row.sourceId==='roman-number-mixed-revision'))
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
  } finally {engine.dispose()}
});

test('Digit-only Chinese after Roman context remains rank two and takes one correction',()=>{
  const engine=createEngine();
  try {
    for(const row of ambiguityCases) {
      const outputs=engine.decode(row.raw,row.options).map(candidate=>engine.commitCandidate(candidate));
      assert.equal(outputs.indexOf(row.text)+1,2,row.id);
      assert.equal(correctionEdits(engine,row,{maxDepth:1}).edits,1,row.id);
    }
  } finally {engine.dispose()}
});

for(const sourceId of ['roman-ambiguity-pc','roman-ambiguity-soccer','roman-ambiguity-hk'])
  test(`${sourceId}: Chinese top-one interpretation is a known numeric ambiguity`,{todo:true},()=>{
    const engine=createEngine();
    try {
      for(const row of ambiguityCases.filter(row=>row.sourceId===sourceId))
        assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
    } finally {engine.dispose()}
  });

test('Roman-context numeric and ambiguity probes agree in native and WASM',()=>{
  const engine=createEngine(),requests=[],expected=[];
  try {
    for(const row of cases)for(const constraints of [undefined,[]]) {
      requests.push({version:1,op:'decode',input:row.raw,options:row.options,...(constraints?{constraints}:{})});
      expected.push(constraints?engine.decodeConstrained(row.raw,constraints,row.options):engine.decode(row.raw,row.options));
    }
    const native=spawnSync('target/debug/polytype-json',[],{
      input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:32e6,
    });
    assert.equal(native.status,0,native.stderr||native.error?.message);
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e9)/1e9:v));
    assert.deepEqual(normalize(native.stdout.trim().split('\n').map(line=>JSON.parse(line).ok)),normalize(expected));
  } finally {engine.dispose()}
});
