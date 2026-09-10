import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../eval/',import.meta.url);
const before=JSON.parse(await readFile(new URL('diversity-baseline.json',root),'utf8'));
const after=JSON.parse(await readFile(new URL('diversity-after.json',root),'utf8'));
if(before.controlsSha256!==after.controlsSha256||before.rows.length!==after.rows.length)throw new Error('Mismatched diagnostic inputs');
const regressions=[];const recoveries=[];const changes=[];
before.rows.forEach((row,i)=>{
  const next=after.rows[i];if(row.id!==next.id)throw new Error('Mismatched row order');
  const b=row.runs[0],a=next.runs[0];
  if(row.group!=='diversity-ambiguous'&&((b.exactRank===1&&a.exactRank!==1)||(b.rank&&!a.rank)))regressions.push(row.id);
  if(!b.rank&&a.rank)recoveries.push(row.id);
  if(b.candidates[0]?.text!==a.candidates[0]?.text)changes.push({id:row.id,before:b.candidates[0]?.text,after:a.candidates[0]?.text});
});
const lines=['# Candidate-diversity results','',after.notes,'',`Controls SHA-256: ${after.controlsSha256}`,'',
  '| Group | Baseline exact top 1 / top 5 | Family-diverse exact top 1 / top 5 | Cases |',
  '| --- | --- | --- | --- |'];
for(const group of new Set(before.rows.map(row=>row.group))){
  const count=report=>{const rows=report.rows.filter(row=>row.group===group);return `${rows.filter(r=>r.runs[0].exactRank===1).length} / ${rows.filter(r=>r.runs[0].exactRank).length}`};
  lines.push(`| ${group} | ${count(before)} | ${count(after)} | ${before.rows.filter(r=>r.group===group).length} |`);
}
lines.push('',`Lost previously correct top-one or acceptable top-five targets (excluding ambiguous probes): ${regressions.join(', ')||'none'}.`,
  `Recovered acceptable top-five targets: ${recoveries.join(', ')||'none'}.`,'','## Changed top-one output','');
for(const row of changes)lines.push(`- ${row.id}: ${row.before} → ${row.after}`);
lines.push('','## Unresolved exact top-one targets','',
  'Classification describes acceptable top-five availability across finite widths, not proof of reachability. An available target can still rank below first. Wider-search results do not change the shipping width of 12.','');
for(const row of after.rows.filter(row=>row.runs[0].exactRank!==1)){
  lines.push(`- ${row.id}: ${row.classification}; displayed exact rank ${row.runs[0].exactRank??'absent'}; actual: ${row.runs[0].candidates[0]?.text??'(empty)'}. Widths ${row.runs.map(r=>`${r.width}: displayed ${r.rank??'absent'}, lattice ${r.latticeRank??'absent'}`).join('; ')}.`);
}
lines.push('','## Mixed-case displayed families','', '| Case | Before | After |','| --- | --- | --- |');
before.rows.forEach((row,i)=>{if(row.id.startsWith('mixed-03-')||row.id.startsWith('mixed-06-'))lines.push(`| ${row.id} | ${row.runs[0].displayedFamilies} | ${after.rows[i].runs[0].displayedFamilies} |`)});
await writeFile(new URL('diversity-report.md',root),lines.join('\n')+'\n');
console.log(JSON.stringify({regressions,recoveredTopFive:recoveries,changedTopOne:changes.length}));
if(regressions.length)process.exitCode=1;
