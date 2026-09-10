import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as reference from './reference/engine.mjs';
import * as wasm from '../web/engine.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/acceptance.json', import.meta.url)));
const lexicon = JSON.parse(readFileSync(new URL('../data/lexicon.json', import.meta.url)));
const kana = JSON.parse(readFileSync(new URL('../data/kana.json', import.meta.url)));
const normalize = value => JSON.parse(JSON.stringify(value, (key, val) => key === 'score' ? Math.round(val * 1e10) / 1e10 : val));
const cases = new Set(['', ' ', '  ', '?!', '中文', '🙂', 'HELLO', "'", ' '.repeat(401), 'a'.repeat(401)]);
for (const {raw} of reference.examples) for (let i = 0; i <= raw.length; i++) cases.add(raw.slice(0, i));
for (const [reading] of lexicon.chinese) cases.add(reference.readingKeys(reading).join(''));
for (const roman of Object.keys(kana)) {
  cases.add(reference.encode(roman));
  cases.add(reference.encode(roman + 'n'));
}
let seed = 12345;
const alphabet = "abcdefghijklmnopqrstuvwxyz123467890 ,./;?!'-";
for (let n = 0; n < 750; n++) {
  let raw = '';
  for (let i = 0; i < n % 45; i++) { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; raw += alphabet[seed % alphabet.length]; }
  cases.add(raw);
}

test('shared acceptance fixtures run through WASM', () => {
  for (const fixture of fixtures) {
    const raw = fixture.raw ?? wasm.encode(fixture.roman);
    assert.equal(wasm.decode(raw)[0].text, fixture.text, raw);
  }
});

test('JavaScript reference, native Rust and WASM produce equivalent full candidates', () => {
  const baseline = wasm.createEngine({dictionary:'prototype'});
  const requests = [];
  const expected = [];
  const custom = [{reading:'ㄎㄜ ㄐㄧˋ',text:'科技'}, {reading:'ㄋㄧˇ',text:'倪'}, {reading:'ㄋㄧˇ ㄏㄠˇ ㄇㄚ˙',text:'你好嗎'}];
  const inputs = [...cases, 'kd ur4', 'us3lc3a87'];
  for (const entries of [[], custom, []]) {
    reference.setCustomEntries(entries);
    baseline.setCustomEntries(entries);
    requests.push({version:1, op:'setCustomEntries', entries});
    expected.push(entries);
    for (const raw of inputs) {
      const result = reference.decode(raw);
      assert.deepEqual(normalize(baseline.decode(raw)), normalize(result), `WASM ${JSON.stringify(raw)}`);
      requests.push({version:1, op:'decode', input:raw});
      expected.push(result);
    }
  }
  const native = fileURLToPath(new URL('../target/debug/polytype-json' + (process.platform === 'win32' ? '.exe' : ''), import.meta.url));
  const child = spawnSync(native, ['--prototype'], {
    input: requests.map(request=>JSON.stringify(request)).join('\n')+'\n',
    encoding:'utf8', maxBuffer:128*1024*1024,
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const results = child.stdout.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(results.length, expected.length);
  results.forEach((result,index)=>assert.deepEqual(normalize(result.ok), normalize(expected[index]), `native ${JSON.stringify(requests[index])}`));
  console.log(`Parity: ${inputs.length} inputs × three dictionary states; full candidate order, scores and traces`);
  baseline.dispose();
});

test('WASM instances isolate custom dictionaries and reject invalid replacement', () => {
  const first = wasm.createEngine(), second = wasm.createEngine();
  try {
    first.setCustomEntries([{reading:'ㄎㄜ ㄐㄧˋ',text:'科技'}]);
    assert.equal(first.decode('kd ur4')[0].text, '科技');
    for (const entries of [null, [{reading:'bad',text:'bad'}], [{reading:'ㄎㄜ',text:'🙂'.repeat(21)}], Array(201).fill({reading:'ㄎㄜ',text:'科'})]) {
      assert.throws(()=>first.setCustomEntries(entries));
      assert.equal(first.dictionarySize().custom, 1);
    }
    assert.equal(second.dictionarySize().custom, 0);
    assert.equal(first.decode('kd ur4')[0].text, '科技');
  } finally { first.dispose(); second.dispose(); }
});
