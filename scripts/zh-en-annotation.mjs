// Offline-only annotation utilities; never imported by the runtime dictionary.
export function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')) {row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[];}}
    else field+=c;
  }
  if(quoted)throw new Error('Unterminated CSV field');
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift();return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
}
export function dictionary(text) {
  return new Map(text.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const [key,values]=l.split('\t');return [key,values.split(' ')];}));
}
export function maximalMatch(map) {
  const trie=new Map();
  for(const [key,value] of map) {
    let node=trie;for(const c of key){if(!node.has(c))node.set(c,new Map());node=node.get(c);}node.set('',value);
  }
  return text=>{
    const chars=[...text], spans=[];
    for(let i=0;i<chars.length;) {
      let node=trie, found;
      for(let j=i;j<chars.length&&node.has(chars[j]);j++){node=node.get(chars[j]);if(node.has(''))found={text:chars.slice(i,j+1).join(''),value:node.get(''),length:j+1-i};}
      const span=found??{text:chars[i],value:null,length:1};spans.push(span);i+=span.length;
    }
    return spans;
  };
}
export function taiwanConverter(inputs) {
  const phrases=dictionary(inputs['opencc-STPhrases.txt']);
  const first=new Map([...dictionary(inputs['opencc-STCharacters.txt']),...phrases]);
  const regional=new Map(['IT','Name','Other'].flatMap(n=>[...dictionary(inputs[`opencc-TWPhrases${n}.txt`])]));
  const stages=[first,regional,dictionary(inputs['opencc-TWVariants.txt'])].map(maximalMatch);
  return text=>{
    const doubts=[];
    for(const [stage,match] of stages.entries())text=match(text).map(span=>{
      if(span.value?.length>1)doubts.push({kind:'conversion-alternatives',stage,character:span.text,candidates:span.value,recommendation:'Review context; provisional OpenCC first alternative.'});
      if(span.value&&[...span.value[0]].length!==span.length)doubts.push({kind:'conversion-length',stage,character:span.text,candidates:span.value,recommendation:'Review Taiwan phrase substitution against original.'});
      return span.value?.[0]??span.text;
    }).join('');
    return {text,doubts};
  };
}
const initials={b:'ㄅ',p:'ㄆ',m:'ㄇ',f:'ㄈ',d:'ㄉ',t:'ㄊ',n:'ㄋ',l:'ㄌ',g:'ㄍ',k:'ㄎ',h:'ㄏ',j:'ㄐ',q:'ㄑ',x:'ㄒ',zh:'ㄓ',ch:'ㄔ',sh:'ㄕ',r:'ㄖ',z:'ㄗ',c:'ㄘ',s:'ㄙ'};
const finals={a:'ㄚ',o:'ㄛ',e:'ㄜ',ê:'ㄝ',ai:'ㄞ',ei:'ㄟ',ao:'ㄠ',ou:'ㄡ',an:'ㄢ',en:'ㄣ',ang:'ㄤ',eng:'ㄥ',er:'ㄦ',i:'ㄧ',ia:'ㄧㄚ',ie:'ㄧㄝ',iao:'ㄧㄠ',iu:'ㄧㄡ',ian:'ㄧㄢ',in:'ㄧㄣ',iang:'ㄧㄤ',ing:'ㄧㄥ',iong:'ㄩㄥ',u:'ㄨ',ua:'ㄨㄚ',uo:'ㄨㄛ',uai:'ㄨㄞ',ui:'ㄨㄟ',uan:'ㄨㄢ',un:'ㄨㄣ',uang:'ㄨㄤ',ong:'ㄨㄥ',ueng:'ㄨㄥ',ü:'ㄩ',üe:'ㄩㄝ',üan:'ㄩㄢ',ün:'ㄩㄣ'};
export function pinyinToZhuyin(input) {
  const match=input.toLowerCase().replaceAll('u:','ü').replaceAll('v','ü').match(/^([a-züê]+)([1-5])$/);
  if(!match)return null;
  let [,base,tone]=match;
  const zero={yi:'i',ya:'ia',yo:'io',ye:'ie',yao:'iao',you:'iu',yan:'ian',yin:'in',yang:'iang',ying:'ing',yong:'iong',yu:'ü',yue:'üe',yuan:'üan',yun:'ün',wu:'u',wa:'ua',wo:'uo',wai:'uai',wei:'ui',wan:'uan',wen:'un',wang:'uang',weng:'ueng'};
  if(zero[base])base=zero[base];
  if(base==='r')base='er';
  const initial=base.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])/u)?.[0]??'';
  let final=base.slice(initial.length);
  if(['j','q','x'].includes(initial)&&final.startsWith('u'))final='ü'+final.slice(1);
  if(['zh','ch','sh','r','z','c','s'].includes(initial)&&final==='i')final='';
  if(!finals[final]&&final!=='')return null;
  const result=(initials[initial]??'')+(finals[final]??'');
  if(!result)return null;
  return result+({'1':'','2':'ˊ','3':'ˇ','4':'ˋ','5':'˙'}[tone]);
}
export function cedictDictionary(text,convert) {
  const map=new Map();
  for(const [index,line] of text.split(/\r?\n/).entries()) {
    const m=line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);if(!m)continue;
    const [,traditional,simplified,pinyin,definition]=m;
    const taiwan=definition.match(/Taiwan pr\.\s*\[([^\]]+)\]/i)?.[1];
    const selected=taiwan??pinyin;
    const tokens=selected.toLowerCase().match(/[a-zü:ê]+[1-5]/g)??[];
    const syllables=tokens.map(pinyinToZhuyin);
    const candidate={pinyin:selected,reading:syllables.every(Boolean)?syllables.join(' '):null,line:index+1,taiwan:!!taiwan};
    // Converted simplified aliases account for Taiwan variants (裏→裡 etc.).
    for(const key of new Set([traditional,convert(simplified).text])) {
      if(!/^\p{Script=Han}+$/u.test(key)||[...key].length!==tokens.length)continue;
      if(!map.has(key))map.set(key,[]);
      const values=map.get(key);if(!values.some(v=>v.pinyin.toLowerCase()===selected.toLowerCase()))values.push(candidate);
    }
  }
  return map;
}
const annotationMatchers=new WeakMap();
export function annotate(text,map,accepted) {
  if(!annotationMatchers.has(map))annotationMatchers.set(map,maximalMatch(map));
  const issues=[], evidence=[], readings=[];
  let offset=0;
  for(const span of annotationMatchers.get(map)(text)) {
    const candidates=span.value??[], usable=candidates.filter(c=>c.reading);
    // Deterministic provisional choice, never influenced by McBopomofo.
    const ranked=[...usable].sort((a,b)=>Number(b.taiwan)-Number(a.taiwan)||Number(/^[A-Z]/.test(a.pinyin))-Number(/^[A-Z]/.test(b.pinyin))||a.line-b.line);
    const chosen=ranked[0];
    if(chosen&&/(?:^|\s)r5(?:$|\s)/i.test(chosen.pinyin))issues.push({kind:'erhua-reading',character:span.text,offset,candidates:[chosen.pinyin,chosen.reading],recommendation:'Review Taiwan citation pronunciation separately from the CC-CEDICT erhua suffix.'});
    if(!chosen)issues.push({kind:'unmapped',character:span.text,offset,candidates:candidates.map(c=>c.pinyin),recommendation:'Supply independent Taiwan citation reading; exclude from generated cases until mapped.'});
    if(candidates.some(c=>!c.reading))issues.push({kind:'unrepresentable-reading',character:span.text,offset,candidates:candidates.filter(c=>!c.reading).map(c=>c.pinyin),recommendation:'Review syllabic or nonstandard pinyin; retain provisional mapped reading only for diagnostics.'});
    if(new Set(usable.map(c=>c.reading)).size>1)issues.push({kind:span.length===1?'polyphone-no-word-evidence':'word-reading-ambiguity',character:span.text,offset,provisionalReading:chosen?.reading??null,candidates:usable.map(c=>`${c.pinyin} (${c.reading})`),recommendation:'Review context; provisional first non-name CC-CEDICT reading, with Taiwan pr. preferred.'});
    evidence.push({text:span.text,offset,candidates,chosen:chosen?.pinyin??null});
    const syllables=chosen?.reading.split(' ')??Array(span.length).fill(null);
    for(const [i,char] of [...span.text].entries()) {
      const acceptedReadings=[...(accepted.get(char)??[])].sort();
      if(syllables[i]&&!acceptedReadings.includes(syllables[i]))issues.push({kind:'dictionary-disagreement',character:char,offset:offset+i,candidates:[syllables[i],...acceptedReadings],recommendation:`Keep independent ${syllables[i]}; review Taiwan reading and evaluated character coverage.`});
    }
    readings.push(...syllables);offset+=span.length;
  }
  return {reading:readings.every(Boolean)?readings.join(' '):null,evidence,issues};
}
