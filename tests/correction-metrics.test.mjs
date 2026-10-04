import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine, encode} from '../web/engine.mjs';
import {correctionEdits, summarizeCorrections} from '../scripts/correction-metrics.mjs';
import {loadEvaluationCases} from '../scripts/evaluation-cases.mjs';

test('bounded correction measures real zero, one and two edit recovery in both layouts', () => {
  const engine=createEngine(),rows=[];
  try{
    for(const layout of ['colemak','qwerty']){
      const roman=text=>layout==='colemak'?encode(text):text,options={layout};
      for(const [raw,text,count] of [[roman('hello'),'hello',0],[roman('gakkou tanaka hello'),'学校 tanaka hello',1],['y94 y94 '+roman('hello'),'再 再 hello',2]]){
        const entry={raw,text,options},correction=correctionEdits(engine,entry);
        assert.equal(correction.edits,count,JSON.stringify(entry));
        assert.equal(correction.bounded,true);assert.ok(correction.statesVisited<=2000);
        // Reading-conditioned counts now retain 再 再 in the ordinary top five.
        // Local correction still requires two choices, independently of that rank.
        assert.equal(correction.wholeCandidateTop5,count!==1);
        let constraints=[];
        for(const action of correction.path){
          constraints=action.op==='choose'?[...constraints.filter(c=>c.start!==action.constraint.start||c.end!==action.constraint.end),action.constraint]:constraints.filter(c=>c.start!==action.start||c.end!==action.end);
        }
        assert.equal(engine.commitCandidate(engine.decodeConstrained(raw,constraints,options)[0]),text);
        rows.push({correction});
      }
    }
    const summary=summarizeCorrections(rows);
    assert.equal(summary.zero,2);assert.equal(summary.atMostOne,4);assert.equal(summary.atMostTwo,6);assert.equal(summary.unresolved,0);assert.equal(summary.wholeCandidateTop5,4);
    const unresolved=correctionEdits(engine,{raw:'y94 hello',text:'unreachable target',options:{layout:'qwerty'}},{stateBudget:5});
    assert.equal(unresolved.edits,null);assert.equal(unresolved.budgetExhausted,true);assert.equal(unresolved.statesVisited,5);
    assert.deepEqual(unresolved.path,[]);
  }finally{engine.dispose()}
});

test('correction evaluation is opt-in and accepts external case-module rows', async () => {
  const row={raw:'y94',text:'再'};
  assert.equal((await loadEvaluationCases(['--correction'],[row])).correction,true);
  assert.equal((await loadEvaluationCases([],[row])).correction,false);
  const engine=createEngine();
  try{
    // Captured locks are replayed by evaluation, but do not get a free edit in BFS.
    assert.equal(correctionEdits(engine,{...row,options:{layout:'qwerty'},constraints:[{start:0,end:3,text:'再',lang:'TW'}]}).edits,1);
  }finally{engine.dispose()}
  const directory=mkdtempSync(join(tmpdir(),'polytype-correction-eval-'));
  try{
    const local=join(directory,'cases.jsonl'),module=join(directory,'extra.mjs');
    writeFileSync(local,JSON.stringify({raw:'hello',text:'hello',options:{layout:'qwerty'}})+'\n');
    writeFileSync(module,'export const cases = '+JSON.stringify([{...row,group:'extra-correction',options:{layout:'qwerty'},constraints:[{start:0,end:3,text:'再',lang:'TW'}]}])+';\n');
    const child=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/evaluate.mjs',import.meta.url)),local,'--extra-cases='+module,'--correction'],{encoding:'utf8',maxBuffer:4*1024*1024});
    assert.equal(child.status,0,child.stderr);
    const report=JSON.parse(child.stdout),extra=report.profiles.expanded.rows[1];
    assert.equal(extra.actual,'再');assert.equal(extra.correction.edits,1);
    assert.equal(report.profiles.expanded.groups['extra-correction'].correction.atMostOne,1);
    assert.equal(report.profiles.prototype.rows[1].constraintsUnsupported,true);
    assert.match(report.correctionNotes,/bounded BFS depth 2/);
  }finally{rmSync(directory,{recursive:true,force:true})}
});
