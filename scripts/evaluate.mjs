// Offline evaluation: optional JSONL replacement and additional case modules.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEngine, readingKeys} from '../web/engine.mjs';
import {distance, caseMetrics, summarizeMilestone} from './evaluation-metrics.mjs';
import {loadEvaluationCases} from './evaluation-cases.mjs';
import {cases as bundled, corpus, mixedCorpus, japaneseCorpus, readingSequence, kanaLevel, expandedTarget} from '../eval/cases.mjs';

const {cases, external, timing, extraModules} = await loadEvaluationCases(process.argv.slice(2), bundled);
const lexicon = JSON.parse(await readFile(new URL('../data/lexicon.json',import.meta.url),'utf8'));
const imported=(await readFile(new URL('../data/chinese.tsv',import.meta.url),'utf8')).trim().split('\n').map(line=>line.split('\t'));
const japanese=(await readFile(new URL('../data/japanese.tsv',import.meta.url),'utf8')).trim().split('\n').map(line=>line.split('\t'));
function dictionaryOracle(expanded) {
  const rows=[...lexicon.chinese,...(expanded?imported:[])];
  const pairs=new Set(rows.map(([reading,text])=>readingKeys(reading).join('|')+'\t'+text));
  // Japanese conversion is whole-token: the pair must exist for the composed reading.
  const japanesePairs=new Set([...(expanded?japanese:[]).map(([reading,text])=>reading+'\t'+text),
    ...Object.values(lexicon.japanese).map(outputs=>outputs.find(t=>/^[ぁ-ゖー]+$/u.test(t))+'\t'+outputs[0])]);
  return entry=>{
    if(entry.kana)return japanesePairs.has(entry.kana+'\t'+entry.text);
    if(!entry.reading)return null;
    const keys=readingSequence(entry.reading),chars=[...entry.text],reachable=new Set([0]);
    for(let i=0;i<chars.length;i++)if(reachable.has(i))for(let length=1;length<=12&&i+length<=chars.length;length++){
      if(pairs.has(keys.slice(i,i+length).join('|')+'\t'+chars.slice(i,i+length).join('')))reachable.add(i+length);
    }
    return reachable.has(chars.length);
  };
}
const report={method:external?'User-supplied local raw/text pairs':corpus.selection,
  ...(extraModules?{extraCaseModules:extraModules}:{}),
  milestoneNotes:'Space normalization deletes only U+0020 runs directly between Han and Latin-script letters/ASCII digits. English exact is ordered whole-token recall over ASCII letter/digit runs including apostrophe, hyphen, underscore and period (punctuation-only runs excluded). Han CER aligns only Han characters. Wrong language counts intrusions only for targets with exclusively Latin or exclusively Han letters; spaces, numbers, punctuation and symbols are neutral. Han-only Japanese targets are indistinguishable from Chinese by this script diagnostic. Rates use pooled token/character/eligible-case denominators; null means no eligible target units. Exact and reading-level metrics remain unchanged.',
  ...(external?{}:{mixedTextNotes:mixedCorpus.notes}),
  ...(external?{}:{japaneseWordNotes:japaneseCorpus.selection}),
  notes:'Exact output matching, including variants and spaces. Reading-level matching additionally accepts imported Japanese conversions whose kana reading equals the target span, so kana-annotated targets are not counted as errors when a kanji conversion is offered instead. Readings are supplied, not inferred by the tested dictionary. Corpus overlap with upstream frequency training is unknown. CER includes insertions and can exceed 100%. '+(timing?'Timing uses an already-loaded WASM module; prefix latency excludes engine construction and UI rendering.':'Timing is omitted for reproducibility; use bazelisk run //:measure_evaluation for host-dependent latency measurements.')+'',
  corpusSha256:createHash('sha256').update(JSON.stringify(cases)).digest('hex'),profiles:{}};
for(const profile of ['prototype','expanded']) {
  const started=timing?performance.now():0;const engine=createEngine({dictionary:profile});
  const initializationMs=timing?performance.now()-started:0;
  const oracle=dictionaryOracle(profile==='expanded');
  const rows=[],prefixTimes=[];
  try {
    for(const original of cases) {
      const entry={...original,text:profile==='expanded'&&!external&&bundled.some(row=>row.id===original.id&&row.raw===original.raw)?expandedTarget(original):original.text};
      const candidates=engine.decode(entry.raw,entry.options);
      const outputs=candidates.map(candidate=>engine.commitCandidate(candidate));
      const rank=outputs.indexOf(entry.text)+1;
      const readingRank=candidates.findIndex((candidate,i)=>outputs[i]===entry.text||kanaLevel(candidate)===entry.text)+1;
      if(timing)for(let i=1;i<=entry.raw.length;i++){
        const start=performance.now();engine.decode(entry.raw.slice(0,i),entry.options);prefixTimes.push(performance.now()-start);
      }
      rows.push({id:entry.id,group:entry.group,raw:entry.raw,...(entry.options?{options:entry.options}:{}),expected:entry.text,actual:outputs[0]??'',rank,readingRank,
        ...caseMetrics(entry.text, outputs),
        edits:distance(entry.text,outputs[0]??''),characters:[...entry.text].length,reachable:oracle(entry),candidates:outputs});
    }
    const summarize = selected => {
      const annotated=selected.filter(row=>row.reachable!==null);
      return {cases:selected.length,top1:selected.filter(row=>row.rank===1).length,top5:selected.filter(row=>row.rank>0).length,
        readingTop1:selected.filter(row=>row.readingRank===1).length,readingTop5:selected.filter(row=>row.readingRank>0).length,
        characterErrorRate:selected.reduce((n,row)=>n+row.edits,0)/Math.max(1,selected.reduce((n,row)=>n+row.characters,0)),
        reachable:annotated.length?annotated.filter(row=>row.reachable).length:null, ...summarizeMilestone(selected)};
    };
    const groups=Object.fromEntries([...new Set(rows.map(row=>row.group))].map(group=>[group,summarize(rows.filter(row=>row.group===group))]));
    const configurations = new Map();
    for (const row of rows) {
      const options={layout:'colemak',english:true,japanese:true,zhuyin:true,...row.options};
      const key=JSON.stringify([row.group,options.layout,options.english,options.japanese,options.zhuyin]);
      if(!configurations.has(key))configurations.set(key,{group:row.group,options,rows:[]});
      configurations.get(key).rows.push(row);
    }
    const configurationGroups=Object.fromEntries([...configurations].map(([key,value])=>[key,{group:value.group,options:value.options,...summarize(value.rows)}]));
    prefixTimes.sort((a,b)=>a-b);
    report.profiles[profile]={dictionary:engine.dictionarySize(),groups,configurationGroups,...(timing?{instanceCreationMs:initializationMs,prefixLatency:{count:prefixTimes.length,p50Ms:prefixTimes[Math.floor(prefixTimes.length*.5)],p95Ms:prefixTimes[Math.floor(prefixTimes.length*.95)],maxMs:prefixTimes.at(-1)}}:{}),rows};
  } finally {engine.dispose()}
}
const before=report.profiles.prototype.rows,after=report.profiles.expanded.rows;
report.regressions=after.filter((row,i)=>before[i].rank===1&&row.rank!==1).map(row=>row.id);
report.top5Regressions=after.filter((row,i)=>before[i].rank>0&&row.rank===0).map(row=>row.id);
report.readingRegressions=after.filter((row,i)=>before[i].readingRank===1&&row.readingRank!==1).map(row=>row.id);
report.readingTop5Regressions=after.filter((row,i)=>before[i].readingRank>0&&row.readingRank===0).map(row=>row.id);
const lines=['# Chinese, Japanese and mixed-text evaluation','',report.method,'',report.notes,'',...(report.mixedTextNotes?[report.mixedTextNotes,'']:[]),...(report.japaneseWordNotes?[report.japaneseWordNotes,'']:[]),
  '| Profile / group | Top 1 | Top 5 | Reading top 1 | Reading top 5 | Character error rate | Dictionary-reachable |',
  '| --- | --- | --- | --- | --- | --- | --- |'];
for(const [profile,result] of Object.entries(report.profiles))for(const [group,metrics] of Object.entries(result.groups))lines.push(`| ${profile} / ${group} | ${metrics.top1}/${metrics.cases} | ${metrics.top5}/${metrics.cases} | ${metrics.readingTop1}/${metrics.cases} | ${metrics.readingTop5}/${metrics.cases} | ${(metrics.characterErrorRate*100).toFixed(1)}% | ${metrics.reachable??'n/a'} |`);
const percentage=value=>value===null?'n/a':(value*100).toFixed(1)+'%';
lines.push('', '## Milestone metrics by configuration', '', report.milestoneNotes, '',
  '| Profile / group / layout / enabled languages | Top 1 | Top 5 | Space-normalized top 1 | Space-normalized top 5 | English exact | Han CER | Wrong language |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |');
for(const [profile,result] of Object.entries(report.profiles))for(const metrics of Object.values(result.configurationGroups)){
  const languages=['english','japanese','zhuyin'].filter(key=>metrics.options[key]).join('+')||'none';
  lines.push(`| ${profile} / ${metrics.group} / ${metrics.options.layout} / ${languages} | ${metrics.top1}/${metrics.cases} | ${metrics.top5}/${metrics.cases} | ${metrics.spaceNormalizedTop1}/${metrics.cases} | ${metrics.spaceNormalizedTop5}/${metrics.cases} | ${percentage(metrics.englishExact)} (${metrics.englishMatches}/${metrics.englishTokens}) | ${percentage(metrics.hanCER)} (${metrics.hanEdits}/${metrics.hanCharacters}) | ${percentage(metrics.wrongLanguage)} (${metrics.wrongLanguageCases}/${metrics.singleLanguageCases}) |`);
}
lines.push('',`Top-1 regressions: ${report.regressions.join(', ')||'none'} (reading level: ${report.readingRegressions.join(', ')||'none'}).`, `Top-5 regressions: ${report.top5Regressions.join(', ')||'none'} (reading level: ${report.readingTop5Regressions.join(', ')||'none'}).`,'');
if(timing)for(const [profile,result] of Object.entries(report.profiles))lines.push(`${profile}: engine instance ${result.instanceCreationMs.toFixed(1)} ms; prefix decode p50 ${result.prefixLatency.p50Ms.toFixed(2)} ms, p95 ${result.prefixLatency.p95Ms.toFixed(2)} ms (this run; module already loaded).`);
lines.push('','## Remaining expanded-profile errors','');
for(const row of after.filter(row=>row.rank!==1))lines.push(`- ${row.id}: ${row.expected} → ${row.actual} (target rank: ${row.rank||'outside top 5'}; reading-level rank: ${row.readingRank||'outside top 5'}; dictionary reachable: ${row.reachable??'not measured'})`);
if(external||extraModules||timing){console.log(JSON.stringify(report,null,2));}
else {
  await writeFile(new URL('../eval/report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  await writeFile(new URL('../eval/REPORT.md',import.meta.url),lines.join('\n')+'\n');
  console.log(lines.join('\n'));
}
