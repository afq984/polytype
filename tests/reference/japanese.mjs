// Romaji composition is independent of physical keyboard layout and vocabulary.
const kanaTable = Object.create(null);
const vowels = 'aiueo';
for (const [row, kana] of Object.entries({
  '': 'あいうえお', k: 'かきくけこ', g: 'がぎぐげご',
  s: 'さしすせそ', z: 'ざじずぜぞ', t: 'たちつてと', d: 'だぢづでど',
  n: 'なにぬねの', h: 'はひふへほ', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ',
  m: 'まみむめも', r: 'らりるれろ', v: ['ゔぁ', 'ゔぃ', 'ゔ', 'ゔぇ', 'ゔぉ'],
})) {
  [...kana].forEach((value, index) => { kanaTable[row + vowels[index]] = value; });
}
Object.assign(kanaTable, {
  shi: 'し', chi: 'ち', tsu: 'つ', fu: 'ふ', ji: 'じ',
  ya: 'や', yu: 'ゆ', yo: 'よ', wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', ye: 'いぇ',
  she: 'しぇ', che: 'ちぇ', je: 'じぇ', tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  thi: 'てぃ', dhu: 'でゅ', dhi: 'でぃ', thu: 'てゅ', twu: 'とぅ', dwu: 'どぅ',
});
for (const [prefix, base] of Object.entries({
  ky: 'き', gy: 'ぎ', sy: 'し', sh: 'し', zy: 'じ', jy: 'じ', j: 'じ',
  ty: 'ち', ch: 'ち', cy: 'ち', dy: 'ぢ', ny: 'に', hy: 'ひ', by: 'び',
  py: 'ぴ', my: 'み', ry: 'り', fy: 'ふ', vy: 'ゔ',
})) {
  for (const [vowel, small] of Object.entries({a: 'ゃ', u: 'ゅ', o: 'ょ'})) {
    kanaTable[prefix + vowel] = base + small;
  }
}
for (const prefix of ['x', 'l']) {
  for (const [roman, kana] of Object.entries({
    a: 'ぁ', i: 'ぃ', u: 'ぅ', e: 'ぇ', o: 'ぉ', ya: 'ゃ', yu: 'ゅ', yo: 'ょ',
    tu: 'っ', tsu: 'っ', wa: 'ゎ', ka: 'ゕ', ke: 'ゖ',
  })) kanaTable[prefix + roman] = kana;
}
const kanaPrefixes = new Set(Object.keys(kanaTable).flatMap(key =>
  Array.from({length: key.length - 1}, (_, index) => key.slice(0, index + 1))));

export function toKatakana(text) {
  return text.replace(/[ぁ-ゖ]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

// Return null for invalid romaji so English and Zhuyin can still compete.
// A trailing consonant stays visible; only terminal n resolves at a boundary.
export function composeJapanese(roman, {final = false} = {}) {
  const input = roman.toLowerCase();
  let kana = '', pending = '', offset = 0;
  while (offset < input.length) {
    const rest = input.slice(offset);
    if (rest[0] === 'n') {
      if (rest === 'n') {
        if (final) kana += 'ん';
        else pending = 'n';
        break;
      }
      if (rest[1] === "'") { kana += 'ん'; offset += 2; continue; }
      if (rest[1] === 'n') {
        kana += 'ん';
        // Keep the second n as the onset in nna/nnya, but accept terminal nn.
        offset += rest.length > 2 && /[aiueoy]/.test(rest[2]) ? 1 : 2;
        continue;
      }
      if (/[a-z]/.test(rest[1]) && !/[aiueoy]/.test(rest[1])) {
        kana += 'ん'; offset++; continue;
      }
    }
    if ((rest[0] === rest[1] && /[bcdfghjkpqrstvwxyz]/.test(rest[0])) || rest.startsWith('tch')) {
      kana += 'っ'; offset++; continue;
    }
    if (rest[0] === '-' && kana) { kana += 'ー'; offset++; continue; }
    let match = '';
    for (let length = Math.min(4, rest.length); length > 0; length--) {
      if (Object.hasOwn(kanaTable, rest.slice(0, length))) { match = rest.slice(0, length); break; }
    }
    if (match) { kana += kanaTable[match]; offset += match.length; continue; }
    if (kanaPrefixes.has(rest)) { pending = rest; break; }
    return null;
  }
  return {text: kana + pending, kana, pending, complete: !pending};
}
