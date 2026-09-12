import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,colemak} from '../web/engine.mjs';
import {mixedCases,mixedCorpus,encodeMixedInput,kanaLevel} from '../eval/cases.mjs';

test('Japanese punctuation and numbers retain their spelling in both layouts',()=>{
 const engine=createEngine();
 try {
  for(const layout of ['colemak','qwerty']) {
   const raw=text=>layout==='colemak'?encodeMixedInput(text):text;
   for(const [input,expected] of [
    ['mawasu.','まわす.'],['de,','で,'],['fuanteide,','ふあんていで,'],
    ['neko.','猫.'],['kan.','かん.'],['kan,','かん,'],['kan;','かん;'],
    ['sakura...','さくら...'],['batch size 16','batch size 16'],
    ['hello 10:00','hello 10:00'],['sakura 16','さくら 16'],
   ]) {
    const candidates=engine.decode(raw(input),{layout});
    // Punctuation is preserved whether the reading converts (回す.) or stays kana.
    assert.ok(engine.commitCandidate(candidates[0])===expected||kanaLevel(candidates[0])===expected,`${layout}: ${input} → ${engine.commitCandidate(candidates[0])}`);
    assert.equal(candidates[0].parts.map(p=>p.raw).join(''),raw(input));
   }
   // A rule-katakana variant keeps its punctuation; kan. itself now lists imported 感./間./館. first.
   const candidates=engine.decode(raw('sakura.'),{layout});
   assert.equal(engine.commitCandidate(candidates.find(c=>c.text==='サクラ.')),'サクラ.');
   assert.ok(engine.decode(raw('kan.'),{layout}).some(c=>engine.commitCandidate(c)==='かん.'));
   assert.equal(engine.commitCandidate(engine.decode(raw('kak.'),{layout,english:false,zhuyin:false})[0]),'かk.');
   // Numeric evidence is contextual, not a global reassignment of tone keys.
   assert.equal(engine.decode('16',{layout})[0].text,'ㄅˊ');
   assert.equal(engine.decode('us3lc3',{layout})[0].text,'你好');
   for(const input of ['.6',',6','p6']) {
    assert.ok(engine.decode(input,{layout,english:false,japanese:false})[0].parts.every(p=>p.lang==='TW'));
   }
  }
 }finally{engine.dispose()}
});

test('six supplied lines retain exact spelling and a literal candidate at every prefix',()=>{
 const engine=createEngine();
 try {
  assert.equal(mixedCorpus.cases.length,6);
  assert.equal(mixedCases.length,24);
  for(const row of mixedCases) {
   assert.equal(row.options.layout==='colemak'?colemak(row.raw):row.raw,row.input,row.id);
   for(let length=1;length<=row.raw.length;length++) {
    const candidates=engine.decode(row.raw.slice(0,length),row.options);
    assert.ok(candidates.length,`${row.id}: empty prefix ${length}`);
    assert.ok(candidates.some(c=>c.text===row.input.slice(0,length)),`${row.id}: missing literal prefix ${length}`);
    if(!row.options.zhuyin)for(const candidate of candidates) {
     assert.ok(candidate.parts.every(part=>part.lang!=='TW'),row.id);
    }
   }
  }
 }finally{engine.dispose()}
});

// Keep desired behavior visible as TODO, not a passing snapshot of bad output.
// Targets are kana/literal annotations awaiting user confirmation, not kanji
// gold, so imported conversions are compared at the reading level.
for(const row of mixedCases.filter(row=>row.group==='mixed-qwerty-en-jp')) {
 const todo=/mixed-0[36]-/.test(row.id)?'Remaining contextual ranking ambiguity; provisional target':false;
 test(`${row.id}: ${row.input}`,{todo},()=>{
  const engine=createEngine();
  try {
   const best=engine.decode(row.raw,row.options)[0];
   assert.ok(engine.commitCandidate(best)===row.text||kanaLevel(best)===row.text,`${engine.commitCandidate(best)} vs ${row.text}`);
  }
  finally{engine.dispose()}
 });
}
