import { colemak } from './keyboard.mjs';
import { readZhuyin, zhuyin } from './zhuyin.mjs';
import { jp, tw, phrases, english } from './dictionaries.mjs';
import { composeJapanese, toKatakana } from './japanese.mjs';

export function decode(raw){
 raw=raw.slice(0,400); const beams=Array.from({length:raw.length+1},()=>[]);beams[0]=[{text:'',score:0,lang:null,parts:[]}];
 function push(i,state,part,score,lang){let n={text:state.text+part.text,score:state.score+score,lang,parts:[...state.parts,part]};beams[i].push(n);beams[i].sort((a,b)=>b.score-a.score);const seen=new Set();beams[i]=beams[i].filter(x=>{let k=x.text+'|'+x.lang;if(seen.has(k))return false;seen.add(k);return true}).slice(0,12)}
 for(let i=0;i<raw.length;i++)for(const s of beams[i]){
  if('?!？！。，；：'.includes(raw[i])){push(i+1,s,{raw:raw[i],text:raw[i],lang:'punct',note:'Literal punctuation'},0,null);continue}
  if(raw[i]===' ')push(i+1,s,{raw:' ',text:' ',lang:'space',note:'Literal space · language boundary'},-.1,null);
  if(!s.lang||s.lang==='TW'){
   let at=i,keys=[],length=0,readings=[],changes=[];
   for(let count=0;count<12&&at<raw.length;count++){
    const part=readZhuyin(raw,at);if(!part?.complete)break;
    at=part.end;keys.push(part.key);length+=part.key.length;readings.push(zhuyin(part.key));changes.push(...part.changes);
    const phrase=phrases.get(keys.join('|'));
    if(phrase)phrase.texts.forEach((text,n)=>push(at,s,{raw:raw.slice(i,at),text,lang:'TW',note:readings.join(' ')+' · phrase dictionary',changes,complete:true},length*2+keys.length-n*.8,'TW'));
    if(![...phrases.values()].some(p=>p.keys.length>keys.length&&keys.every((k,n)=>p.keys[n]===k)))break;
   }
   const syllable=readZhuyin(raw,i);
   if(syllable){
    const {key,slots,changes,complete,end}=syllable;
    const values=complete?tw[key]:null;
    const note=zhuyin(key)+(complete?(key.endsWith(' ')?' · first tone':' · tone entered'):' · waiting for tone')+(complete&&!values?' · outside demo dictionary':'');
    (values||[zhuyin(key)]).forEach((text,n)=>push(end,s,{raw:raw.slice(i,end),text,lang:'TW',note,slots:slots.map(zhuyin),changes,complete},values?key.length*2-n*.8:slots.filter(Boolean).length*.3,'TW'));
   }
  }
  let end=i;while(end<raw.length&&!(' ?!？！。，；：'.includes(raw[end])))end++;const token=raw.slice(i,end), roman=colemak(token).toLowerCase();
  if(token&&(!s.lang||s.lang==='JP')){
   if(jp[roman])jp[roman].forEach((v,n)=>push(end,s,{raw:token,text:v,lang:'JP',note:roman+' → Japanese'},token.length*2.2-n*.7,'JP'));
   const composition=composeJapanese(roman,{final:end<raw.length});
   if(composition){
    const resolved=composition.pending==='n'?composition.kana+'ん':composition.text;
    const score=(token.length-composition.pending.length)*1.2+composition.pending.length*.2;
    for(const [script,convert,penalty] of [['Hiragana',x=>x,0],['Katakana',toKatakana,.2]]){
     const text=convert(composition.text);
     push(end,s,{raw:token,text,commitText:convert(resolved),lang:'JP',pending:composition.pending,complete:composition.complete,note:roman+' → '+script+(composition.pending?' · waiting for '+composition.pending+'…':'')},score-penalty,'JP');
    }
   }
  }
  if(token&&(!s.lang||s.lang==='EN'))push(end,s,{raw:token,text:colemak(token),lang:'EN',note:english.has(roman)?'Colemak · English dictionary':'Colemak · literal fallback'},english.has(roman)?token.length*2:token.length*.1-2,'EN');
 }
 return beams[raw.length].sort((a,b)=>b.score-a.score).filter((x,i,a)=>a.findIndex(y=>y.text===x.text)===i).slice(0,5);
}

// Commit the chosen path without re-ranking it; pending Japanese n becomes ん/ン.
export function commitCandidate(candidate){return candidate.parts.map(part=>part.commitText??part.text).join('')}
