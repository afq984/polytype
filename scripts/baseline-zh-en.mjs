// Quick development baseline only; does not update the evaluator's reports.
import {createEngine} from '../web/engine.mjs';
import {zhEnCases,englishOnlyCases,zhEnSkipped} from '../eval/zh-en-cases.mjs';
const engine=createEngine(),groups={};
try {
  for(const row of [...zhEnCases,...englishOnlyCases]) {
    const outputs=engine.decode(row.raw,row.options).map(c=>engine.commitCandidate(c));
    const group=groups[row.group]??={cases:0,top1:0,top5:0,spaceNormalizedTop1:0,pending:0};
    group.cases++;group.top1+=Number(outputs[0]===row.text);group.top5+=Number(outputs.includes(row.text));
    group.spaceNormalizedTop1+=Number(outputs[0]?.replaceAll(' ','')===row.text.replaceAll(' ',''));
    group.pending+=Number(row.review==='pending');
  }
  console.log(JSON.stringify({baseline:'Current expanded engine; record the revision alongside these development counts',notes:'Development transcripts; auto-readings with pending review are included and counted. Both layouts/configurations reuse each source utterance.',skippedUnmapped:zhEnSkipped,groups},null,2));
} finally {engine.dispose();}
