const zkeys='1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-'; const zvals=[...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ'];
export const zhuyin=s=>[...s].map(x=>({'6':'ˊ','3':'ˇ','4':'ˋ','7':'˙',' ':'ˉ'}[x]||zvals[zkeys.indexOf(x)]||x)).join('');
// Dictionary readings are standard Zhuyin, independent of the user's keyboard.
export function readingKeys(reading){
 if(typeof reading!=='string'||reading.length>180)throw new Error('請輸入注音讀音（最多 180 字元）。');
 const syllables=reading.trim().split(/\s+/);
 if(!reading.trim()||syllables.length>12)throw new Error('請輸入 1–12 個音節，以空格分隔。');
 return syllables.map(syllable=>{
  let tone=' ',body=syllable;
  const tones={'ˊ':'6','ˇ':'3','ˋ':'4','˙':'7','ˉ':' '};
  if(body.startsWith('˙')){tone='7';body=body.slice(1)}
  if(Object.hasOwn(tones,body.at(-1))){if(tone!==' ')throw new Error('每個音節只能有一個聲調。');tone=tones[body.at(-1)];body=body.slice(0,-1)}
  if(!body)throw new Error('音節不能只有聲調。');
  const slots=['','',''];
  for(const symbol of body){const i=zvals.indexOf(symbol);if(i<0)throw new Error('請使用注音符號，例如：ㄘˊ ㄎㄨˋ');const category=i<21?0:i<24?1:2;if(slots[category])throw new Error('詞條讀音的每個音節只能有一個聲母、介音及韻母。');slots[category]=zkeys[i]}
  return slots.join('')+tone;
 });
}
// One slot per phonetic category. A tone freezes the current syllable.
export function readZhuyin(raw,start=0){
 const slots=['','',''], changes=[];
 const labels=['聲母','介音','韻母'];
 for(let end=start;end<raw.length;end++){
  const key=raw[end];
  if('6347 '.includes(key)){
   if(!slots.some(Boolean))return null;
   return {end:end+1,key:slots.join('')+key,slots:[...slots],changes,complete:true};
  }
  const index=zkeys.indexOf(key);
  if(index<0)return null;
  const category=index<21?0:index<24?1:2;
  if(slots[category] && slots[category]!==key)changes.push(labels[category]+': '+zhuyin(slots[category])+' → '+zhuyin(key));
  slots[category]=key;
 }
 return slots.some(Boolean)?{end:raw.length,key:slots.join(''),slots,changes,complete:false}:null;
}
