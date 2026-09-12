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
export const guardCases = [
  ...acceptance.map((entry,i)=>({id:`acceptance-${i+1}`,group:'guards',text:entry.text,raw:entry.raw??encode(entry.roman)})),
  ...['hello world','good morning','this is a test','please open the browser','the keyboard is working','sakura hello','gakkou small'].map((roman,i)=>({
    id:`synthetic-${i+1}`,group:'guards',raw:encode(roman),text:i===5?'さくら hello':i===6?'がっこう small':roman,
  })),
  {id:'trilingual',group:'guards',text:'がっこう 你好 hello',raw:encode('gakkou')+' us3lc3 '+encode('hello')},
];
export const feedbackCases = [
  {id:'feedback-code-loop',group:'user-feedback',raw:encode('for (int i = 0; i < 100; i++)'),text:'for (int i = 0; i < 100; i++)'},
  {id:'feedback-bug-raw',group:'user-feedback',raw:'Fhld ld a bit.',text:'This is a bug.'},
  {id:'feedback-short-word-period',group:'user-feedback',raw:'F'+encode('his is a bit.'),text:'This is a bit.'},
  {id:'feedback-conclusion',group:'user-feedback',raw:'c;jcuidl;j',text:'conclusion'},
  {id:'feedback-zhuyin-priority',group:'user-feedback',
    raw:'L'+encode(' think ')+readingKeys('ㄓㄨˋ ㄧㄣ').join('')+encode("'s priority is too high  (this is also a good test sentence)"),
    text:"I think 注音's priority is too high  (this is also a good test sentence)"},
];
export const mixedCorpus=JSON.parse(readFileSync(new URL('./mixed-text.json',import.meta.url)));
// The legacy encode helper does not invert uppercase letters. Keep this test
// adapter explicit and validate its round trip rather than silently changing
// case in the supplied examples. Uppercase O has no current physical encoding.
export function encodeMixedInput(text) {
  const raw=[...text].map(c=>/[A-Z]/.test(c)?encode(c.toLowerCase()).toUpperCase():encode(c)).join('');
  if(colemak(raw)!==text)throw new Error('Mixed-text fixture cannot round-trip through the current Colemak raw encoding');
  return raw;
}
export const mixedCases=mixedCorpus.cases.flatMap(entry=>['colemak','qwerty'].flatMap(layout=>[true,false].map(zhuyin=>({
  ...entry,id:`${entry.id}-${layout}-${zhuyin?'all':'en-jp'}`,group:`mixed-${layout}-${zhuyin?'all':'en-jp'}`,
  raw:layout==='colemak'?encodeMixedInput(entry.input):entry.input,
  options:{layout,english:true,japanese:true,zhuyin},
}))));
export const cases = [...realCases,...guardCases,...feedbackCases,...mixedCases,...japaneseCases];
