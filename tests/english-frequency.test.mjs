import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createEngine,rankingId} from '../web/engine.mjs';

test('English frequency import pins ranks, vocabulary, morphology and bundled license',()=>{
  const root=new URL('../',import.meta.url), read=path=>readFileSync(new URL(path,root));
  const manifest=JSON.parse(read('data/english-frequency-source.json'));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const data=read('data/english-frequency.bin');
  assert.equal(hash(data),manifest.sha256);
  assert.equal(data.length,manifest.bytes);
  assert.ok(data.length<150000);
  assert.equal(hash(read('data/english.tsv')),manifest.vocabulary.sha256);
  const vocabulary=read('data/english.tsv').toString().trimEnd().split('\n').map(row=>row.split('\t')[0]);
  assert.equal(data.subarray(0,4).toString(),'EFR1');
  assert.equal(data.readUInt32LE(4),vocabulary.length);
  assert.equal(data.readUInt32LE(8),manifest.entries);
  assert.equal(data[12],manifest.format.rankBits);
  assert.equal(data[12],17);
  assert.deepEqual([...data.subarray(13,16)],[0,0,0]);
  const rankStart=16+Math.ceil(vocabulary.length/8),ranks=new Map();
  assert.equal(data.length,rankStart+Math.ceil(manifest.entries*17/8));
  let index=0;
  for (const [wordIndex,word] of vocabulary.entries()) {
    if (!(data[16+(wordIndex>>3)]&(1<<(wordIndex&7)))) continue;
    const bit=index++*17,byte=rankStart+(bit>>3);
    const rank=((data[byte]|(data[byte+1]<<8)|(data[byte+2]<<16))>>>(bit&7))&0x1ffff;
    assert.ok(rank>0 && rank<=manifest.format.maxRank,word);
    ranks.set(word,rank);
  }
  assert.equal(index,manifest.entries);
  // Compare every decoded integer against the importer's pre-packing rank join.
  const canonical=[...ranks].map(([word,rank])=>`${word}\t${rank}\n`).join('');
  assert.equal(hash(canonical),manifest.ranksSha256);
  assert.equal(manifest.ranksSha256,'ba664b6ae7640c466e73f8861dde3640e5e63e3dd951530eac6c5519e86a42b2');
  assert.equal(vocabulary.length-ranks.size,manifest.counts.unranked);
  assert.equal(Object.values(manifest.counts).reduce((a,b)=>a+b,0),vocabulary.length);
  assert.equal(manifest.fallbackRank,200000);
  // Upstream headword rank versus the documented discounted inflection estimate.
  assert.equal(ranks.get('be'),2);
  assert.equal(ranks.get('is'),4);
  assert.equal(ranks.get('was'),4);
  const license=read('data/sources/ecdict/LICENSE');
  assert.equal(hash(license),manifest.inputs.find(input=>input.path==='LICENSE').sha256);
  assert.ok(read('web/dictionary-notices.txt').includes(license));
  assert.ok(!read('scripts/import-english-frequency.mjs').toString().includes('../eval/'));
});

test('frequency evidence preserves uppercase-O words, homographs and constrained English scores',()=>{
  assert.ok(rankingId.includes('+en-freq-v1'));
  const engine=createEngine(),requests=[],expected=[];
  const decode=(input,options,constraints)=>{
    const candidates=constraints?engine.decodeConstrained(input,constraints,options):engine.decode(input,options);
    requests.push({version:1,op:'decode',input,options,...(constraints?{constraints}:{})});
    expected.push(candidates);
    return candidates;
  };
  try {
    for (const layout of ['qwerty','colemak']) {
      const roman=text=>layout==='colemak'?engine.encode(text):text;
      const options={layout};
      for (const word of ['OK','OE','OD','OQ','OM']) {
        const raw=engine.readingKeys('ㄋㄧˇ ㄏㄠˇ').join('')+' '+roman(word);
        assert.equal(decode(raw,options)[0].text,'你好 '+word);
      }
      for (const word of ['sake','hi','me']) assert.equal(decode(roman(word),options)[0].text,word);
      const stem=engine.readingKeys('ㄍㄤ').join(''),raw=stem+roman('call');
      const ordinary=decode(raw,options).find(candidate=>candidate.text==='剛call');
      const locked=decode(raw,options,[{start:0,end:stem.length,text:'剛',lang:'TW'},{start:stem.length,end:raw.length,text:'call',lang:'EN'}])[0];
      assert.equal(locked.text,'剛call');
      assert.ok(Math.abs(ordinary.score-locked.score)<1e-9);
      const en={layout,japanese:false,zhuyin:false};
      assert.equal(decode(roman('the'),en)[0].score,6);
      assert.ok(decode(roman('adz'),en)[0].score<6,'rare SCOWL spelling has less evidence than common the');
    }
    const child=spawnSync('target/debug/polytype-json',[],{input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:16e6});
    assert.equal(child.status,0,child.stderr);
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,value)=>key==='score'?Math.round(value*1e9)/1e9:value));
    const results=child.stdout.trim().split('\n').map(line=>JSON.parse(line).ok);
    assert.deepEqual(normalize(results),normalize(expected));
  } finally {engine.dispose()}
});

test('remembered English words override frequency and Japanese context while explicit choices and engine isolation survive',()=>{
  const engine=createEngine(),other=createEngine(),requests=[],expected=[];
  const query=(op,fields)=>{
    const value=op==='setCustomEnglishEntries'?engine.setCustomEnglishEntries(fields.entries)
      :op==='setCustomEntries'?engine.setCustomEntries(fields.entries)
      :fields.constraints?engine.decodeConstrained(fields.input,fields.constraints,fields.options)
      :engine.decode(fields.input,fields.options);
    requests.push({version:1,op,...fields});expected.push(value);return value;
  };
  try {
    for (const layout of ['qwerty','colemak']) {
      const roman=text=>layout==='colemak'?engine.encode(text):text,options={layout};
      const input=roman('kore ha sushi desu');
      const before=engine.decode(input,options);
      assert.equal(before[0].text,'これ は 寿司 です');
      query('setCustomEnglishEntries',{entries:['sushi']});
      assert.equal(query('decode',{input,options})[0].text,'これ は sushi です');
      assert.deepEqual(other.decode(input,options),before);
      query('setCustomEntries',{entries:[{reading:'ㄗㄞˋ',text:'載'}]});
      assert.equal(query('decode',{input,options})[0].text,'これ は sushi です');
      const raw=roman('sushi');
      assert.equal(query('decode',{input:raw,options,constraints:[{start:0,end:raw.length,text:'寿司',lang:'JP'}]})[0].text,'寿司');
      assert.throws(()=>engine.setCustomEnglishEntries(['sushi','two words']));
      assert.equal(query('decode',{input,options})[0].text,'これ は sushi です');
      const first=engine.readingKeys('ㄍㄤ').join('');
      assert.equal(query('decode',{input:first+raw,options})[0].text,'剛sushi');
      assert.deepEqual(query('decode',{input:'1 '+raw,options,constraints:[{start:0,end:2,text:'ㄅ',lang:'TW'},{start:2,end:2+raw.length,text:'sushi',lang:'EN'}]}),[],'remembered English cannot escape unsupported first-tone Zhuyin');
      query('setCustomEnglishEntries',{entries:[]});
      query('setCustomEntries',{entries:[]});
      assert.deepEqual(query('decode',{input,options}),before);
    }
    const child=spawnSync('target/debug/polytype-json',[],{input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:16e6});
    assert.equal(child.status,0,child.stderr);
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,value)=>key==='score'?Math.round(value*1e9)/1e9:value));
    assert.deepEqual(normalize(child.stdout.trim().split('\n').map(line=>JSON.parse(line).ok)),normalize(expected));
  } finally {engine.dispose();other.dispose()}
});
