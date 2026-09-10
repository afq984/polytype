// Compare two built WASM snapshots in alternating order; no host metadata output.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createEngine} from '../web/engine.mjs';
import {cases} from '../eval/cases.mjs';
import {diversityCases} from '../eval/diversity-cases.mjs';
import {islandCases} from '../eval/island-cases.mjs';
if(!process.argv[2])throw new Error('Provide a baseline web/engine.mjs path');
const baseline=await import(pathToFileURL(resolve(process.argv[2])).href);
const engines={baseline:baseline.createEngine(),current:createEngine()};
const inputs=[...cases,...diversityCases,...(process.argv[4]?islandCases:[])].flatMap(row=>Array.from({length:row.raw.length},(_,i)=>({raw:row.raw.slice(0,i+1),options:row.options})));
const measure=name=>{
  const times=[];
  for(const input of inputs){const start=performance.now();engines[name].decode(input.raw,input.options);times.push(performance.now()-start)}
  times.sort((a,b)=>a-b);
  return {p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]};
};
const runs=[];
try{
  const recorded=JSON.parse(await readFile(process.argv[4]??new URL('../eval/diversity-baseline.json',import.meta.url),'utf8'));
  for(const row of recorded.rows){
    const candidates=engines.baseline.decode(row.raw,row.options).map(c=>({text:engines.baseline.commitCandidate(c),score:c.score}));
    const normalize=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='score'?Math.round(v*1e10)/1e10:v));
    assert.deepEqual(normalize(candidates),normalize(row.candidates??row.runs[0].candidates),`Baseline snapshot mismatch: ${row.id}`);
  }
  measure('baseline');measure('current');
  for(let i=0;i<5;i++){
    const run={};for(const name of i%2?['current','baseline']:['baseline','current'])run[name]=measure(name);
    run.p95Ratio=run.current.p95/run.baseline.p95;runs.push(run);
  }
}finally{Object.values(engines).forEach(engine=>engine.dispose())}
const ratios=runs.map(r=>r.p95Ratio).sort((a,b)=>a-b);
const result={notes:'Same-process alternating built-WASM snapshots, five measured rounds after one warmup each. Prefix decode plus JS/JSON transport; excludes initialization and UI rendering. Milliseconds. Not a portable performance guarantee.',prefixes:inputs.length,runs,medianP95Ratio:ratios[2],budgetRatio:1.15};
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
assert.ok(result.medianP95Ratio<=result.budgetRatio,'Median p95 exceeds the frozen sprint budget');
