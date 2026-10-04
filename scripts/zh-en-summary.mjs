// Aggregate-only development diagnostics, using the shared milestone definitions.
import {caseMetrics,summarizeMilestone} from './evaluation-metrics.mjs';
export const reviewStrata=['all','review-pending','automatic'];
export function summarizeZhEnCases(cases,outputsFor) {
  const groups=new Map();
  for(const entry of cases) {
    const outputs=outputsFor(entry).slice(0,5);
    const row={rank:outputs.indexOf(entry.text)+1,...caseMetrics(entry.text,outputs)};
    if(!groups.has(entry.group))groups.set(entry.group,{all:[],'review-pending':[],automatic:[]});
    const group=groups.get(entry.group);
    group.all.push(row);group[entry.review==='pending'?'review-pending':'automatic'].push(row);
  }
  const summarize=rows=>({cases:rows.length,top1:rows.filter(row=>row.rank===1).length,top5:rows.filter(row=>row.rank>0).length,...summarizeMilestone(rows)});
  return {profile:'expanded',cases:cases.length,sourceCases:new Set(cases.map(entry=>entry.sourceId??entry.id)).size,
    groups:Object.fromEntries([...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,strata])=>[name,Object.fromEntries(reviewStrata.map(stratum=>[stratum,summarize(strata[stratum])]))]))};
}
const rate=(value,numerator,denominator)=>`${value===null?'n/a':(value*100).toFixed(2)+'%'} (${numerator}/${denominator})`;
export function renderZhEnSummary(summary,{skippedUnmapped=0}={}) {
  const lines=['# Chinese and English development summary','',
    `Expanded profile; ${summary.cases} configurations from ${summary.sourceCases} selected source utterances/sentences. Unmapped source utterances omitted: ${skippedUnmapped}.`,
    'Regenerate with `bazelisk run //:baseline_zh_en`. Aggregates only; no timings or per-case outputs. These configurations reuse source text and are not independent observations.','',
    'ASCEND/CC-CEDICT targets remain provisional: review-pending needs adjudication; automatic means no issue detected, not human-approved gold. English EWT guards have no reading queue and appear under automatic. The all stratum includes both. See [selection, attribution and limitations](../README.md#chinese--english-development-data).','',
    'Metrics use `scripts/evaluation-metrics.mjs`: exact committed text; space normalization only at Han/Latin or Han/digit boundaries; ordered exact English-token recall; Han-only edit distance; wrong-script intrusion only for single-language targets. Rates pool denominators; n/a means no eligible units. Both top-five measures inspect at most five candidates.','',
    '| Group | Stratum | Cases | Exact top 1 / top 5 | Space-normalized top 1 / top 5 | English exact | Han CER | Wrong language |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  for(const [group,strata] of Object.entries(summary.groups))for(const stratum of reviewStrata) {
    const metrics=strata[stratum];
    lines.push(`| ${group} | ${stratum} | ${metrics.cases} | ${metrics.top1} / ${metrics.top5} | ${metrics.spaceNormalizedTop1} / ${metrics.spaceNormalizedTop5} | ${rate(metrics.englishExact,metrics.englishMatches,metrics.englishTokens)} | ${rate(metrics.hanCER,metrics.hanEdits,metrics.hanCharacters)} | ${rate(metrics.wrongLanguage,metrics.wrongLanguageCases,metrics.singleLanguageCases)} |`);
  }
  lines.push('',
    'The current and target Space contracts are scored separately on the same decoder. Scores for the future target contract describe its current limitations. Review status, layout and enabled languages remain visible in every group; aggregate differences alone do not establish a decoder improvement.',
    'Sourced text and adapted annotations retain CC BY-SA 4.0; the offline OpenCC conversion resources retain Apache-2.0. This summary does not add source text to the runtime dictionaries.','');
  return lines.join('\n');
}
