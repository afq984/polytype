import {readFileSync} from 'node:fs';
import {readingKeys} from '../web/engine.mjs';
import {encodeMixedInput} from './cases.mjs';
export const zhEnCorpus=JSON.parse(readFileSync(new URL('./zh-en/ascend.json',import.meta.url)));
export const englishOnlyCorpus=JSON.parse(readFileSync(new URL('./zh-en/english-only.json',import.meta.url)));
// Keep the unsettled output-spacing policy in one place. Literal spaces emit;
// first-tone completion spaces do not. "normalized" is an optional scoring view.
export function expectedSpacing(text,spacing='typed') {
  if(!['typed','normalized'].includes(spacing))throw new Error('Unknown spacing policy');
  return spacing==='normalized'?text.replaceAll(' ',''):text;
}
export function generateZhEnCases(entries,{spacing='typed'}={}) {
  return entries.filter(entry=>entry.segments.every(s=>s.lang!=='zh'||s.reading)).flatMap(entry=>
    ['current','target'].flatMap(contract=>['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>{
      const segments=entry.segments.map(s=>({...s}));
      let raw='',text='',previous;
      for(const segment of segments) {
        let content=segment.text;
        const literal=segment.kind==='literal';
        const switched=previous&&previous.lang!==segment.lang&&!literal&&previous.kind!=='literal';
        if(switched) {
          // One transcript boundary space, if present, is the contract's switch
          // space; extra transcript spaces remain literal.
          if(segment.lang==='en'&&content.startsWith(' '))content=content.slice(1);
          if(segment.lang==='zh'&&raw.endsWith(' ')&&previous.lang==='en') {raw=raw.slice(0,-1);text=text.slice(0,-1);}
          const toneSpace=previous.lang==='zh'&&raw.endsWith(' ');
          if(contract==='current'||!toneSpace){raw+=' ';text+=' ';}
        }
        if(segment.lang==='zh') {
          const syllables=segment.reading.trim().split(/\s+/);
          if(syllables.length!==[...content].length)throw new Error(`Annotation length mismatch: ${entry.id}`);
          // readingKeys is limited to 12 syllables per request, so use one at a time.
          raw+=syllables.map(s=>readingKeys(s).join('')).join('');text+=content;
        } else {raw+=layout==='colemak'?encodeMixedInput(content):content;text+=content;}
        if(!literal)previous=segment;
      }
      const languages=japanese?'all':'en-zh';
      const group=`${entry.kind==='zh-only'?'zh-only':'zh-en'}-${contract}-${layout}-${languages}`;
      if(raw.length>400)throw new Error(`Input exceeds decoder limit: ${entry.id}`);
      return {id:`${entry.id}-${contract}-${layout}-${languages}`,sourceId:entry.id,group,contract,raw,text:expectedSpacing(text,spacing),options:{layout,english:true,japanese,zhuyin:true},segments,review:entry.review};
    })))
  );
}
export const zhEnCases=generateZhEnCases(zhEnCorpus.cases);
export const englishOnlyCases=englishOnlyCorpus.cases.flatMap(entry=>['qwerty','colemak'].map(layout=>({
  ...entry,id:`${entry.id}-${layout}`,sourceId:entry.id,group:`en-only-${layout}`,raw:layout==='colemak'?encodeMixedInput(entry.text):entry.text,
  options:{layout,english:true,japanese:true,zhuyin:true},segments:[{lang:'en',text:entry.text}],
})));
export const zhEnSkipped=zhEnCorpus.cases.filter(entry=>entry.segments.some(s=>s.lang==='zh'&&!s.reading)).map(entry=>entry.id);
// Optional --extra-cases hook; default tracked evaluator reports stay unchanged.
export const cases=[...zhEnCases,...englishOnlyCases];
