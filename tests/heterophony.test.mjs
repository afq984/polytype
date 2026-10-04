import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readingCounter} from '../scripts/chinese-readings.mjs';
import {createEngine,rankingId} from '../web/engine.mjs';
import {realCases} from '../eval/cases.mjs';

test('heterophony mirrors upstream base-10 arithmetic, floors and last-row semantics',()=>{
  const count=readingCounter(['會 ㄏㄨㄟˋ\n率 ㄌㄩˋ\n著 ㄓㄜ˙','率 ㄕㄨㄞˋ\n著 ㄓㄠ','著 ㄓㄠˊ\n著 ㄓㄨˋ\n著 ㄓㄨㄛˊ'],40_000_000);
  const floor=40_000_000*10**-6.8;
  assert.equal(count('會','ㄏㄨㄟˋ',96739),96739);
  assert.equal(count('會','ㄎㄨㄞˋ',96739),floor);
  assert.ok(Math.abs(count('率','ㄕㄨㄞˋ',6973)-1413.4240757159025)<1e-9);
  assert.equal(count('率','ㄕㄨㄞˋ',1),floor);
  assert.ok(Math.abs(count('著','ㄓㄨㄛˊ',1000)-41.08711417274323)<1e-9);
  assert.equal(count('著','ㄓㄠˊ',1000),floor,'duplicate tertiary key uses the last row');
  assert.equal(count('快','ㄎㄨㄞˋ',8963),8963,'character outside primary list is unchanged');
  assert.equal(count('會議','ㄏㄨㄟˋ ㄧˋ',123),123,'phrases retain their surface counts');
});

test('imported reading counts distinguish common and rare pronunciations',()=>{
  const rows=new Map(readFileSync(new URL('../data/chinese.tsv',import.meta.url),'utf8').trim().split('\n').map(line=>{const [reading,text,count]=line.split('\t');return [reading+'\t'+text,Number(count)]}));
  const source=JSON.parse(readFileSync(new URL('../data/chinese-source.json',import.meta.url)));
  assert.equal(rows.get('ㄏㄨㄟˋ\t會'),96739);
  assert.equal(rows.get('ㄎㄨㄞˋ\t會'),source.readingCounts.defaultCount);
  assert.equal(rows.get('ㄧㄡˋ\t有'),source.readingCounts.defaultCount);
  assert.equal(rows.get('ㄨㄟˋ\t為'),90777*source.readingCounts.secondaryMultiplier);
  assert.equal(source.readingCounts.historicalSingleCounts['會'],96739);
  assert.equal(source.phrases,40000);
  assert.equal(source.singles,8184);
});

test('quick feedback converts in both layouts while custom readings retain precedence',()=>{
  assert.ok(rankingId.endsWith('+heterophony-v1'));
  const engine=createEngine();
  try {
    for(const layout of ['qwerty','colemak'])for(const japanese of [false,true]) {
      const options={layout,japanese};
      assert.equal(engine.decode('u/ e9 dj94xk7187',options)[0].text,'應該快了吧');
      assert.equal(engine.decode('dj94',{...options,english:false})[0].text,'快');
      assert.equal(engine.decode(engine.readingKeys('ㄓㄨㄥ ㄋㄟˋ').join(''),options)[0].text,'中內');
    }
    engine.setCustomEntries([{reading:'ㄎㄨㄞˋ',text:'會'}]);
    assert.equal(engine.decode('dj94',{english:false,japanese:false})[0].text,'會');
    engine.setCustomEntries([]);
    assert.equal(engine.decode('dj94',{english:false,japanese:false})[0].text,'快');
  }finally{engine.dispose()}
});

// Preserve the supplied target, never accept 訝熱帶 as its replacement.
test('GSD 04: 亞熱帶 with the Taiwan citation ㄧㄚˋ reading remains recoverable',
  {todo:'GSD uses citation ㄧㄚˋ; the owner types ㄧㄚˇ, matching upstream primary. Citation target remains a known top-one/top-five limitation.'},()=>{
    const row=realCases.find(row=>row.id==='gsd-04'),engine=createEngine();
    try {
      const found=['qwerty','colemak'].map(layout=>engine.decode(row.raw,{layout}).some(c=>engine.commitCandidate(c)===row.text));
      assert.deepEqual(found,[true,true]);
    }finally{engine.dispose()}
  });
