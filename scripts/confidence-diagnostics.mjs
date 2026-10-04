import assert from 'node:assert/strict';
import {createEngine} from '../web/engine.mjs';
import {zhEnCases} from '../eval/zh-en-cases.mjs';
if(process.argv.length>2)throw new Error('Use bazelisk run //:confidence_diagnostics');
const e=createEngine();
// Predeclared before measuring: negative margin, <=0, <=.25, <=.5, <=1, <=2.
const thresholds=[-0.5,0,0.25,0.5,1,2];
const totals=thresholds.map(threshold=>({threshold,marked:0,truePositive:0}));
let segments=0,wrong=0,unscorable=0;
for(const row of zhEnCases.filter(c=>c.group==='zh-en-target-qwerty-en-zh')){
 const units=[];let raw='',text='',previous;
 const add=(keys,out)=>{units.push({start:raw.length,end:raw.length+keys.length,text:out});raw+=keys;text+=out};
 for(const s of row.segments){let content=s.text;const literal=s.kind==='literal',switched=previous&&previous.lang!==s.lang&&!literal&&previous.kind!=='literal';
  if(switched){if(s.lang==='en'&&content.startsWith(' '))content=content.slice(1);if(s.lang==='zh'&&raw.endsWith(' ')&&previous.lang==='en'){raw=raw.slice(0,-1);text=text.slice(0,-1);units.pop()};const toneSpace=previous.lang==='zh'&&raw.endsWith(' ');if(!toneSpace)add(' ',' ')}
  if(s.lang==='zh'){const readings=s.reading.trim().split(/\s+/);[...content].forEach((ch,i)=>add(e.readingKeys(readings[i]).join(''),ch))}else for(const ch of content)add(ch,ch);
  if(!literal)previous=s;
 }
 assert.equal(raw,row.raw);assert.equal(text,row.text);
 const view=e.segments(row.raw,row.options);
 for(const s of view.segments){if(!view.spans.some(p=>p.start===s.start&&p.end===s.end))continue;
  const gold=units.filter(u=>u.start<s.end&&u.end>s.start);if(!gold.length||gold[0].start!==s.start||gold.at(-1).end!==s.end){unscorable++;continue}
  const bad=s.text!==gold.map(u=>u.text).join('');segments++;wrong+=Number(bad);
  for(const t of totals)if(s.confidenceMargin!==null&&s.confidenceMargin<=t.threshold){t.marked++;t.truePositive+=Number(bad)}
 }
}
e.dispose();console.log(JSON.stringify({group:'zh-en-target-qwerty-en-zh',segments,wrong,unscorable,thresholds:totals.map(t=>({...t,precision:t.truePositive/t.marked,recall:t.truePositive/wrong,markRate:t.marked/segments}))},null,2));
