import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('English frequency import pins ranks, vocabulary, morphology and bundled license',()=>{
  const root=new URL('../',import.meta.url), read=path=>readFileSync(new URL(path,root));
  const manifest=JSON.parse(read('data/english-frequency-source.json'));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const data=read('data/english-frequency.bin');
  assert.equal(hash(data),manifest.sha256);
  assert.equal(data.length,manifest.bytes);
  assert.ok(data.length<150000);
  assert.equal(hash(read('data/english.tsv')),manifest.vocabulary.sha256);
  const vocabulary=read('data/english.tsv').toString().trimEnd().split('\n').map(row=>row.split('\t')[0]);
  assert.equal(data.subarray(0,4).toString(),'EFR1');
  assert.equal(data.readUInt32LE(4),vocabulary.length);
  assert.equal(data.readUInt32LE(8),manifest.entries);
  assert.equal(data[12],manifest.format.rankBits);
  assert.equal(data[12],17);
  assert.deepEqual([...data.subarray(13,16)],[0,0,0]);
  const rankStart=16+Math.ceil(vocabulary.length/8),ranks=new Map();
  assert.equal(data.length,rankStart+Math.ceil(manifest.entries*17/8));
  let index=0;
  for (const [wordIndex,word] of vocabulary.entries()) {
    if (!(data[16+(wordIndex>>3)]&(1<<(wordIndex&7)))) continue;
    const bit=index++*17,byte=rankStart+(bit>>3);
    const rank=((data[byte]|(data[byte+1]<<8)|(data[byte+2]<<16))>>>(bit&7))&0x1ffff;
    assert.ok(rank>0 && rank<=manifest.format.maxRank,word);
    ranks.set(word,rank);
  }
  assert.equal(index,manifest.entries);
  // Compare every decoded integer against the importer's pre-packing rank join.
  const canonical=[...ranks].map(([word,rank])=>`${word}\t${rank}\n`).join('');
  assert.equal(hash(canonical),manifest.ranksSha256);
  assert.equal(manifest.ranksSha256,'ba664b6ae7640c466e73f8861dde3640e5e63e3dd951530eac6c5519e86a42b2');
  assert.equal(vocabulary.length-ranks.size,manifest.counts.unranked);
  assert.equal(Object.values(manifest.counts).reduce((a,b)=>a+b,0),vocabulary.length);
  assert.equal(manifest.fallbackRank,200000);
  // Upstream headword rank versus the documented discounted inflection estimate.
  assert.equal(ranks.get('be'),2);
  assert.equal(ranks.get('is'),4);
  assert.equal(ranks.get('was'),4);
  const license=read('data/sources/ecdict/LICENSE');
  assert.equal(hash(license),manifest.inputs.find(input=>input.path==='LICENSE').sha256);
  assert.ok(read('web/dictionary-notices.txt').includes(license));
  assert.ok(!read('scripts/import-english-frequency.mjs').toString().includes('../eval/'));
});
