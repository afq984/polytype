import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine,colemak} from '../web/engine.mjs';
import {zhEnCorpus,englishOnlyCorpus,zhEnCases,englishOnlyCases,zhEnSkipped,generateZhEnCases} from '../eval/zh-en-cases.mjs';
import {parseCsv,maximalMatch,taiwanConverter,cedictDictionary,annotate,pinyinToZhuyin} from '../scripts/zh-en-annotation.mjs';
const root=new URL('../',import.meta.url);

test('checked-in development data and notices match offline hashes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('eval/zh-en/manifest.json',root)));
  for(const file of manifest.files) {
    const bytes=readFileSync(new URL(file.path,root));
    assert.equal(bytes.length,file.bytes,file.path);
    assert.ok(bytes.length<1_000_000,file.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
  }
  const review=JSON.parse(readFileSync(new URL('eval/zh-en/review.json',root)));
  const pending=new Set(review.issues.map(i=>i.id));
  const ids=new Set();
  for(const entry of zhEnCorpus.cases) {
    assert.ok(!ids.has(entry.id));ids.add(entry.id);
    assert.equal(entry.review,pending.has(entry.id)?'pending':'automatic',entry.id);
    assert.equal(entry.segments.map(s=>s.text).join(''),entry.text);
    for(const segment of entry.segments.filter(s=>s.lang==='zh')) {
      if(segment.reading)assert.equal(segment.reading.split(' ').length,[...segment.text].length,entry.id);
      assert.equal(segment.evidence.map(e=>e.text).join(''),segment.text);
    }
  }
  assert.equal(zhEnCorpus.cases.filter(e=>e.kind==='mixed').length,300);
  assert.equal(zhEnCorpus.cases.filter(e=>e.kind==='zh-only').length,50);
  assert.equal(englishOnlyCorpus.cases.length,200);
  assert.equal(zhEnCases.length,(350-zhEnSkipped.length)*8);
  assert.equal(englishOnlyCases.length,400);
  assert.deepEqual(generateZhEnCases(zhEnCorpus.cases),zhEnCases);
});

test('Space contracts distinguish first-tone switches and retain literal spaces',()=>{
  const rows=generateZhEnCases([{id:'tone',segments:[{lang:'zh',text:'剛',reading:'ㄍㄤ'},{lang:'en',text:'call'}]}]);
  const current=rows.find(r=>r.contract==='current'&&r.options.layout==='qwerty');
  const target=rows.find(r=>r.contract==='target'&&r.options.layout==='qwerty');
  assert.equal(current.raw,'e;  call');assert.equal(current.text,'剛 call');
  assert.equal(target.raw,'e; call');assert.equal(target.text,'剛call');
  const fourth=generateZhEnCases([{id:'fourth',segments:[{lang:'en',text:'Python '},{lang:'zh',text:'用',reading:'ㄩㄥˋ'},{lang:'en',text:' call'}]}]);
  for(const row of fourth) {
    assert.equal(row.text,'Python 用 call');
    if(row.options.layout==='qwerty')assert.equal(row.raw,'Python m/4 call');
  }
  const additional=generateZhEnCases([{id:'spaces',segments:[{lang:'zh',text:'剛',reading:'ㄍㄤ'},{lang:'en',text:'  call'}]}]);
  assert.equal(additional.find(r=>r.contract==='current').text,'剛  call');
  assert.equal(additional.find(r=>r.contract==='target').text,'剛 call');
  assert.ok(generateZhEnCases([{id:'unknown',segments:[{lang:'zh',text:'字',reading:null}]}]).length===0);
  assert.ok(generateZhEnCases([{id:'tone',segments:[{lang:'zh',text:'剛',reading:'ㄍㄤ'},{lang:'en',text:'call'}]}],{spacing:'normalized'}).every(r=>r.text==='剛call'));
  for(const row of englishOnlyCases)assert.equal(row.options.layout==='colemak'?colemak(row.raw):row.raw,row.text,row.id);
});

test('annotation uses maximal match, Taiwan evidence and independent readings',()=>{
  assert.deepEqual(parseCsv('id,text\r\n1,"hi, ""friend"""\r\n'),[{id:'1',text:'hi, "friend"'}]);
  assert.deepEqual(maximalMatch(new Map([['甲',['a']],['甲乙',['b']]]))('甲乙丙').map(s=>s.value),[['b'],null]);
  for(const [pinyin,reading] of [['yong4','ㄩㄥˋ'],['zhong1','ㄓㄨㄥ'],['shi4','ㄕˋ'],['xue2','ㄒㄩㄝˊ'],['gui1','ㄍㄨㄟ'],['nü3','ㄋㄩˇ'],['you3','ㄧㄡˇ'],['de5','ㄉㄜ˙']])assert.equal(pinyinToZhuyin(pinyin),reading);
  assert.equal(pinyinToZhuyin('ng2'),null);
  const inputs={'opencc-STPhrases.txt':'头发\t頭髮\n','opencc-STCharacters.txt':'头\t頭\n发\t發 髮\n软\t軟\n','opencc-TWPhrasesIT.txt':'軟件\t軟體\n','opencc-TWPhrasesName.txt':'','opencc-TWPhrasesOther.txt':'','opencc-TWVariants.txt':'裏\t裡\n'};
  const convert=taiwanConverter(inputs);
  assert.equal(convert('头发软件裏').text,'頭髮軟體裡');
  assert.equal(convert('发').doubts[0].kind,'conversion-alternatives');
  const map=cedictDictionary('角色 角色 [jue2 se4] /role/Taiwan pr. [jiao3se4]/\n角 角 [jiao3] /angle/\n角 角 [jue2] /role/\n',convert);
  const accepted=new Map([['角',new Set(['ㄐㄩㄝˊ'])],['色',new Set(['ㄙㄜˋ'])]]);
  const phrase=annotate('角色',map,accepted);
  assert.equal(phrase.reading,'ㄐㄧㄠˇ ㄙㄜˋ');
  assert.equal(phrase.evidence[0].chosen,'jiao3se4');
  assert.equal(phrase.issues[0].kind,'dictionary-disagreement');
  assert.equal(annotate('角',map,accepted).issues[0].kind,'polyphone-no-word-evidence');
  assert.equal(annotate('字',map,accepted).reading,null);
  assert.equal(annotate('字',map,accepted).issues[0].kind,'unmapped');
});

test('every generated development case decodes without error with native/WASM parity',()=>{
  const cases=[...zhEnCases,...englishOnlyCases];
  const native=fileURLToPath(new URL('../target/debug/polytype-json',import.meta.url));
  const requests=cases.map(c=>({version:1,op:'decode',input:c.raw,options:c.options}));
  const child=spawnSync(native,[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:256*1024*1024});
  assert.equal(child.status,0,child.stderr||child.error?.message);
  const results=child.stdout.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(results.length,cases.length);
  const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e10)/1e10:v));
  const engine=createEngine();
  try {
    for(const [index,row] of cases.entries()) {
      assert.ok(row.raw.length<=400,row.id);
      const candidates=engine.decode(row.raw,row.options);
      assert.ok(candidates.length,row.id);
      assert.ok(!results[index].error,`${row.id}: ${results[index].error}`);
      assert.deepEqual(normalize(results[index].ok),normalize(candidates),row.id);
      for(const candidate of candidates)assert.equal(typeof engine.commitCandidate(candidate),'string');
    }
  } finally {engine.dispose();}
});
