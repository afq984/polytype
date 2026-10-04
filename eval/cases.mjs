import {readFileSync} from 'node:fs';
import {readingKeys, encode, colemak} from '../web/engine.mjs';
import {japaneseCases} from './japanese-cases.mjs';
export {japaneseCases, japaneseCorpus} from './japanese-cases.mjs';
// Reading-level view of a committed candidate: imported Japanese conversions
// are replaced by their kana reading, so language choice and segmentation can
// be judged without freezing a kanji choice that follows dictionary order.
export const kanaLevel = candidate => candidate.parts.map(part => part.reading ?? part.commitText ?? part.text).join('');
export const corpus = JSON.parse(readFileSync(new URL('./corpus.json',import.meta.url)));
export const readingSequence = reading => reading.trim().split(/\s+/).flatMap(syllable=>readingKeys(syllable));
export const realCases = corpus.cases.map(entry=>{
  const keys=readingSequence(entry.reading);
  if(keys.length!==[...entry.text].length)throw new Error(`Annotation length mismatch: ${entry.id}`);
  return {...entry,group:'real-text',raw:keys.join('')};
});
const acceptance=JSON.parse(readFileSync(new URL('../tests/fixtures/acceptance.json',import.meta.url)));
// Keep the frozen prototype fixture; expanded Chinese punctuation has one
// explicit target migration, with the original ASCII form still selectable.
export const expandedTarget = row => row.raw===acceptance[1].raw
  ? '目前用起來還不錯 可以增加詞庫嗎？' : row.text;
export const guardCases = [
  ...acceptance.map((entry,i)=>({id:`acceptance-${i+1}`,group:'guards',text:entry.text,raw:entry.raw??encode(entry.roman)})),
  ...['hello world','good morning','this is a test','please open the browser','the keyboard is working','sakura hello','gakkou small'].map((roman,i)=>({
    id:`synthetic-${i+1}`,group:'guards',raw:encode(roman),text:i===5?'さくら hello':i===6?'がっこう small':roman,
  })),
  {id:'trilingual',group:'guards',text:'がっこう 你好 hello',raw:encode('gakkou')+' us3lc3 '+encode('hello')},
];
export const feedbackCases = [
  {id:'feedback-kuai',group:'user-feedback',raw:'u/ e9 dj94xk7187',text:'應該快了吧'},
  {id:'feedback-code-loop',group:'user-feedback',raw:encode('for (int i = 0; i < 100; i++)'),text:'for (int i = 0; i < 100; i++)'},
  {id:'feedback-bug-raw',group:'user-feedback',raw:'Fhld ld a bit.',text:'This is a bug.'},
  {id:'feedback-short-word-period',group:'user-feedback',raw:'F'+encode('his is a bit.'),text:'This is a bit.'},
  {id:'feedback-conclusion',group:'user-feedback',raw:'c;jcuidl;j',text:'conclusion'},
  {id:'feedback-zhuyin-priority',group:'user-feedback',
    raw:'L'+encode(' think ')+readingKeys('ㄓㄨˋ ㄧㄣ').join('')+encode("'s priority is too high  (this is also a good test sentence)"),
    text:"I think 注音's priority is too high  (this is also a good test sentence)"},
];
export const mixedCorpus=JSON.parse(readFileSync(new URL('./mixed-text.json',import.meta.url)));
// Validate the case-preserving physical encoding of supplied Roman examples.
export function encodeMixedInput(text) {
  const raw=encode(text);
  if(colemak(raw)!==text)throw new Error('Mixed-text fixture cannot round-trip through the current Colemak raw encoding');
  return raw;
}
// Explicit adapter for generated Roman fixtures evaluated by the frozen profile.
export const prototypeRaw = row => row.prototypeRaw ?? row.raw;
export const mixedCases=mixedCorpus.cases.flatMap(entry=>['colemak','qwerty'].flatMap(layout=>[true,false].map(zhuyin=>({
  ...entry,id:`${entry.id}-${layout}-${zhuyin?'all':'en-jp'}`,group:`mixed-${layout}-${zhuyin?'all':'en-jp'}`,
  raw:layout==='colemak'?encodeMixedInput(entry.input):entry.input,
  ...(layout==='colemak'&&entry.input.includes(':')?{prototypeRaw:encodeMixedInput(entry.input).replaceAll('P',':')}:{}),
  options:{layout,english:true,japanese:true,zhuyin},
}))));
export const cases = [...realCases,...guardCases,...feedbackCases,...mixedCases,...japaneseCases];
