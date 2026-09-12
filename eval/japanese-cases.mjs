// Japanese word-conversion cases from the pinned UD Japanese GSD test file.
// Readings are UniDic kana annotations; a single conventional romaji spelling
// is derived here and validated by composing it back through the engine.
import {readFileSync} from 'node:fs';
import {composeJapanese} from '../web/engine.mjs';
export const japaneseCorpus = JSON.parse(readFileSync(new URL('./japanese-words.json', import.meta.url)));
export const katakanaToHiragana = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const digraphs = {
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo','じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo','ぢゃ':'dya','ぢゅ':'dyu','ぢょ':'dyo',
  'てぃ':'thi','でぃ':'dhi','てゅ':'thu','でゅ':'dhu','とぅ':'twu','どぅ':'dwu','ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo',
  'ふゅ':'fyu','うぃ':'wi','うぇ':'we','うぉ':'who','ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','しぇ':'she','じぇ':'je',
  'ちぇ':'che','つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso','いぇ':'ye','くぁ':'kwa','ぐぁ':'gwa',
};
const singles = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su',
  'せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu',
  'よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'wo','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge',
  'ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'di','づ':'du','で':'de','ど':'do','ば':'ba',
  'び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ゔ':'vu','ー':'-',
  'ぁ':'xa','ぃ':'xi','ぅ':'xu','ぇ':'xe','ぉ':'xo','ゃ':'xya','ゅ':'xyu','ょ':'xyo','ゎ':'xwa','ゐ':'wyi','ゑ':'wye',
};
export function romajiForKana(hiragana) {
  const chars = [...hiragana];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const pair = digraphs[chars[i] + (chars[i + 1] ?? '')];
    if (pair) { out += pair; i++; continue; }
    const c = chars[i];
    if (c === 'ん') { out += 'nn'; continue; }
    if (c === 'っ') {
      const next = digraphs[(chars[i + 1] ?? '') + (chars[i + 2] ?? '')] ?? singles[chars[i + 1] ?? ''];
      if (next && /^[bcdfghjkmprstvwz]/.test(next)) { out += next[0]; continue; }
      out += 'xtsu';
      continue;
    }
    if (!(c in singles)) throw new Error(`Unsupported kana in reading: ${c}`);
    out += singles[c];
  }
  return out;
}
export const japaneseCases = japaneseCorpus.cases.flatMap(entry => {
  const kana = katakanaToHiragana(entry.reading);
  const raw = romajiForKana(kana);
  const composed = composeJapanese(raw, {final: true});
  if (composed?.kana !== kana) throw new Error(`Romaji round trip failed for ${entry.id}: ${raw} → ${composed?.kana}`);
  return [['jp', {layout:'qwerty', english:false, japanese:true, zhuyin:false}], ['all', {layout:'qwerty', english:true, japanese:true, zhuyin:true}]]
    .map(([name, options]) => ({...entry, kana, id:`${entry.id}-${name}`, group:`japanese-words-${name}`, raw, options}));
});
