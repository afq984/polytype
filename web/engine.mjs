// The browser only adapts events and renders results; all decoding runs in Rust.
import init, { Polytype } from './pkg/polytype.js';
export { physicalKey } from './keyboard.mjs';

const wasmUrl = new URL('./pkg/polytype_bg.wasm', import.meta.url);
const wasmInput = typeof process !== 'undefined' && process.versions?.node
  ? await (await import('node:fs/promises')).readFile(wasmUrl)
  : wasmUrl;
await init({module_or_path: wasmInput});

export function createEngine({dictionary='expanded'} = {}) {
  if(!['expanded','prototype'].includes(dictionary))throw new Error('Unknown dictionary profile');
  const core = new Polytype(dictionary==='prototype');
  const request = (op, fields = {}) => JSON.parse(core.request(JSON.stringify({version: 1, op, ...fields})));
  return {
    decode: (input, options = {}) => request('decode', {input, options}),
    commitCandidate: candidate => request('commitCandidate', {candidate}),
    setCustomEntries: entries => request('setCustomEntries', {entries}),
    dictionarySize: () => request('dictionarySize'),
    readZhuyin: (input, start = 0) => request('readZhuyin', {input, start}),
    readingKeys: input => request('readingKeys', {input}),
    composeJapanese: (input, options = {}) => request('composeJapanese', {input, final: options.final ?? false}),
    toKatakana: input => request('toKatakana', {input}),
    zhuyin: input => request('zhuyin', {input}),
    colemak: input => request('colemak', {input}),
    encode: input => request('encode', {input}),
    dispose: () => core.free(),
  };
}

export const {decode, commitCandidate, setCustomEntries, dictionarySize,
  readZhuyin, readingKeys, composeJapanese, toKatakana, zhuyin, colemak, encode} = createEngine();

export const sample='flldal 2k7u/ jp6g4 dmauu';
export function examplesForLayout(layout='colemak') {
const encodeRoman=layout==='qwerty'?text=>text:encode;
const examples=[{name:'The original',raw:encodeRoman('tiisai')+' 2k7u/ jp6g4 '+encodeRoman('small')},{name:'More vocabulary',raw:'aj4fu06m/4fu3x96c961j6hji4 dk3u3y/ ru8 h6dj4a87?'},{name:'Out of order',raw:'us3lc3 /j5 '},{name:'Replace before tone',raw:'sujo/5 '},{name:'Hello, three languages',raw:encodeRoman('hello')+' su3cl3 '+encodeRoman('neko')},{name:'A small cat',raw:encodeRoman('tiisai')+' '+encodeRoman('neko')+' '+encodeRoman('small')},{name:'Chinese + English',raw:'su3cl3 '+encodeRoman('world')}];
examples.push(
 {name:'Japanese kana',raw:encodeRoman('sakura gakkou ryokou')},
 {name:'Katakana alternatives',raw:encodeRoman('ko-hi-')},
 {name:'N vs N-apostrophe',raw:encodeRoman("shinyou shin'you")},
 {name:'Pending N · try Enter',raw:encodeRoman('kan')},
 {name:'Kana + Chinese + English',raw:encodeRoman('gakkou')+' us3lc3 '+encodeRoman('hello')}
);
examples.push({name:'Expanded Chinese dictionary',raw:readingKeys('ㄗ ㄌㄧㄠˋ ㄎㄨˋ').join('')+' '+encodeRoman('hello')});
return examples;
}
export const examples=examplesForLayout();
