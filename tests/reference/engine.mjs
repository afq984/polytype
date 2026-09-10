// Public API retained for the demo and decoder consumers.
import { encode } from './keyboard.mjs';
export { colemak, encode, physicalKey } from './keyboard.mjs';
export { zhuyin, readingKeys, readZhuyin } from './zhuyin.mjs';
export { setCustomEntries, dictionarySize } from './dictionaries.mjs';
export { decode, commitCandidate } from './ranking.mjs';
export { composeJapanese, toKatakana } from './japanese.mjs';

export const sample='flldal 2k7u/ jp6g4 dmauu';
export const examples=[{name:'The original',raw:sample},{name:'More vocabulary',raw:'aj4fu06m/4fu3x96c961j6hji4 dk3u3y/ ru8 h6dj4a87?'},{name:'Out of order',raw:'us3lc3 /j5 '},{name:'Replace before tone',raw:'sujo/5 '},{name:'Hello, three languages',raw:encode('hello')+' su3cl3 '+encode('neko')},{name:'A small cat',raw:encode('tiisai')+' '+encode('neko')+' '+encode('small')},{name:'Chinese + English',raw:'su3cl3 '+encode('world')}];
examples.push(
 {name:'Japanese kana',raw:encode('sakura gakkou ryokou')},
 {name:'Katakana alternatives',raw:encode('ko-hi-')},
 {name:'N vs N-apostrophe',raw:encode("shinyou shin'you")},
 {name:'Pending N · try Enter',raw:encode('kan')},
 {name:'Kana + Chinese + English',raw:encode('gakkou')+' us3lc3 '+encode('hello')}
);
