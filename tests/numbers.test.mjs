import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,numericSentences,chineseControls} from '../eval/numbers-cases.mjs';

test('numeric development annotations cover the declared contracts and layouts',()=>{
  assert.equal(numericSentences.length,144);
  assert.equal(chineseControls.length,48);
  assert.equal(cases.length,1536);
  assert.equal(new Set(cases.map(row=>row.id)).size,cases.length);
  for(const entry of [...numericSentences,...chineseControls]){
    const rows=cases.filter(row=>row.sourceId===entry.id);
    assert.equal(rows.length,8,entry.id);
    for(const segment of entry.segments.filter(s=>s.lang==='zh')){
      assert.equal(segment.reading.split(/\s+/).length,[...segment.text].length,entry.id);
    }
    for(const row of rows){
      assert.ok(row.raw.length<=400,row.id);
      assert.equal(row.provenance,'hand-authored synthetic development');
    }
  }
});
