import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine,colemak} from '../web/engine.mjs';
import {zhEnCorpus,englishOnlyCorpus,zhEnCases,englishOnlyCases,zhEnSkipped,generateZhEnCases} from '../eval/zh-en-cases.mjs';
import {summarizeZhEnCases,renderZhEnSummary} from '../scripts/zh-en-summary.mjs';
import {validateAdjudications,applyAdjudications,applyPositionalReadings,applyTypingConventions,conventionIssues} from '../scripts/zh-en-adjudication.mjs';
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
  const pending=new Set(review.issues.filter(i=>!i.adjudication).map(i=>i.id));
  const reviewed=new Set(review.issues.map(i=>i.id));
  const ids=new Set();
  for(const entry of zhEnCorpus.cases) {
    assert.ok(!ids.has(entry.id));ids.add(entry.id);
    assert.equal(entry.review,pending.has(entry.id)?'pending':reviewed.has(entry.id)?'model-reviewed':'automatic',entry.id);
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

test('positional adjudications reproduce all reviewed annotations and reject stale or unknown decisions',()=>{
  const data=JSON.parse(readFileSync(new URL('eval/zh-en/adjudications.json',root)));
  const queue=JSON.parse(readFileSync(new URL('eval/zh-en/review.json',root))).issues;
  const ids=new Set(zhEnCorpus.cases.map(c=>c.id));
  validateAdjudications(data,ids);
  let applied=0;
  for(const entry of zhEnCorpus.cases) {
    const issues=queue.filter(i=>i.id===entry.id).map(({id,adjudication,...issue})=>issue);
    const segments=entry.segments.map(({provisionalText,provisionalReading,modelReading,citationReading,...s})=>({...s,
      text:provisionalText??s.text,...(s.lang==='zh'?{reading:provisionalReading??modelReading??citationReading??s.reading}:{}),
      ...(s.evidence?{evidence:s.evidence.map(({adjudicatedReading,coordinatorReading,typingReading,provisionalText,...e})=>({...e,text:provisionalText??e.text}))}:{}),
    }));
    const provisional={id:entry.id,text:segments.map(s=>s.text).join(''),segments,review:issues.length?'pending':'automatic'};
    const actual=applyAdjudications(provisional,issues,data);
    assert.deepEqual(actual,applyAdjudications(provisional,issues,data),entry.id);
    assert.deepEqual(actual.entry.segments,entry.segments,entry.id);
    assert.equal(actual.entry.text,entry.text,entry.id);
    assert.equal(actual.entry.review,entry.review,entry.id);
    assert.deepEqual(actual.entry.reviewedBy,entry.reviewedBy,entry.id);
    assert.deepEqual(actual.entry.typingAdjudications,entry.typingAdjudications,entry.id);
    assert.deepEqual(actual.entry.positionalAdjudications,entry.positionalAdjudications,entry.id);
    assert.equal(actual.issues.filter(i=>i.adjudication).length,issues.length,entry.id);
    applied+=issues.length;
    if(issues.length) {
      const partial=structuredClone(data);partial.cases[entry.id]=partial.cases[entry.id].slice(1);
      assert.equal(applyAdjudications(provisional,issues,partial).entry.review,'pending');
      const stale=structuredClone(data);stale.cases[entry.id][0].character+='字';
      assert.throws(()=>applyAdjudications(provisional,issues,stale),/Stale character/);
    }
  }
  assert.equal(applied,Object.values(data.cases).flat().length);
  const malformed=structuredClone(data);malformed.extra=true;
  assert.throws(()=>validateAdjudications(malformed,ids),/Unknown adjudication key/);
  const unknown=structuredClone(data);unknown.cases.unknown=[];
  assert.throws(()=>validateAdjudications(unknown,ids),/Unknown case key/);
  const first=Object.keys(data.cases)[0];
  for(const key of ['unknown','confirmed']) {
    const invalid=structuredClone(data);invalid.cases[first][0][key]=true;
    assert.throws(()=>validateAdjudications(invalid,ids),/Unknown decision key/);
  }
  const duplicate=structuredClone(data);duplicate.cases[first].push(duplicate.cases[first][0]);
  assert.throws(()=>validateAdjudications(duplicate,ids),/duplicate issue/);
  const sample=zhEnCorpus.cases.find(c=>c.id===first);
  const missing=structuredClone(data);missing.cases[first][0].issue=99999;
  assert.throws(()=>applyAdjudications(sample,queue.filter(i=>i.id===first),missing),/Unknown flagged issue/);
  for(const entry of zhEnCorpus.cases)for(const segment of entry.segments.filter(s=>s.lang==='zh')) {
    for(const [index,character] of [...segment.text].entries())if(character==='一'||character==='不')assert.equal(segment.reading.split(' ')[index],character==='一'?'ㄧ':'ㄅㄨˋ',entry.id);
  }
});

test('owner typing conventions preserve citation evidence and record every corrected position',()=>{
  const data=JSON.parse(readFileSync(new URL('eval/zh-en/adjudications.json',root)));
  const conventions=data.typingConventions;
  const entry={id:'owner',text:'多少 很多玩亞洲',review:'automatic',segments:[
    {lang:'zh',text:'多少',reading:'ㄉㄨㄛ ㄕㄠˇ',evidence:[{text:'多少',offset:0,chosen:'duo1 shao3'}]},
    {lang:'en',text:' '},
    {lang:'zh',text:'很多玩亞洲',reading:'ㄏㄣˇ ㄉㄨㄛˊ ㄨㄢˋ ㄧㄚˋ ㄓㄡ',evidence:[{text:'很',offset:0},{text:'多',offset:1},{text:'玩',offset:2},{text:'亞洲',offset:3}]},
  ]};
  const before=structuredClone(entry),after=applyTypingConventions(entry,conventions);
  assert.deepEqual(entry,before);
  assert.deepEqual(after.segments[0],before.segments[0],'already-confirmed readings retain their evidence');
  assert.equal(after.segments[2].reading,'ㄏㄣˇ ㄉㄨㄛ ㄨㄢˊ ㄧㄚˇ ㄓㄡ');
  assert.equal(after.segments[2].citationReading,before.segments[2].reading);
  assert.equal(after.segments[2].evidence[3].typingReading,'ㄧㄚˇ ㄓㄡ');
  assert.equal(after.review,'automatic','a typed-reading decision does not review a whole utterance');
  assert.deepEqual(after.typingAdjudications.map(d=>[d.segment,d.offset,d.character,d.from,d.reading,d.reviewer,d.date]),[
    [2,1,'多','ㄉㄨㄛˊ','ㄉㄨㄛ','user','2026-10-04'],
    [2,2,'玩','ㄨㄢˋ','ㄨㄢˊ','user','2026-10-04'],
    [2,3,'亞','ㄧㄚˋ','ㄧㄚˇ','user','2026-10-04'],
  ]);
  assert.deepEqual(applyTypingConventions(after,conventions),after);
  const counts={多:0,玩:0,亞:0,和:0,差:0};
  for(const row of zhEnCorpus.cases)for(const decision of row.typingAdjudications??[]) {
    const s=row.segments[decision.segment];
    assert.equal([...s.text][decision.offset],decision.character,row.id);
    assert.equal(s.citationReading.split(' ')[decision.offset],decision.from,row.id);
    assert.equal(s.reading.split(' ')[decision.offset],decision.reading,row.id);
    assert.equal(decision.reviewer,'user');assert.equal(decision.date,'2026-10-04');
    assert.ok(decision.reason.trim());counts[decision.character]++;
  }
  assert.deepEqual(counts,{多:20,玩:4,亞:1,和:1,差:1});
  for(const row of zhEnCorpus.cases)for(const s of row.segments.filter(s=>s.lang==='zh'))for(const [i,c] of [...s.text].entries()) {
    const evidence=s.evidence.find(e=>e.offset<=i&&e.offset+[...e.text].length>i);
    const convention=conventions.find(convention=>convention.character===c&&(!convention.word||convention.word===evidence?.text));
    if(convention)assert.notEqual(s.reading.split(' ')[i],convention.from,row.id);
  }
  for(const mutation of [c=>c.reviewer='model',c=>c.date='2026-10-00',c=>c.reason='',c=>c.reading=c.from,c=>c.extra=true]) {
    const invalid=structuredClone(data);mutation(invalid.typingConventions[0]);
    assert.throws(()=>validateAdjudications(invalid,new Set(zhEnCorpus.cases.map(c=>c.id))));
  }
  const duplicate=structuredClone(data);duplicate.typingConventions.push(duplicate.typingConventions[0]);
  assert.throws(()=>validateAdjudications(duplicate,new Set(zhEnCorpus.cases.map(c=>c.id))),/Duplicate typing/);
});

test('owner word scopes preserve other 和 and 差 compounds',()=>{
  const data=JSON.parse(readFileSync(new URL('eval/zh-en/adjudications.json',root)));
  const entry={id:'scopes',segments:[{lang:'zh',text:'和平和差不多差異',reading:'ㄏㄜˊ ㄆㄧㄥˊ ㄏㄜˊ ㄔㄚˋ ㄅㄨˋ ㄉㄨㄛ ㄔㄚˋ ㄧˋ',evidence:[{text:'和平',offset:0},{text:'和',offset:2},{text:'差不多',offset:3},{text:'差異',offset:6}]}]};
  const after=applyTypingConventions(entry,data.typingConventions);
  assert.equal(after.segments[0].reading,'ㄏㄜˊ ㄆㄧㄥˊ ㄏㄢˋ ㄔㄚ ㄅㄨˋ ㄉㄨㄛ ㄔㄚˋ ㄧˋ');
  assert.deepEqual(after.typingAdjudications.map(d=>d.offset),[2,3]);
  assert.equal(entry.segments[0].reading,'ㄏㄜˊ ㄆㄧㄥˊ ㄏㄜˊ ㄔㄚˋ ㄅㄨˋ ㄉㄨㄛ ㄔㄚˋ ㄧˋ');
  const invalid=structuredClone(data);invalid.typingConventions.at(-1).word='其他';
  assert.throws(()=>validateAdjudications(invalid,new Set(zhEnCorpus.cases.map(c=>c.id))),/word scope/);
});

test('coordinator word-boundary decisions retain model evidence and reject stale positions',()=>{
  const data=JSON.parse(readFileSync(new URL('eval/zh-en/adjudications.json',root))),ids=new Set(zhEnCorpus.cases.map(c=>c.id));
  let count=0;
  for(const [id,decisions] of Object.entries(data.positionalReadings)) {
    const entry=zhEnCorpus.cases.find(c=>c.id===id),before=structuredClone(entry);
    delete before.positionalAdjudications;
    for(const s of before.segments)if(s.modelReading) {
      s.reading=s.modelReading;delete s.modelReading;
      for(const e of s.evidence)delete e.coordinatorReading;
    }
    const original=structuredClone(before),after=applyPositionalReadings(before,decisions);
    assert.deepEqual(before,original);assert.deepEqual(after,entry);
    assert.throws(()=>applyPositionalReadings(after,decisions),/Stale positional reading/);
    for(const d of after.positionalAdjudications) {
      assert.equal(d.reviewer,'coordinator');assert.equal(d.date,'2026-10-04');assert.equal(d.reason,'utterance word boundary');
      assert.equal(after.segments[d.segment].modelReading.split(' ')[d.offset],d.from);
      assert.equal(after.segments[d.segment].reading.split(' ')[d.offset],d.reading);count++;
    }
    const stale=structuredClone(decisions);stale[0].word+='字';
    assert.throws(()=>applyPositionalReadings(before,stale),/Stale positional word/);
    const reading=structuredClone(decisions);reading[0].from='ㄅㄚ';
    assert.throws(()=>applyPositionalReadings(before,reading),/Stale positional reading/);
  }
  assert.equal(count,3);
  for(const mutate of [d=>d.reviewer='user',d=>d.offset=-1,d=>d.reason='',d=>d.reading=d.from,d=>d.extra=true]) {
    const invalid=structuredClone(data);mutate(invalid.positionalReadings['ascend-test-0378'][0]);assert.throws(()=>validateAdjudications(invalid,ids));
  }
  const unknown=structuredClone(data);unknown.positionalReadings.unknown=unknown.positionalReadings['ascend-test-0378'];
  assert.throws(()=>validateAdjudications(unknown,ids),/Unknown positional case/);
  const duplicate=structuredClone(data);duplicate.positionalReadings['ascend-test-0378'].push(duplicate.positionalReadings['ascend-test-0378'][0]);
  assert.throws(()=>validateAdjudications(duplicate,ids),/Duplicate positional/);
});

test('review enforces conversion positions, consistent overlapping readings and full-tone compound flags',()=>{
  const entry={id:'case',text:'念個',segments:[{lang:'zh',text:'念個',reading:'ㄋㄧㄢˋ ㄍㄜ˙',evidence:[{text:'念',offset:0},{text:'個',offset:1}]}]};
  const issues=[{kind:'conversion-alternatives',stage:0,offset:0,character:'念',candidates:['念','唸']},...conventionIssues(entry.segments,[])];
  const conversion={issue:0,kind:'conversion-alternatives',stage:0,offset:0,character:'念',conversion:'唸',reason:'Study',confidence:'high'};
  const reading={issue:1,kind:'lexical-neutral-tone',segment:0,offset:1,character:'個',reading:'ㄍㄜˋ',reason:'Full citation',confidence:'high'};
  const data={cases:{case:[conversion,reading]}};
  assert.equal(applyAdjudications(entry,issues,data).entry.text,'唸個');
  assert.equal(applyAdjudications(entry,issues,data).entry.segments[0].reading,'ㄋㄧㄢˋ ㄍㄜˋ');
  assert.equal(entry.text,'念個');
  assert.throws(()=>applyAdjudications(entry,issues,{cases:{case:[{...conversion,conversion:'唸書'}]}}),/Invalid conversion decision/);
  assert.throws(()=>applyAdjudications(entry,issues,{cases:{case:[{...reading,reading:'bad'}]}}),/Invalid reading decision/);
  assert.throws(()=>applyAdjudications(entry,issues,{cases:{case:[{...reading,reading:'ㄍㄜˋ ㄍㄜˋ'}]}}),/Reading length mismatch/);
  const duplicateIssue={...issues[1],kind:'dictionary-disagreement'};
  assert.throws(()=>applyAdjudications(entry,[...issues,duplicateIssue],{cases:{case:[reading,{...reading,issue:2,kind:duplicateIssue.kind,reading:'ㄍㄜ'}]}}),/Conflicting readings/);
  const inputs={'opencc-STPhrases.txt':'','opencc-STCharacters.txt':'念\t念 唸\n','opencc-TWPhrasesIT.txt':'','opencc-TWPhrasesName.txt':'','opencc-TWPhrasesOther.txt':'','opencc-TWVariants.txt':''};
  const doubts=taiwanConverter(inputs)('I念念').doubts;
  assert.deepEqual(doubts.map(i=>i.offset),[1,2]);
  const collapsed=taiwanConverter({...inputs,'opencc-STCharacters.txt':'吃\t喫 吃\n','opencc-TWVariants.txt':'喫\t吃\n'})('吃').doubts[0];
  assert.deepEqual(collapsed.candidates,['喫','吃']);
  assert.deepEqual(collapsed.outputCandidates,['吃','吃']);
  const meal={id:'meal',text:'吃',segments:[{lang:'zh',text:'吃',reading:'ㄔ',evidence:[{text:'吃',offset:0}]}]};
  const choice={...conversion,character:'吃',conversion:'吃'};
  assert.equal(applyAdjudications(meal,[collapsed],{cases:{meal:[choice]}}).entry.text,'吃');
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
  const engine=createEngine(),outputs=new Map();
  try {
    for(const [index,row] of cases.entries()) {
      assert.ok(row.raw.length<=400,row.id);
      const candidates=engine.decode(row.raw,row.options);
      assert.ok(candidates.length,row.id);
      assert.ok(!results[index].error,`${row.id}: ${results[index].error}`);
      assert.deepEqual(normalize(results[index].ok),normalize(candidates),row.id);
      const committed=candidates.map(candidate=>engine.commitCandidate(candidate));
      for(const text of committed)assert.equal(typeof text,'string');
      outputs.set(row.id,committed);
    }
  } finally {engine.dispose();}
  const summary=summarizeZhEnCases(cases,entry=>outputs.get(entry.id));
  assert.equal(summary.cases,3200);assert.equal(summary.sourceCases,550);
  assert.equal(renderZhEnSummary(summary,{skippedUnmapped:zhEnSkipped.length}),readFileSync(new URL('eval/zh-en/REPORT.md',root),'utf8'));
  for(const strata of Object.values(summary.groups)) {
    assert.equal(strata.all.cases,strata['review-pending'].cases+strata['model-reviewed'].cases+strata.automatic.cases);
    for(const metric of ['top1','top5','spaceNormalizedTop1','spaceNormalizedTop5','englishMatches','englishTokens','hanEdits','hanCharacters','wrongLanguageCases','singleLanguageCases'])assert.equal(strata.all[metric],strata['review-pending'][metric]+strata['model-reviewed'][metric]+strata.automatic[metric]);
  }
});


test('summary separates review strata and uses boundary-only normalization',()=>{
  const entries=[
    {id:'pending',group:'mixed',review:'pending',text:'剛 call one two'},
    {id:'automatic',group:'mixed',review:'automatic',text:'剛 call'},
    {id:'reviewed',group:'mixed',review:'model-reviewed',text:'人 call'},
    {id:'english',group:'en-only',text:'hello world'},
  ];
  const outputs={pending:['剛call one  two','剛 call one two'],automatic:['剛call'],reviewed:['人 call'],english:['hello 中']};
  const summary=summarizeZhEnCases(entries,entry=>outputs[entry.id]);
  const mixed=summary.groups.mixed;
  assert.equal(mixed.all.cases,3);assert.equal(mixed.all.top1,1);assert.equal(mixed.all.top5,2);
  assert.equal(mixed.all.spaceNormalizedTop1,2);assert.equal(mixed.all.spaceNormalizedTop5,3);
  assert.equal(mixed['review-pending'].spaceNormalizedTop1,0);assert.equal(mixed['review-pending'].spaceNormalizedTop5,1);
  assert.equal(mixed['model-reviewed'].cases,1);assert.equal(mixed['model-reviewed'].top1,1);
  assert.throws(()=>summarizeZhEnCases([{group:'x',review:'confirmed',text:'x'}],()=>['x']),/Unknown review status/);
  assert.equal(mixed.automatic.spaceNormalizedTop1,1);assert.equal(mixed.all.englishExact,1);
  assert.equal(mixed.all.hanCER,0);assert.equal(mixed.all.wrongLanguage,null);
  const english=summary.groups['en-only'];
  assert.equal(english.automatic.cases,1);assert.equal(english.all.englishExact,0.5);
  assert.equal(english.all.wrongLanguage,1);assert.equal(english.all.hanCER,null);
  assert.equal(english['review-pending'].cases,0);
  for(const key of ['englishExact','hanCER','wrongLanguage'])assert.equal(english['review-pending'][key],null);
  assert.deepEqual(summarizeZhEnCases([...entries].reverse(),entry=>outputs[entry.id]),summary);
  const markdown=renderZhEnSummary(summary);
  assert.ok(markdown.includes('n/a (0/0)'));
  for(const entry of entries)assert.ok(!markdown.includes(entry.text));
  assert.ok(!JSON.stringify(summary).includes('hello world'));
});
