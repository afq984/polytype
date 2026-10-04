// Deterministic aggregate summary; never adds configurations to eval/report.json.
import {writeFile} from 'node:fs/promises';
import {createEngine} from '../web/engine.mjs';
import {cases,zhEnSkipped} from '../eval/zh-en-cases.mjs';
import {summarizeZhEnCases,renderZhEnSummary} from './zh-en-summary.mjs';
if(process.argv.length>2)throw new Error('Use bazelisk run //:baseline_zh_en');
const engine=createEngine();
try {
  const summary=summarizeZhEnCases(cases,entry=>engine.decode(entry.raw,entry.options).map(candidate=>engine.commitCandidate(candidate)));
  const markdown=renderZhEnSummary(summary,{skippedUnmapped:zhEnSkipped.length});
  await writeFile(new URL('../eval/zh-en/REPORT.md',import.meta.url),markdown);
  console.log(markdown);
} finally {engine.dispose();}
