// Native ablations with a frozen family-v1 baseline; no host metadata emitted.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {cases} from '../eval/cases.mjs';
import {diversityCases} from '../eval/diversity-cases.mjs';
import {islandCases} from '../eval/island-cases.mjs';
import {colemak} from '../web/engine.mjs';
const previous=[...cases,...diversityCases];
const prefixes=islandCases.filter(r=>r.chinese).flatMap(r=>Array.from({length:r.raw.length},(_,i)=>({...r,id:r.id+`-prefix-${i+1}`,raw:r.raw.slice(0,i+1),prefix:true})));
const rows=[...previous,...islandCases,...prefixes];
const input=rows.map(r=>JSON.stringify({raw:r.raw,options:r.options,width:12})).join('\n')+'\n';
const policies=['baseline','floor','discards','identifiers','floor+discards','floor+identifiers','floor+discards+identifiers','first-tone','floor+first-tone'];
const runs={};
for(const policy of policies){
  const p=spawnSync('target/release/polytype-search',[`--experiment=${policy}`],{input,encoding:'utf8',maxBuffer:64e6});
  if(p.status!==0)throw new Error(p.stderr);
  runs[policy]=p.stdout.trim().split('\n').map(line=>{
    const r=JSON.parse(line);if(r.error)throw new Error(r.error);
    return r.ok.candidates.map(c=>({text:c.parts.map(p=>p.commitText??p.text).join(''),score:c.score}));
  });
}
const baselinePath=new URL('../eval/island-baseline.json',import.meta.url);
if(process.argv.includes('--freeze')){
  if(existsSync(baselinePath))throw new Error('Refusing to overwrite the frozen baseline');
  writeFileSync(baselinePath,JSON.stringify({notes:'Frozen family-v1 baseline, before selecting an experiment. Synthetic controls and user feedback, not held-out gold.',rows:rows.map((r,i)=>({...r,candidates:runs.baseline[i]}))},null,2)+'\n');
}
const frozen=JSON.parse(readFileSync(baselinePath));
if(JSON.stringify(frozen.rows.map(({candidates,...r})=>r))!==JSON.stringify(rows)||JSON.stringify(frozen.rows.map(r=>r.candidates))!==JSON.stringify(runs.baseline))throw new Error('Frozen baseline mismatch');
const results=policies.map(policy=>{
  const before=runs.baseline,after=runs[policy];
  const regressions=[],changes=[],prefixChanges=[],islands=[];
  rows.forEach((r,i)=>{
    const b=before[i].map(c=>c.text),a=after[i].map(c=>c.text),accepted=[r.text,...(r.alternatives??[])];
    if(i<previous.length && r.group!=='diversity-ambiguous'){
      if(b[0]===r.text&&a[0]!==r.text)regressions.push({id:r.id,kind:'top1',before:b[0],after:a[0]});
      if(b.some(t=>accepted.includes(t))&&!a.some(t=>accepted.includes(t)))regressions.push({id:r.id,kind:'top5'});
    }
    if(b[0]!==a[0]) (r.prefix?prefixChanges:changes).push({id:r.id,before:b[0],after:a[0]});
    const literal=r.options?.layout==='qwerty'?r.raw:colemak(r.raw);
    const target=r.id==='capture-b'||r.id.startsWith('tone-boundary-')?'跟claude':r.id==='capture-b-separated'?'跟 claude':r.island;
    if(r.island&&!r.prefix)islands.push({id:r.id,boundary:r.boundary??false,before:b.findIndex(t=>t!==literal&&t.includes(target))+1,after:a.findIndex(t=>t!==literal&&t.includes(target))+1,top1:a[0]});
  });
  return {policy,regressions,changes,prefixChanges,islands};
});
writeFileSync(new URL('../eval/island-experiments.json',import.meta.url),JSON.stringify({notes:'Independent and combined native beam-12 ablations. First-tone is diagnostic-only. Rank zero means absent. Prefix changes include incomplete phonetics, not automatic errors.',cases:rows.length,results},null,2)+'\n');
for(const r of results)console.log(JSON.stringify({policy:r.policy,regressions:r.regressions,changes:r.changes.length,prefixChanges:r.prefixChanges.length,islandsTop1:r.islands.filter(i=>!i.boundary&&i.after===1).length,captures:r.islands.slice(0,3)}));
