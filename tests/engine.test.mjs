import test from 'node:test';
import assert from 'node:assert/strict';
import {decode,sample,readZhuyin,readingKeys,physicalKey,colemak,encode,setCustomEntries,dictionarySize} from '../web/engine.mjs';
const best=raw=>decode(raw)[0]?.text;
test('original sentence preserves exactly two literal spaces',()=>{
 assert.equal(best(sample),'小さい 的英文是 small');
 for(let i=0;i<=sample.length;i++)assert.ok(decode(sample.slice(0,i)).length,`prefix ${i}`);
});
test('user vocabulary request including first-tone spaces and punctuation',()=>{
 assert.equal(best('aj4fu06m/4fu3x96c961j6hji4 dk3u3y/ ru8 h6dj4a87?'),'目前用起來還不錯 可以增加詞庫嗎?');
 assert.equal(best('m/4'),'用');
});
test('all six initial/medial/final input orders',()=>{
 for(const keys of ['5j/','5/j','j5/','j/5','/5j','/j5'])assert.equal(best(keys+' '),'中',keys);
 assert.equal(best('us3lc3'),'你好');
});
test('last symbol of each category replaces its predecessor before tone',()=>{
 const pending=readZhuyin('sujo/5');
 assert.deepEqual(pending.slots,['5','j','/']);assert.equal(pending.changes.length,3);assert.equal(pending.complete,false);
 assert.equal(best('sujo/5 '),'中');
 assert.equal(readZhuyin('us3cl3').end,3);
 assert.equal(best('us3lc3 /j5 '),'你好 中');
});
test('Colemak OS events use physical positions; shortcuts pass through',()=>{
 const events=[['KeyF','t'],['KeyL','i'],['KeyL','i'],['KeyD','s'],['KeyA','a'],['KeyL','i']];
 const raw=events.map(([code,key])=>physicalKey({code,key})).join('');
 assert.equal(raw,'flldal');assert.equal(best(raw),'小さい');
 assert.equal(colemak(physicalKey({code:'Semicolon',key:'o'})),'o');
 for(const caps of [false,true]) {
  const event={code:'KeyP',getModifierState:()=>caps};
  assert.equal(colemak(physicalKey({...event,shiftKey:false})),';');
  assert.equal(physicalKey({...event,shiftKey:true}),':');
  assert.equal(best(physicalKey({...event,shiftKey:true})),':');
 }
 for(const event of [{code:'KeyC',ctrlKey:true},{code:'KeyC',metaKey:true},{code:'KeyC',altKey:true},{code:'KeyC',isComposing:true},{code:'ArrowLeft'}])assert.equal(physicalKey(event),null);
 assert.equal(colemak(encode('hello world')),'hello world');
});
test('custom multi-syllable entries support reordered input and atomic validation',()=>{
 try{
  setCustomEntries([{reading:'ㄎㄜ ㄐㄧˋ',text:'科技'}]);
  assert.equal(best(readingKeys('ㄎㄜ ㄐㄧˋ').join('')),'科技');assert.equal(best('kd ur4'),'科技');
  assert.throws(()=>setCustomEntries([{reading:'abc',text:'bad'}]));assert.equal(dictionarySize().custom,1);
  assert.throws(()=>readingKeys('ㄅㄆㄚ'));assert.throws(()=>readingKeys('ˋ'));
 }finally{setCustomEntries([])}
 assert.equal(dictionarySize().custom,0);
});
test('mixed-language examples and alternate Japanese candidate',()=>{
 assert.equal(best(encode('hello')+' su3cl3 '+encode('neko')),'hello 你好 猫');
 assert.ok(decode('flldal').some(x=>x.text==='ちいさい'));
});
