// Public, hand-authored synthetic development probes for Roman-context numbers.
// Numeric homographs deliberately exercise dictionary Zhuyin readings. These
// are evaluation inputs, not dictionary data or held-out coverage.
import {encodeMixedInput} from './cases.mjs';
import {generateZhEnCases} from './zh-en-cases.mjs';

const tables={
  integer:[
    'Count 53 cards again','The next seat is 94','We ordered 87 tickets today',
    'Her final tally was 93','Please check aisle 56','Record number 03',
    'Box 103 contains books','Bundle 193 arrived today','The suite is 504',
    'Move to level 54','There are 104 pieces','The total is 196',
    'Check item 194 later','Number 04 is available','They sent 184 forms',
    'Keep 187 copies',
  ],
  decimal:[
    'release 1.03','The ratio is 5.04','Allow 0.93 today','Value 19.3',
    'Limit 5.3','The reading is 1.03.','Use 1.03, please','revision 1.03; retry',
    'The rate is 1.03%','Offset -1.03','Gain +5.04',
    'release 1.03!','Check ratio 5.04?','Use (build 1.03)',
  ],
  version:[
    'patch 1.0.3 is ready','Install build 2.5.3','release 10.3.4 now',
    'The revision is 19.3.4',
  ],
  model:[
    'Use iPhone 15 today','Win 10 is installed','The GPU is RTX 4090',
    'Try Model 103','Phone 504 needs power',
  ],
  time:[
    'Meet at 14:30','The alarm is 05:04','Start at 19:03 tomorrow',
    'The timer reads 1:03:54',
  ],
};
export const englishEntries=Object.entries(tables).flatMap(([category,texts])=>texts.map((text,index)=>({
  id:`roman-number-${category}-${String(index+1).padStart(2,'0')}`,category,text,
  review:'synthetic',provenance:'Public synthetic Roman-context numeric development',
})));
export const englishCases=englishEntries.flatMap(entry=>['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>({
  ...entry,id:`${entry.id}-${layout}-${japanese?'all':'en-zh'}`,sourceId:entry.id,
  raw:layout==='colemak'?encodeMixedInput(entry.text):entry.text,
  options:{layout,english:true,japanese,zhuyin:true},rawEncodingVersion:2,
  contract:'literal-roman',scope:'in-contract',group:`roman-number-${entry.category}-${layout}-${japanese?'all':'en-zh'}`,
}))));

const zh=(text,reading)=>({lang:'zh',text,reading}),en=text=>({lang:'en',text});
export const mixedEntries=[
  {id:'roman-number-mixed-phone',segments:[zh('買了','ㄇㄞˇ ㄌㄜ˙'),en('iPhone 15')]},
  {id:'roman-number-mixed-win',segments:[zh('安裝','ㄢ ㄓㄨㄤ'),en('Win 10')]},
  {id:'roman-number-mixed-gpu',segments:[zh('改用','ㄍㄞˇ ㄩㄥˋ'),en('RTX 4090')]},
  {id:'roman-number-mixed-model',segments:[zh('收到','ㄕㄡ ㄉㄠˋ'),en('Model 103')]},
  {id:'roman-number-mixed-revision',segments:[zh('更新','ㄍㄥ ㄒㄧㄣ'),en('release 1.03')]},
  {id:'roman-number-mixed-time',segments:[zh('約','ㄩㄝ'),en('meeting 14:30')]},
].map(entry=>({...entry,kind:'mixed',category:'mixed-model',review:'synthetic',
  provenance:'Public synthetic Roman-context numeric development'}));
export const mixedCases=generateZhEnCases(mixedEntries).map(row=>({...row,
  category:'mixed-model',scope:'in-contract',review:'synthetic',rawEncodingVersion:2,
  provenance:'Public synthetic Roman-context numeric development',
  group:`roman-number-mixed-${row.contract}-${row.options.layout}-${row.options.japanese?'all':'en-zh'}`,
}));

// Digit-only Chinese after Roman context remains a known ambiguity. Do not
// promote these Chinese homographs by sacrificing ordinary English numerals.
export const ambiguityEntries=[
  {id:'roman-ambiguity-pc',segments:[en('PC'),zh('版','ㄅㄢˇ')]},
  {id:'roman-ambiguity-soccer',segments:[en('soccer'),zh('吧','ㄅㄚ˙')]},
  {id:'roman-ambiguity-hk',segments:[en('HK'),zh('啊','ㄚ˙'),en('C')]},
].map(entry=>({...entry,kind:'mixed',review:'synthetic'}));
export const ambiguityCases=generateZhEnCases(ambiguityEntries).map(row=>({...row,
  scope:'known-ambiguity',category:'ambiguity',rawEncodingVersion:2,review:'synthetic',
  provenance:'Public synthetic Roman-context homophone development',
  group:`roman-ambiguity-${row.contract}-${row.options.layout}-${row.options.japanese?'all':'en-zh'}`,
}));
export const guardCases=[...englishCases,...mixedCases];

// Opposite-reading controls: the number wins, but these Chinese readings must
// remain in the five whole candidates, not only the segment menu.
export const dottedChineseCases=[
  {id:'roman-dotted-tiktok',text:'TikTok 2.3',chineseTarget:'TikTok 斗'},
  {id:'roman-dotted-java',text:'Java 2.4',chineseTarget:'Java 鬥'},
  {id:'roman-dotted-pc',text:'PC 5.3',chineseTarget:'PC 肘'},
].flatMap(entry=>['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>({
  ...entry,id:`${entry.id}-${layout}-${japanese?'all':'en-zh'}`,sourceId:entry.id,
  raw:layout==='colemak'?encodeMixedInput(entry.text):entry.text,
  options:{layout,english:true,japanese,zhuyin:true},rawEncodingVersion:2,
  scope:'candidate-control',category:'dotted-chinese',review:'synthetic',contract:'literal-roman',
  provenance:'Public synthetic dotted-number opposite-reading control',
  group:`roman-dotted-chinese-${layout}-${japanese?'all':'en-zh'}`,
}))));
export const firstToneCases=['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>({
  id:`roman-first-tone-${layout}-${japanese?'all':'en-zh'}`,sourceId:'roman-first-tone',
  raw:(layout==='colemak'?encodeMixedInput('deadline'):'deadline')+' 5. u ',text:'deadline 週一',
  options:{layout,english:true,japanese,zhuyin:true},rawEncodingVersion:2,
  scope:'chinese-control',category:'first-tone',review:'synthetic',contract:'first-tone-chinese',
  provenance:'Public synthetic first-tone Chinese control',
  group:`roman-first-tone-${layout}-${japanese?'all':'en-zh'}`,
})));
export const cases=[...guardCases,...ambiguityCases,...dottedChineseCases,...firstToneCases];
