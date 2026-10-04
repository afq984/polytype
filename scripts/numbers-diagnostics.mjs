import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [baselinePath,outputDirectory]=process.argv.slice(2);
if(!baselinePath||!outputDirectory)throw new Error('Provide a main snapshot web/engine.mjs and an external output directory');
const destination=resolve(outputDirectory);
fs.mkdirSync(destination,{recursive:true});
const base=await import(pathToFileURL(resolve(baselinePath)));
const current=await import('../web/engine.mjs');
const {cases:numbers}=await import('../eval/numbers-cases.mjs');
const {cases:bundled,kanaLevel,expandedTarget,realCases,japaneseCases,encodeMixedInput}=await import('../eval/cases.mjs');
const {cases:zhEn}=await import('../eval/zh-en-cases.mjs');
const {currentRaw}=await import('../eval/physical-keys.mjs');
const {caseMetrics,summarizeMilestone}=await import('./evaluation-metrics.mjs');
const frozen=JSON.parse(fs.readFileSync(new URL('../eval/island-baseline.json',import.meta.url))).rows.map(row=>({...row,raw:currentRaw(row),group:'frozen-'+row.group}));
const engines={baseline:base.createEngine(),current:current.createEngine()};
const extraGsd=realCases.flatMap(row=>['qwerty','colemak'].map(layout=>({...row,id:row.id+'-'+layout,group:'gsd-'+layout,options:{layout}})));
const rows=[];
for(const entry of [...numbers,...bundled,...extraGsd,...japaneseCases.map(row=>({...row,id:row.id+"-colemak",group:row.group+"-colemak",raw:encodeMixedInput(row.raw),options:{...row.options,layout:"colemak"}})),...zhEn,...frozen]){
  const text=(bundled.includes(entry)?expandedTarget(entry):entry.text)??"";
  const runs={};
  for(const [name,engine] of Object.entries(engines)){
    const candidates=engine.decode(entry.raw,entry.options);
    const outputs=candidates.map(c=>engine.commitCandidate(c));
    const rank=text?outputs.indexOf(text)+1:0;
    const readingRank=text?candidates.findIndex((c,i)=>outputs[i]===text||kanaLevel(c)===text)+1:0;
    runs[name]={rank,readingRank,candidates:outputs,score:candidates[0]?.score,scores:candidates.map(c=>c.score),...caseMetrics(text,outputs)};
  }
  rows.push({id:entry.id,group:entry.group,raw:entry.raw,options:entry.options,text,runs});
}
const groups={};
for(const group of new Set(rows.map(row=>row.group))){
 const selected=rows.filter(row=>row.group===group);
 const summarize=name=>{const rr=selected.map(row=>row.runs[name]);return {cases:rr.length,top1:rr.filter(x=>x.rank===1).length,top5:rr.filter(x=>x.rank>0).length,readingTop1:rr.filter(x=>x.readingRank===1).length,readingTop5:rr.filter(x=>x.readingRank>0).length,...summarizeMilestone(rr)}};
 groups[group]={baseline:summarize('baseline'),current:summarize('current')};
}
const losses=rows.filter(({runs:r})=>(r.baseline.rank===1&&r.current.rank!==1)||(r.baseline.rank>0&&!r.current.rank)||(r.baseline.readingRank===1&&r.current.readingRank!==1)||(r.baseline.readingRank>0&&!r.current.readingRank));
const gains=rows.filter(({runs:r})=>(r.baseline.rank!==1&&r.current.rank===1)||(!r.baseline.rank&&r.current.rank));
const snapshot={rows:frozen.map(row=>({id:row.id,raw:row.raw,options:row.options,candidates:engines.baseline.decode(row.raw,row.options).map(c=>({text:engines.baseline.commitCandidate(c),score:c.score}))}))};
fs.writeFileSync(destination+'/main-results.json',JSON.stringify(snapshot));
fs.writeFileSync(destination+'/paired.json',JSON.stringify({notes:'Public synthetic and sourced development evidence; paired against the supplied built main snapshot. Exact/reading targets remain unchanged. Frozen rows use explicit physical-key adapters; historical files are untouched.',baselineRanking:base.rankingId,currentRanking:current.rankingId,groups,losses,gains,rows},null,2));
for(const name of ['qwerty','colemak'])for(const contract of ['current','target'])for(const lang of ['en-zh','all']){
 const selected=rows.filter(row=>row.group.startsWith('numbers-')&&!row.group.startsWith('numbers-control-')&&row.id.endsWith(`${contract}-${name}-${lang}`));
 console.log('numbers',name,contract,lang,selected.length,...['baseline','current'].map(key=>[selected.filter(row=>row.runs[key].rank===1).length,selected.filter(row=>row.runs[key].rank>0).length]));
}
console.log('losses',losses.length,'gains',gains.length);
console.log('Detailed losses and candidate arrays: ' + destination + '/paired.json');
const prefixCases=[
  ...numbers.filter(row=>row.category==='control'&&row.contract==='current'),
  ...realCases.flatMap(row=>['qwerty','colemak'].flatMap(layout=>[false,true].map(japanese=>({...row,id:row.id+'-'+layout+'-'+japanese,group:'gsd',options:{layout,japanese}})))),
];
const prefixes=[],prefixGroups={};
for(const entry of prefixCases){
  const group=(entry.category==='control'?'controls':'gsd')+'-'+entry.options.layout+'-'+(entry.options.japanese?'all':'en-zh');
  const counts=prefixGroups[group]??={prefixes:0,changed:0,baselineRevisions:0,currentRevisions:0};
  const previous={baseline:'',current:''};
  for(let length=1;length<=entry.raw.length;length++){
    const outputs={};
    for(const [name,engine] of Object.entries(engines)){
      const candidate=engine.decode(entry.raw.slice(0,length),entry.options)[0];
      outputs[name]=candidate?engine.commitCandidate(candidate):'';
      if(previous[name]&&!outputs[name].startsWith(previous[name]))counts[name+'Revisions']++;
      previous[name]=outputs[name];
    }
    counts.prefixes++;
    if(outputs.baseline!==outputs.current){
      counts.changed++;
      prefixes.push({id:entry.id,length,raw:entry.raw.slice(0,length),options:entry.options,...outputs});
    }
  }
}
fs.writeFileSync(destination+'/prefixes.json',JSON.stringify({notes:'Every prefix of 20 Chinese excerpts and 48 controls, both layouts and language modes. A revision means the next committed output no longer starts with the preceding output; it includes ordinary phonetic updates, not only language switches.',groups:prefixGroups,changes:prefixes},null,2));
console.log('prefix groups',JSON.stringify(prefixGroups));
for(const engine of Object.values(engines))engine.dispose();
