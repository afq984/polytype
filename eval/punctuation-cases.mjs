// Development probes; these desired strings are diagnostics, not frozen claims
// that current numeric or homophone behavior is correct. No dictionary input.
import {readingKeys} from '../web/engine.mjs';
const keys=reading=>readingKeys(reading).join('');
const afternoon=keys('ㄒㄧㄚˋ ㄨˇ'),dot=keys('ㄉㄧㄢˇ');
const probes=[
  {id:'afternoon-spaced',text:'下午 3 點',raw:afternoon+' 3 '+dot},
  {id:'afternoon-attached',text:'下午3點',raw:afternoon+'3'+dot},
  {id:'year',text:'2026 年',raw:'2026 '+keys('ㄋㄧㄢˊ')},
  {id:'edition',text:'第 2 版',raw:keys('ㄉㄧˋ')+' 2 '+keys('ㄅㄢˇ')},
  {id:'percentage',text:'11.6%',raw:'11.6%'},
  {id:'identifier',text:'v2',raw:'v2'},
  {id:'context-percentage',text:'下午 11.6%',raw:afternoon+' 11.6%'},
];
// Zhuyin positions and digits are identical in both layouts (v also stays v).
export const numericProbes=['qwerty','colemak'].flatMap(layout=>probes.map(row=>({...row,id:`number-${layout}-${row.id}`,options:{layout}})));
