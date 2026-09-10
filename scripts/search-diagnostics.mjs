// A bounded native experiment, not an oracle or a browser feature.
import {spawnSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cases} from '../eval/cases.mjs';
import {diversityCases} from '../eval/diversity-cases.mjs';

const rows=[...cases,...diversityCases];
const widths=[12,48,192];
const requests=rows.flatMap(row=>widths.map(width=>({raw:row.raw,options:row.options??{},width})));
const baseline=process.argv.includes('--baseline');
const result=spawnSync(fileURLToPath(new URL('../target/release/polytype-search',import.meta.url)),baseline?['--baseline']:[],{
  input:requests.map(row=>JSON.stringify(row)).join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024,
});
if(result.status!==0)throw new Error(result.stderr||String(result.error));
const answers=result.stdout.trim().split('\n').map(line=>{
  const value=JSON.parse(line);if(value.error)throw new Error(value.error);return value.ok;
});
if(answers.length!==requests.length)throw new Error('Diagnostic response count mismatch');
const commit=c=>c.parts.map(p=>p.commitText??p.text).join('');
const report={controlsSha256:createHash('sha256').update(await readFile(new URL('../eval/diversity-controls.json',import.meta.url))).digest('hex'),
  policy:baseline?'baseline':'family-diverse',
  notes:'Frozen synthetic controls plus existing diagnostic cases. Width 192 is finite, not an oracle. Alternative-aware ranks are reported separately from exact target ranks. Full lattice excludes the independent literal fallback; displayed candidates include it.',
  rows:rows.map((row,index)=>{
    const accepted=[row.text,...(row.alternatives??[])];
    const runs=widths.map((width,i)=>{
      const answer=answers[index*widths.length+i],candidates=answer.candidates.map(c=>({text:commit(c),score:c.score}));
      const rank=texts=>{const at=texts.findIndex(t=>accepted.includes(t));return at<0?null:at+1};
      const families=answer.lattice.map(c=>c.family);
      return {width,candidates,rank:rank(candidates.map(c=>c.text)),exactRank:candidates.findIndex(c=>c.text===row.text)+1||null,
        latticeRank:rank(answer.lattice.map(c=>c.text)),latticeSize:answer.lattice.length,
        distinctFamilies:new Set(families).size,topFiveFamilies:new Set(families.slice(0,5)).size,displayedFamilies:answer.displayedFamilies};
    });
    const baseline=runs[0],wider=runs.slice(1);
    const classification=baseline.rank?'available':wider.some(r=>r.rank)?'recovered-in-wider-top-five':runs.some(r=>r.latticeRank)?'found-below-displayed-five':'not-found-within-tested-limits';
    return {id:row.id,group:row.group,raw:row.raw,options:row.options??{},expected:row.text,alternatives:row.alternatives??[],classification,runs};
  })};
const output=process.argv[2];
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
const counts={};for(const row of report.rows)counts[row.classification]=(counts[row.classification]??0)+1;
console.log(JSON.stringify({controlsSha256:report.controlsSha256,cases:rows.length,classifications:counts},null,2));
for(const row of report.rows.filter(r=>r.classification!=='available'))console.log(row.id,row.classification,row.runs.map(r=>`${r.width}: top=${r.rank??'-'} lattice=${r.latticeRank??'-'} families=${r.distinctFamilies}/${r.latticeSize}`).join('; '));
