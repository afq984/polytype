// ASUS user-review/FAQ-inspired synthetic development inputs, not review text
// or a measurement of ASUS. No dictionary consumes these cases. Chinese readings
// are hand-annotated; targets keep every literal Space exactly as typed.
import {generateZhEnCases} from './zh-en-cases.mjs';
import {readingKeys} from '../web/engine.mjs';
import {encodeMixedInput} from './cases.mjs';

const reviewSource='https://apps.microsoft.com/detail/9MT4L79Z1G0N';
const correctionSource='https://www.asus.com/tw/support/FAQ/1048636/';
const provenance='ASUS user-review/FAQ-inspired synthetic development';
const zh=(text,reading)=>({lang:'zh',text,reading});
const en=text=>({lang:'en',text});
const about=()=>zh('關於','ㄍㄨㄢ ㄩˊ');
const de=()=>zh('的','ㄉㄜ˙');
const file=()=>zh('的檔案','ㄉㄜ˙ ㄉㄤˇ ㄢˋ');
const gang=()=>zh('剛','ㄍㄤ');
const analyze=()=>zh('要分析','ㄧㄠˋ ㄈㄣ ㄒㄧ');
const ban=()=>zh('版','ㄅㄢˇ');
const ni=()=>zh('你','ㄋㄧˇ');

const definitions=[
  ['ben-about','english-space', [about(),en('Ben'),de()]],
  ['ben-file','english-space', [about(),en('Ben'),file()]],
  ['ben-today','english-space', [zh('今天','ㄐㄧㄣ ㄊㄧㄢ'),en('Ben'),de()]],
  ['ben-first-tone','english-space', [gang(),en('Ben'),de()]],
  ['dmp-analyze','abbreviation-space', [en('crash dmp'),analyze()]],
  ['dmp-file','abbreviation-space', [en('crash dmp'),file()]],
  ['dmp-first-tone','abbreviation-space', [gang(),en('crash dmp'),analyze()]],
  ['pc-ban','digit-syllable', [en('PC'),ban()]],
  ['pc-version','digit-syllable', [en('PC'),zh('版本','ㄅㄢˇ ㄅㄣˇ')]],
  ['pc-first-tone','digit-syllable', [zh('新','ㄒㄧㄣ'),en('PC'),ban()]],
  ['ban','digit-syllable', [ban()]],
  ['zhi','digit-syllable', [zh('指','ㄓˇ')]],
  ['zhi-tou','digit-syllable', [zh('指頭','ㄓˇ ㄊㄡˊ')]],
  ['suo','sentence-initial', [zh('所','ㄙㄨㄛˇ')]],
  ['suo-yi','sentence-initial', [zh('所以','ㄙㄨㄛˇ ㄧˇ')]],
  ['suo-you','sentence-initial', [zh('所有','ㄙㄨㄛˇ ㄧㄡˇ')]],
  ['call-ni','english-chinese', [en('call'),ni()]],
  ['call-first-tone','english-chinese', [gang(),en('call'),ni()]],
];
export const inContractEntries=definitions.map(([id,pattern,segments])=>({
  id:`asus-${id}`,pattern,segments,kind:segments.every(s=>s.lang==='zh')?'zh-only':'mixed',
  review:'synthetic',provenance,source:pattern==='english-chinese'?correctionSource:reviewSource,scope:'in-contract',
}));
export const inContractCases=generateZhEnCases(inContractEntries).map(row=>{
  const entry=inContractEntries.find(entry=>entry.id===row.sourceId);
  return {...row,pattern:entry.pattern,provenance:entry.provenance,source:entry.source,scope:entry.scope,rawEncodingVersion:2,
    group:`asus-in-contract-${row.contract}-${row.options.layout}-${row.options.japanese?'all':'en-zh'}`};
});

// "PC版" and the FAQ's incorrect display "calls以" -> intended "call你"
// require a switch without a Space. Record diagnostic targets separately; they
// are outside Polytype's approved typing contract and are not shipping gates.
export const outOfContractEntries=[
  {id:'asus-attached-pc-ban',segments:[en('PC'),ban()],source:reviewSource},
  {id:'asus-attached-call-ni',segments:[en('call'),ni()],source:correctionSource},
];
const configurations=entry=>['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>({
  ...entry,id:`${entry.id}-${layout}-${japanese?'all':'en-zh'}`,sourceId:entry.id,
  options:{layout,english:true,japanese,zhuyin:true},rawEncodingVersion:2,
})));
export const outOfContractCases=outOfContractEntries.flatMap(configurations).map(row=>({
  ...row,raw:row.segments.map(s=>s.lang==='zh'?readingKeys(s.reading).join(''):
    row.options.layout==='colemak'?encodeMixedInput(s.text):s.text).join(''),
  text:row.segments.map(s=>s.text).join(''),contract:'no-space',scope:'out-of-contract',
  pattern:'attached-language-switch',provenance:'ASUS review/FAQ-inspired synthetic development',review:'synthetic',
  group:`asus-out-of-contract-${row.options.layout}-${row.options.japanese?'all':'en-zh'}`,
}));

// This is a correction-action target, not a demand that incomplete "1" always
// default to phonetics or digits. Measure ordinary rank and local recovery apart.
export const correctionCases=configurations({id:'asus-bare-b',raw:'1',text:'ㄅ',source:correctionSource}).map(row=>({
  ...row,contract:'correction',scope:'correction',pattern:'bare-zhuyin',review:'synthetic',
  provenance:'ASUS FAQ-inspired synthetic development',
  group:`asus-correction-${row.options.layout}-${row.options.japanese?'all':'en-zh'}`,
}));
export const cases=[...inContractCases,...outOfContractCases,...correctionCases];
