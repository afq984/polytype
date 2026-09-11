// Offline evaluation. An optional JSONL path accepts {id?, raw, text} records.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEngine, readingKeys} from '../web/engine.mjs';
import {cases as bundled, corpus, mixedCorpus, readingSequence} from '../eval/cases.mjs';

const timing = process.argv.includes('--timing');
const external = process.argv.slice(2).find(arg => arg !== '--timing');
const cases = external ? (await readFile(external,'utf8')).split('\n').filter(Boolean).map((line,i)=>{
  const entry=JSON.parse(line);
  if(typeof entry.raw!=='string'||typeof entry.text!=='string'||entry.raw.length>400)throw new Error(`Invalid JSONL row ${i+1}`);
  return {...entry,id:entry.id??`local-${i+1}`,group:'local'};
}) : bundled;
if(!cases.length)throw new Error('Empty evaluation corpus');
function distance(a,b) {
  a=[...a];b=[...b];let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const current=[i];for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    previous=current;
  }
  return previous[b.length];
}
const lexicon = JSON.parse(await readFile(new URL('../data/lexicon.json',import.meta.url),'utf8'));
const imported=(await readFile(new URL('../data/chinese.tsv',import.meta.url),'utf8')).trim().split('\n').map(line=>line.split('\t'));
function dictionaryOracle(expanded) {
  const rows=[...lexicon.chinese,...(expanded?imported:[])];
  const pairs=new Set(rows.map(([reading,text])=>readingKeys(reading).join('|')+'\t'+text));
  return entry=>{
    if(!entry.reading)return null;
    const keys=readingSequence(entry.reading),chars=[...entry.text],reachable=new Set([0]);
    for(let i=0;i<chars.length;i++)if(reachable.has(i))for(let length=1;length<=12&&i+length<=chars.length;length++){
      if(pairs.has(keys.slice(i,i+length).join('|')+'\t'+chars.slice(i,i+length).join('')))reachable.add(i+length);
    }
    return reachable.has(chars.length);
  };
}
const report={method:external?'User-supplied local raw/text pairs':corpus.selection,
  ...(external?{}:{mixedTextNotes:mixedCorpus.notes}),
  notes:'Exact output matching, including variants and spaces. Readings are supplied, not inferred by the tested dictionary. Corpus overlap with upstream frequency training is unknown. CER includes insertions and can exceed 100%. '+(timing?'Timing uses an already-loaded WASM module; prefix latency excludes engine construction and UI rendering.':'Timing is omitted for reproducibility; use bazelisk run //:measure_evaluation for host-dependent latency measurements.')+'',
  corpusSha256:createHash('sha256').update(JSON.stringify(cases)).digest('hex'),profiles:{}};
for(const profile of ['prototype','expanded']) {
  const started=timing?performance.now():0;const engine=createEngine({dictionary:profile});
  const initializationMs=timing?performance.now()-started:0;
  const oracle=dictionaryOracle(profile==='expanded');
  const rows=[],prefixTimes=[];
  try {
    for(const entry of cases) {
      const candidates=engine.decode(entry.raw,entry.options);
      const outputs=candidates.map(candidate=>engine.commitCandidate(candidate));
      const rank=outputs.indexOf(entry.text)+1;
      if(timing)for(let i=1;i<=entry.raw.length;i++){
        const start=performance.now();engine.decode(entry.raw.slice(0,i),entry.options);prefixTimes.push(performance.now()-start);
      }
      rows.push({id:entry.id,group:entry.group,raw:entry.raw,...(entry.options?{options:entry.options}:{}),expected:entry.text,actual:outputs[0]??'',rank,
        edits:distance(entry.text,outputs[0]??''),characters:[...entry.text].length,reachable:oracle(entry),candidates:outputs});
    }
    const groups=Object.fromEntries([...new Set(rows.map(row=>row.group))].map(group=>{
      const selected=rows.filter(row=>row.group===group),annotated=selected.filter(row=>row.reachable!==null);
      return [group,{cases:selected.length,top1:selected.filter(row=>row.rank===1).length,top5:selected.filter(row=>row.rank>0).length,
        characterErrorRate:selected.reduce((n,row)=>n+row.edits,0)/Math.max(1,selected.reduce((n,row)=>n+row.characters,0)),
        reachable:annotated.length?annotated.filter(row=>row.reachable).length:null}];
    }));
    prefixTimes.sort((a,b)=>a-b);
    report.profiles[profile]={dictionary:engine.dictionarySize(),groups,...(timing?{instanceCreationMs:initializationMs,prefixLatency:{count:prefixTimes.length,p50Ms:prefixTimes[Math.floor(prefixTimes.length*.5)],p95Ms:prefixTimes[Math.floor(prefixTimes.length*.95)],maxMs:prefixTimes.at(-1)}}:{}),rows};
  } finally {engine.dispose()}
}
const before=report.profiles.prototype.rows,after=report.profiles.expanded.rows;
report.regressions=after.filter((row,i)=>before[i].rank===1&&row.rank!==1).map(row=>row.id);
report.top5Regressions=after.filter((row,i)=>before[i].rank>0&&row.rank===0).map(row=>row.id);
const lines=['# Chinese dictionary and mixed-text evaluation','',report.method,'',report.notes,'',...(report.mixedTextNotes?[report.mixedTextNotes,'']:[]),
  '| Profile / group | Top 1 | Top 5 | Character error rate | Dictionary-reachable |',
  '| --- | --- | --- | --- | --- |'];
for(const [profile,result] of Object.entries(report.profiles))for(const [group,metrics] of Object.entries(result.groups))lines.push(`| ${profile} / ${group} | ${metrics.top1}/${metrics.cases} | ${metrics.top5}/${metrics.cases} | ${(metrics.characterErrorRate*100).toFixed(1)}% | ${metrics.reachable??'n/a'} |`);
lines.push('',`Top-1 regressions: ${report.regressions.join(', ')||'none'}.`, `Top-5 regressions: ${report.top5Regressions.join(', ')||'none'}.`,'');
if(timing)for(const [profile,result] of Object.entries(report.profiles))lines.push(`${profile}: engine instance ${result.instanceCreationMs.toFixed(1)} ms; prefix decode p50 ${result.prefixLatency.p50Ms.toFixed(2)} ms, p95 ${result.prefixLatency.p95Ms.toFixed(2)} ms (this run; module already loaded).`);
lines.push('','## Remaining expanded-profile errors','');
for(const row of after.filter(row=>row.rank!==1))lines.push(`- ${row.id}: ${row.expected} → ${row.actual} (target rank: ${row.rank||'outside top 5'}; dictionary reachable: ${row.reachable??'not measured'})`);
if(external||timing){console.log(JSON.stringify(report,null,2));}
else {
  await writeFile(new URL('../eval/report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  await writeFile(new URL('../eval/REPORT.md',import.meta.url),lines.join('\n')+'\n');
  console.log(lines.join('\n'));
}
