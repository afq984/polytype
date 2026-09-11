import test from 'node:test';
import assert from 'node:assert/strict';
import {composeJapanese, toKatakana, decode, encode, commitCandidate} from '../web/engine.mjs';

test('romaji composes kana beyond the word dictionary', () => {
  for (const [roman, kana] of [
    ['sakura', 'さくら'], ['shashin', 'しゃしん'], ['syasin', 'しゃしん'],
    ['chizu', 'ちず'], ['tizu', 'ちず'], ['tsuki', 'つき'], ['tuki', 'つき'],
    ['ryokou', 'りょこう'], ['gyuunyuu', 'ぎゅうにゅう'], ['fujisan', 'ふじさん'],
    ['gakkou', 'がっこう'], ['kitte', 'きって'], ['matcha', 'まっちゃ'],
    ['maccha', 'まっちゃ'], ['zasshi', 'ざっし'], ['baggu', 'ばっぐ'],
    ['konnnichiha', 'こんにちは'], ["kon'nichiha", 'こんにちは'],
    ['nna', 'んあ'], ['nnya', 'んや'], ['nnna', 'んな'], ['nnnya', 'んにゃ'],
    ['shinnyou', 'しんよう'], ['konna', 'こんあ'], ['konnna', 'こんな'],
    ['konnyaku', 'こんやく'], ['konnnyaku', 'こんにゃく'],
    ["shin'you", 'しんよう'], ['shinyou', 'しにょう'], ['nn', 'ん'],
    ['kanpai', 'かんぱい'], ['ko-hi-', 'こーひー'], ['fa', 'ふぁ'],
    ['thi', 'てぃ'], ['va', 'ゔぁ'], ['xtsu', 'っ'], ['lya', 'ゃ'],
  ]) {
    assert.equal(composeJapanese(roman, {final: true}).text, kana, roman);
  }
  assert.equal(toKatakana('こーひーゔぁっきゃn'), 'コーヒーヴァッキャn');
});

test('pending consonants survive edits; n resolves only when disambiguated', () => {
  for (const [roman, text, pending] of [
    ['k', 'k', 'k'], ['ky', 'ky', 'ky'], ['kya', 'きゃ', ''],
    ['kak', 'かk', 'k'], ['kakk', 'かっk', 'k'], ['kakka', 'かっか', ''],
    ['kan', 'かn', 'n'], ['kana', 'かな', ''], ['kanya', 'かにゃ', ''],
    ["kan'", 'かん', ''], ['kann', 'かん', ''],
  ]) {
    const result = composeJapanese(roman);
    assert.equal(result.text, text, roman);
    assert.equal(result.pending, pending, roman);
  }
  assert.equal(composeJapanese('kan', {final: true}).text, 'かん');
  assert.equal(composeJapanese('hello').text, 'へっぉ'); // Mozc ll -> っ + l.
  for (const raw of ["ka'", 'abc123', '猫']) assert.equal(composeJapanese(raw), null);
});

test('kana candidates integrate with dictionary, English and exact spaces', () => {
  const candidates = roman => decode(encode(roman)).map(candidate => candidate.text);
  assert.equal(candidates('sakura')[0], 'さくら');
  assert.ok(candidates('sakura').includes('サクラ'));
  assert.equal(candidates('hello')[0], 'hello');
  assert.equal(candidates('neko')[0], '猫');
  assert.ok(candidates('neko').includes('ねこ'));
  assert.ok(candidates('neko').includes('ネコ'));
  assert.equal(candidates('kan  hello!')[0], 'かん  hello!');
  const mixed = encode('gakkou') + ' us3lc3 ' + encode('hello');
  assert.equal(decode(mixed)[0].text, 'がっこう 你好 hello');
  for (let length = 0; length <= mixed.length; length++) {
    assert.ok(decode(mixed.slice(0, length)).length, `prefix ${length}`);
  }
});

test('commit resolves n in the selected script without changing alternatives', () => {
  const candidates = decode(encode('kan'));
  const hiragana = candidates.find(candidate => candidate.text === 'かn');
  const katakana = candidates.find(candidate => candidate.text === 'カn');
  assert.equal(commitCandidate(hiragana), 'かん');
  assert.equal(commitCandidate(katakana), 'カン');
  const english = candidates.find(candidate => candidate.text === 'kan');
  assert.equal(commitCandidate(english), 'kan');
  const mixed = decode(encode('hello kan'));
  // English continuity changes the default, not explicit kana selection.
  assert.equal(commitCandidate(mixed[0]), 'hello kan');
  assert.equal(commitCandidate(mixed.find(candidate=>candidate.text==='hello かn')), 'hello かん');
});
