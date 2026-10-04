// Explicit network import (or pinned local files). Never used by normal builds.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseCsv,taiwanConverter,cedictDictionary,annotate} from './zh-en-annotation.mjs';
import {validateAdjudications,applyAdjudications,conventionIssues} from './zh-en-adjudication.mjs';
import {encodeMixedInput} from '../eval/cases.mjs';
const root=new URL('../',import.meta.url);
const pins=JSON.parse(await readFile(new URL('eval/sources/zh-en-pins.json',root),'utf8'));
const adjudicationText=await readFile(new URL('eval/zh-en/adjudications.json',root),'utf8');
const adjudications=JSON.parse(adjudicationText);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
// Preserve the pinned selection made before PT-006. Removing this historic
// eligibility restriction is a separate corpus-selection change.
function selectionEncoding(text) {
  if(text.includes('O'))throw new Error('Frozen selection excludes uppercase O');
  return encodeMixedInput(text);
}
const from=process.argv.find(a=>a.startsWith('--from-dir='))?.slice(11);
const verify=process.argv.includes('--verify');
if(process.argv.slice(2).some(a=>a!=='--verify'&&!a.startsWith('--from-dir=')))throw new Error('Use --verify and/or --from-dir=DIR');
const scratch=await mkdtemp(join(tmpdir(),'polytype-zh-data-'));
try {
  const inputs={};
  for(const source of pins.sources) {
    const bytes=from?await readFile(join(from,source.name)):await fetch(source.url).then(async response=>{if(!response.ok)throw new Error(`${response.status}: ${source.url}`);return Buffer.from(await response.arrayBuffer());});
    if(sha256(bytes)!==source.sha256)throw new Error(`Pinned checksum mismatch: ${source.name}`);
    // Downloads remain outside the checkout, including full CC-CEDICT/OpenCC.
    await writeFile(join(scratch,source.name),bytes);inputs[source.name]=bytes.toString('utf8');
  }
  const convert=taiwanConverter(inputs), cedict=cedictDictionary(inputs['cedict_ts.u8'],convert);
  const accepted=new Map();
  const chinese=await readFile(new URL('data/chinese.tsv',root),'utf8');
  const prototype=await readFile(new URL('data/lexicon.json',root),'utf8');
  const lexicon=JSON.parse(prototype);
  function accept(character,reading){if(!accepted.has(character))accepted.set(character,new Set());accepted.get(character).add(reading);}
  for(const line of chinese.trim().split('\n')){const [reading,text]=line.split('\t');if([...text].length===1)accept(text,reading);}
  for(const [reading,text] of lexicon.chinese)if([...text].length===1)accept(text,reading);
  const comparisonSha256=sha256(chinese);
  const review=[];const counts={total:0,mixedAvailable:0,zhOnlyAvailable:0,markupDropped:0,unsupportedDropped:0,lengthDropped:0};
  const mixed=[],zhOnly=[];
  for(const [index,row] of parseCsv(inputs['ascend-test_metadata.csv']).entries()) {
    counts.total++;
    const original=row.transcription,hasHan=/\p{Script=Han}/u.test(original),hasLatin=/[A-Za-z]/.test(original);
    if(!hasHan)continue;
    if(/\[|\]|<|>|\{|\}/.test(original)){counts.markupDropped++;continue;}
    const kind=hasLatin?'mixed':'zh-only';counts[hasLatin?'mixedAvailable':'zhOnlyAvailable']++;
    if((hasLatin?mixed:zhOnly).length>=(hasLatin?300:50))continue;
    if(!/^[\p{Script=Han}\x20-\x7e]+$/u.test(original)){counts.unsupportedDropped++;continue;}
    const id=`ascend-test-${String(index+1).padStart(4,'0')}`;
    const converted=convert(original), issues=[...converted.doubts],segments=[];
    let length=0;
    for(const part of converted.text.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu)) {
      if(/^\p{Script=Han}/u.test(part)) {
        const annotation=annotate(part,cedict,accepted);issues.push(...annotation.issues.map(x=>({...x,segment:segments.length})));
        segments.push({lang:'zh',text:part,reading:annotation.reading,evidence:annotation.evidence});
        length+=[...part].length*5;
      } else {
        try{selectionEncoding(part);}catch{issues.push({kind:'encoding',character:part,candidates:[],recommendation:'Unsupported Colemak raw encoding.'});}
        segments.push({lang:'en',text:part,...(!/[A-Za-z]/.test(part)?{kind:'literal'}:{})});length+=part.length+2;
      }
    }
    if(issues.some(x=>x.kind==='encoding')){counts.unsupportedDropped++;continue;}
    if(length>400){counts.lengthDropped++;continue;}
    issues.push(...conventionIssues(segments,issues));
    const provisional={id,sourceRow:index+1,sourceFile:row.file_name,kind,original,text:converted.text,segments,review:issues.length?'pending':'automatic'};
    const adjudicated=applyAdjudications(provisional,issues,adjudications);
    (hasLatin?mixed:zhOnly).push(adjudicated.entry);
    review.push(...adjudicated.issues.map(issue=>({id,...issue})));
  }
  validateAdjudications(adjudications,new Set([...mixed,...zhOnly].map(entry=>entry.id)));
  const englishCounts={total:0,lengthEligible:0,unsupportedDropped:0,selected:0};const english=[];
  for(const block of inputs['ewt-en_ewt-ud-test.conllu'].trim().split(/\r?\n\r?\n/)) {
    englishCounts.total++;
    const text=block.match(/^# text = (.+)$/m)?.[1]?.replace(/\r$/,'');
    const sourceSent=block.match(/^# sent_id = (.+)$/m)?.[1]?.replace(/\r$/,'');
    const tokens=block.split(/\r?\n/).filter(l=>/^\d+\t/.test(l)).length;
    if(tokens<4||tokens>25)continue;englishCounts.lengthEligible++;
    try{if(!/^[\x20-\x7e]+$/.test(text)||text.length>400)throw new Error('Unsupported');selectionEncoding(text);}catch{englishCounts.unsupportedDropped++;continue;}
    if(english.length<200)english.push({id:`ewt-test-${String(english.length+1).padStart(3,'0')}`,sourceSent,tokens,text});
  }
  englishCounts.selected=english.length;
  const output={
    'eval/zh-en/ascend.json':JSON.stringify({source:'CAiRE/ASCEND',revision:pins.revisions.ascend,split:'test',license:'CC BY-SA 4.0',selection:'First 300 representable mixed and first 50 Han-only utterances in test CSV order; markup excluded before selection; no decoder output used.',counts:{...counts,mixedSelected:mixed.length,zhOnlySelected:zhOnly.length,pending:[...mixed,...zhOnly].filter(e=>e.review==='pending').length,modelReviewed:[...mixed,...zhOnly].filter(e=>e.review==='model-reviewed').length,automatic:[...mixed,...zhOnly].filter(e=>e.review==='automatic').length},adjudications:{sha256:sha256(adjudicationText),reviewer:adjudications.reviewer,date:adjudications.date,conventions:adjudications.conventions},comparison:{source:'data/chinese.tsv + prototype single-character entries',sha256:comparisonSha256,prototypeSha256:sha256(prototype)},cases:[...mixed,...zhOnly]})+'\n',
    'eval/zh-en/english-only.json':JSON.stringify({source:'UniversalDependencies/UD_English-EWT',revision:pins.revisions.ewt,split:'test',license:'CC BY-SA 4.0',selection:'First 200 test sentences in file order with 4–25 integer-ID tokens, printable ASCII text, <=400 raw units, and exact Colemak round trip. Eligibility/drop counts cover entire test split.',counts:englishCounts,cases:english},null,2)+'\n',
    'eval/zh-en/review.json':JSON.stringify({status:review.every(issue=>issue.adjudication)?'model-reviewed':'pending',issues:review})+'\n',
    'eval/sources/ASCEND-README.md':inputs['ascend-README.md'],
    'eval/sources/UD_English-EWT-README.md':inputs['ewt-README.md'],
    'eval/sources/UD_English-EWT-LICENSE.txt':inputs['ewt-LICENSE.txt'],
    'eval/sources/OpenCC-LICENSE.txt':inputs['opencc-LICENSE'],
    'eval/sources/CC-CEDICT-NOTICE.txt':inputs['cedict_ts.u8'].split(/\r?\n/).filter(l=>l.startsWith('#')).join('\n')+'\n',
  };
  output['eval/zh-en/manifest.json']=JSON.stringify({version:1,files:Object.entries({...output,'eval/zh-en/adjudications.json':adjudicationText}).map(([path,text])=>({path,sha256:sha256(text),bytes:Buffer.byteLength(text)}))},null,2)+'\n';
  for(const [name,text] of Object.entries(output)) {
    if(Buffer.byteLength(text)>=1_000_000)throw new Error(`Split generated file before committing: ${name}`);
    if(verify){if(await readFile(new URL(name,root),'utf8')!==text)throw new Error(`Reproduction mismatch: ${name}`);}
    else {await mkdir(new URL(name.slice(0,name.lastIndexOf('/')+1),root),{recursive:true});await writeFile(new URL(name,root),text);}
  }
  console.log(JSON.stringify({mode:verify?'verified':'imported',ascend:JSON.parse(output['eval/zh-en/ascend.json']).counts,english:englishCounts,reviewIssues:review.length},null,2));
} finally {await rm(scratch,{recursive:true,force:true});}
