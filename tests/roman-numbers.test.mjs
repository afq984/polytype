import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createEngine,rankingId} from '../web/engine.mjs';
import {cases,guardCases,ambiguityCases} from '../eval/roman-number-cases.mjs';
import {correctionEdits} from '../scripts/correction-metrics.mjs';

test('Roman-context integers, models and times retain literal numbers',()=>{
  const engine=createEngine();
  try {
    for(const row of guardCases.filter(row=>!['decimal','version'].includes(row.category)&&row.sourceId!=='roman-number-mixed-revision'))
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
  } finally {engine.dispose()}
});

test('Roman-context dotted numbers retain their intended literal text',()=>{
  assert.ok(rankingId.endsWith('+roman-dotted-numbers-v1'));
  const engine=createEngine();
  try {
    for(const row of guardCases.filter(row=>['decimal','version'].includes(row.category)||row.sourceId==='roman-number-mixed-revision'))
      assert.equal(engine.commitCandidate(engine.decode(row.raw,row.options)[0]),row.text,row.id);
  } finally {engine.dispose()}
});

test('Dotted numeric evidence respects explicit choices, custom entries and enabled languages',()=>{
  const engine=createEngine(),requests=[],expected=[];
  const query=(op,input,options={},constraints,fields={})=>{
    const value=op==='setCustomEntries'?engine.setCustomEntries(fields.entries)
      :op==='decode'?constraints?engine.decodeConstrained(input,constraints,options):engine.decode(input,options)
        :engine.alternatives(input,fields,options,constraints);
    requests.push({version:1,op,...(op==='setCustomEntries'?fields:{input,options,...(constraints?{constraints}:{}),...fields})});
    expected.push(value);return value;
  };
  try {
    for(const layout of ['qwerty','colemak'])for(const japanese of [false,true]) {
      const options={layout,japanese},roman=text=>layout==='colemak'?engine.encode(text):text;
      const raw=roman('release 1.03'),ordinary=query('decode',raw,options);
      assert.equal(ordinary[0].text,'release 1.03');
      const prefix=query('decode',raw,options,[{start:0,end:7,lang:'EN',text:'release'}]);
      assert.equal(prefix[0].text,ordinary[0].text);
      assert.equal(prefix[0].score,ordinary[0].score);
      const page=query('alternatives',raw,options,[],{start:8,end:raw.length});
      const chinese=page.items.find(choice=>choice.lang==='TW'&&choice.commitText==='版');
      assert.ok(chinese,'replaced-key Chinese remains an explicit choice');
      assert.equal(query('decode',raw,options,[chinese.constraint])[0].text,'release 版');
      const literal=page.actions.find(choice=>choice.lang==='EN'&&choice.commitText==='1.03');
      assert.ok(literal);
      assert.equal(query('decode',raw,options,[literal.constraint])[0].text,'release 1.03');
      assert.equal(query('decode',raw,{...options,zhuyin:false})[0].text,'release 1.03');
      assert.equal(query('decode','1.03',{...options,english:false,japanese:false})[0].text,'版');
      if(japanese)assert.equal(query('decode',roman('gakkou 1.03'),options)[0].text,'学校 1.03');
      engine.setCustomEnglishEntries(['release']);
      assert.equal(engine.decode(raw,options)[0].text,'release 1.03');
      engine.setCustomEnglishEntries([]);
    }
    query('setCustomEntries',undefined,undefined,undefined,{entries:[{reading:'ㄅㄢˇ',text:'自訂'},{reading:'ㄓㄡˇ',text:'另選'}]});
    for(const layout of ['qwerty','colemak']) {
      const roman=text=>layout==='colemak'?engine.encode(text):text;
      assert.equal(query('decode',roman('PC 1.03'),{layout})[0].text,'PC 1.03');
      assert.equal(query('decode',roman('PC 5.3'),{layout})[0].text,'PC 5.3');
    }
    const native=spawnSync('target/debug/polytype-json',[],{
      input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:32e6,
    });
    assert.equal(native.status,0,native.stderr||native.error?.message);
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e9)/1e9:v));
    assert.deepEqual(normalize(native.stdout.trim().split('\n').map(line=>JSON.parse(line).ok)),normalize(expected));
    const ablation=spawnSync('target/release/polytype-search',['--experiment=current+no-roman-dotted-numbers'],{
      input:JSON.stringify({raw:'version 1.03',options:{layout:'qwerty'},width:12})+'\n',encoding:'utf8',
    });
    assert.equal(ablation.status,0,ablation.stderr);
    assert.equal(JSON.parse(ablation.stdout).ok.candidates[0].text,'version 版');
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
