// Corpus-only review data. No decoder or evaluated-dictionary lookup is used.
function keys(value,allowed,label) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid ${label}`);
  for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`Unknown ${label} key: ${key}`);
}
export function validateAdjudications(data,caseIds) {
  keys(data,['version','reviewer','date','conventions','typingConventions','cases'],'adjudication');
  if(data.version!==1||data.reviewer!=='codex-gpt-6.1-sol'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||new Date(data.date).toISOString().slice(0,10)!==data.date)throw new Error('Invalid review provenance');
  keys(data.conventions,['sandhi','neutralTone','thirdTone'],'convention');
  if(data.conventions.sandhi!=='citation-only'||data.conventions.thirdTone!=='citation-no-sandhi'||typeof data.conventions.neutralTone!=='string')throw new Error('Unknown reading convention');
  if(data.typingConventions!==undefined) {
    if(!Array.isArray(data.typingConventions))throw new Error('Invalid typing conventions');
    const seen=new Set();
    for(const convention of data.typingConventions) {
      keys(convention,['character','from','reading','reviewer','date','reason'],'typing convention');
      const {character,from,reading,reviewer,date,reason}=convention;
      if(!/^\p{Script=Han}$/u.test(character)||!/^([ㄅ-ㄩ]+[ˊˇˋ˙]?)$/u.test(from)||!/^([ㄅ-ㄩ]+[ˊˇˋ˙]?)$/u.test(reading)||from===reading)throw new Error('Invalid typing reading');
      if(reviewer!=='user'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date||typeof reason!=='string'||!reason.trim())throw new Error('Invalid typing provenance');
      const key=`${character}/${from}`;
      if(seen.has(key))throw new Error('Duplicate typing convention');
      seen.add(key);
    }
  }
  keys(data.cases,[...caseIds],'case');
  for(const [id,decisions] of Object.entries(data.cases)) {
    if(!Array.isArray(decisions)||!decisions.length)throw new Error(`Invalid decisions: ${id}`);
    const seen=new Set();
    for(const d of decisions) {
      keys(d,['issue','kind','character','segment','offset','stage','reading','conversion','reason','confidence'],'decision');
      if(!Number.isInteger(d.issue)||d.issue<0||seen.has(d.issue))throw new Error(`Invalid/duplicate issue: ${id}`);
      seen.add(d.issue);
      if(typeof d.reason!=='string'||!d.reason.trim()||!['high','low'].includes(d.confidence))throw new Error(`Invalid decision rationale: ${id}`);
    }
  }
}
export function applyTypingConventions(entry,conventions=[]) {
  const result=structuredClone(entry),decisions=[];
  for(const [segment,s] of result.segments.entries())if(s.lang==='zh'&&s.reading) {
    const citationReading=s.reading,readings=s.reading.split(' '),changed=new Set();
    for(const [offset,character] of [...s.text].entries()) {
      const convention=conventions.find(c=>c.character===character&&c.from===readings[offset]);
      if(!convention)continue;
      readings[offset]=convention.reading;changed.add(offset);
      decisions.push({...convention,segment,offset});
    }
    if(changed.size) {
      s.citationReading=citationReading;s.reading=readings.join(' ');
      for(const evidence of s.evidence)if([...evidence.text].some((_,i)=>changed.has(evidence.offset+i)))evidence.typingReading=readings.slice(evidence.offset,evidence.offset+[...evidence.text].length).join(' ');
    }
  }
  // Confirming a few typed readings does not confirm a whole utterance or
  // replace the existing model/automatic citation-review provenance.
  if(decisions.length)result.typingAdjudications=decisions;
  return result;
}
export function conventionIssues(segments,issues) {
  // Accepted character coverage can hide a light compound syllable (那個,
  // 爸爸, 關係). Flag it independently under the amended typing convention;
  // the actual replacement is still an explicit positional decision.
  const particles=new Set([...'的了嗎呢吧啊們麼得著子嗯嘛呀']);
  const extra=[];
  for(const [segment,s] of segments.entries())if(s.lang==='zh'&&s.reading) {
    const syllables=s.reading.split(' ');
    for(const [offset,character] of [...s.text].entries())if(syllables[offset].endsWith('˙')&&!particles.has(character)&&!issues.some(i=>i.segment===segment&&i.offset<=offset&&i.offset+[...i.character].length>offset)) {
      extra.push({kind:'lexical-neutral-tone',character,segment,offset,provisionalReading:syllables[offset],candidates:[syllables[offset]],recommendation:'Adjudicate full Taiwan citation tone under the amended word-typing convention.'});
    }
  }
  return extra;
}
export function applyAdjudications(entry,issues,data) {
  const result=structuredClone(entry), resolved=new Map(), edits=new Map(), conversions=new Map();
  const decisions=data.cases[entry.id]??[];
  for(const d of decisions) {
    const issue=issues[d.issue];
    if(!issue)throw new Error(`Unknown flagged issue: ${entry.id}/${d.issue}`);
    for(const key of ['kind','character','segment','stage','offset']) {
      if(d[key]!==issue[key])throw new Error(`Stale ${key}: ${entry.id}/${d.issue}`);
    }
    if(issue.kind==='conversion-alternatives') {
      if('reading' in d||!issue.candidates.includes(d.conversion))throw new Error('Invalid conversion decision');
      // These flags have character offsets at the conversion stage. Refuse a
      // future length-changing/stage-dependent substitution rather than guess.
      const final=issue.outputCandidates??issue.candidates;
      const original=final[0], conversion=final[issue.candidates.indexOf(d.conversion)], chars=[...result.text];
      if(!Number.isInteger(issue.offset)||chars.slice(issue.offset,issue.offset+[...original].length).join('')!==original||[...conversion].length!==[...original].length)throw new Error(`Conversion position/length mismatch: ${entry.id}/${d.issue} at ${issue.offset}, expected ${original}, found ${chars.slice(issue.offset,issue.offset+[...original].length).join('')}`);
      for(const [i,c] of [...conversion].entries()) {
        const position=issue.offset+i;
        if(conversions.has(position)&&conversions.get(position)!==c)throw new Error('Conflicting conversion decisions');
        conversions.set(position,c);
      }
    } else {
      if('conversion' in d||typeof d.reading!=='string'||!/^([ㄅ-ㄩ]+[ˊˇˋ˙]?)( [ㄅ-ㄩ]+[ˊˇˋ˙]?)*$/u.test(d.reading))throw new Error('Invalid reading decision');
      const segment=result.segments[issue.segment], chars=[...segment?.text??''];
      if(segment?.lang!=='zh'||chars.slice(issue.offset,issue.offset+[...issue.character].length).join('')!==issue.character)throw new Error('Reading position mismatch');
      const syllables=d.reading.split(' ');
      if(syllables.length!==[...issue.character].length)throw new Error('Reading length mismatch');
      for(const [i,reading] of syllables.entries()) {
        const key=`${issue.segment}/${issue.offset+i}`;
        if(edits.has(key)&&edits.get(key)!==reading)throw new Error(`Conflicting readings: ${key}`);
        edits.set(key,reading);
      }
    }
    resolved.set(d.issue,d);
  }
  let offset=0;
  for(const [index,segment] of result.segments.entries()) {
    const chars=[...segment.text];
    for(let i=0;i<chars.length;i++)if(conversions.has(offset+i))chars[i]=conversions.get(offset+i);
    if(chars.join('')!==segment.text) {
      if(segment.lang!=='zh')throw new Error('Conversion outside Chinese segment');
      segment.provisionalText=segment.text;segment.text=chars.join('');
      for(const evidence of segment.evidence) {
        const text=chars.slice(evidence.offset,evidence.offset+[...evidence.text].length).join('');
        if(text!==evidence.text){evidence.provisionalText=evidence.text;evidence.text=text;}
      }
    }
    if(segment.lang==='zh') {
      const readings=segment.reading?.split(' ')??Array(chars.length).fill(null);
      for(let i=0;i<chars.length;i++)if(edits.has(`${index}/${i}`))readings[i]=edits.get(`${index}/${i}`);
      const reading=readings.every(Boolean)?readings.join(' '):null;
      if(reading!==segment.reading){segment.provisionalReading=segment.reading;segment.reading=reading;}
      for(const evidence of segment.evidence)if([...evidence.text].some((_,i)=>edits.has(`${index}/${evidence.offset+i}`)))evidence.adjudicatedReading=readings.slice(evidence.offset,evidence.offset+[...evidence.text].length).join(' ');
    }
    offset+=chars.length;
  }
  result.text=result.segments.map(s=>s.text).join('');
  result.review=issues.length?(resolved.size===issues.length?'model-reviewed':'pending'):'automatic';
  if(result.review==='model-reviewed')result.reviewedBy={reviewer:data.reviewer,date:data.date};
  return {entry:applyTypingConventions(result,data.typingConventions),issues:issues.map((issue,index)=>({...issue,...(resolved.has(index)?{adjudication:resolved.get(index)}:{})}))};
}
