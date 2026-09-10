import{decode,commitCandidate,examplesForLayout,physicalKey,setCustomEntries,dictionarySize}from'./engine.mjs';
const $=id=>document.getElementById(id);let candidates=[],selected=0,committed='',timer=null;
const options=()=>({layout:$('keyboard-layout').value,english:$('enable-english').checked,japanese:$('enable-japanese').checked,zhuyin:$('enable-zhuyin').checked});
const optionsKey='polytype-input-options-v1';
const defaultOptions={layout:'qwerty',english:true,japanese:true,zhuyin:true};
let initialOptions=defaultOptions;
try{
 const saved=localStorage.getItem(optionsKey);
 if(saved!==null){
  const value=JSON.parse(saved);
  if(!value||Array.isArray(value)||!['colemak','qwerty'].includes(value.layout)||!['english','japanese','zhuyin'].every(key=>typeof value[key]==='boolean'))throw new Error('Invalid input settings');
  initialOptions=value;
 }
}catch{$('settings-status').textContent='Saved settings could not be loaded; using QWERTY with all languages enabled.'}
$('keyboard-layout').value=initialOptions.layout;
for(const language of ['english','japanese','zhuyin'])$('enable-'+language).checked=initialOptions[language];
let examples=examplesForLayout(options().layout);
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function stop(){clearInterval(timer);timer=null;$('replay').textContent='↻ Replay example'}
function render(reset=true){if(reset)selected=0;candidates=decode($('raw').value,options());selected=Math.min(selected,Math.max(0,candidates.length-1));const best=candidates[selected];$('count').textContent=$('raw').value.length+' / 400 keys';$('preedit').replaceChildren();$('segments').replaceChildren();$('candidates').replaceChildren();$('commit').disabled=!$('raw').value||!best;$('capture-case').disabled=!$('raw').value;
 if(!$('raw').value){$('preedit').append(el('span','placeholder','Start typing to see an interpretation.'));$('segments').append(el('p','muted','Your keystrokes will appear here.'))}
 else if(best){for(const p of best.parts){$('preedit').append(el('span',p.lang==='space'?'space':'piece '+p.lang.toLowerCase(),p.text));const row=el('div','segment');row.append(el('span','tag '+p.lang.toLowerCase(),p.lang==='space'?'␣':p.lang));const middle=el('div');middle.append(el('code','',p.raw.replaceAll(' ','␣')),el('small','',p.note));
 if(p.slots){const slots=el('div','phonetic-slots');p.slots.forEach((symbol,i)=>{const slot=el('span','phonetic-slot');slot.append(el('span','slot-label',['聲母','介音','韻母'][i]),el('strong','',symbol||'—'));slots.append(slot)});middle.append(slots);if(p.changes.length)middle.append(el('small','replacements',p.changes.join(' · ')))}
 row.append(middle,el('span','result',p.lang==='space'?'␣':p.text));$('segments').append(row)}}
 if($('raw').value&&!best){const enabled=options();$('preedit').append(el('span','placeholder',enabled.english||enabled.japanese||enabled.zhuyin?'No interpretation with the enabled languages.':'Enable at least one language.'))}
 candidates.forEach((c,i)=>{if(!$('raw').value)return;const b=el('button');b.setAttribute('aria-pressed',String(i===selected));b.append(el('span','candidate-index',String(i+1)),document.createTextNode(c.text));b.onclick=()=>{selected=i;render(false)};$('candidates').append(b)});
 document.querySelectorAll('#examples button').forEach((b,i)=>b.classList.toggle('active',$('raw').value===examples[i].raw));}
function setRaw(raw){stop();$('raw').value=raw.slice(0,400);render()}
function commit(){if(!$('raw').value||!candidates[selected])return;stop();committed+=(committed?'\n':'')+commitCandidate(candidates[selected]);$('committed').textContent=committed;$('copy').disabled=false;$('raw').value='';render();$('raw').focus()}
function drawExamples(){ $('examples').replaceChildren();for(const example of examples){const b=el('button','',example.name);b.onclick=()=>{setRaw(example.raw);$('raw').focus()};$('examples').append(b)}}
drawExamples();
$('input-options').addEventListener('change',()=>{
 try{localStorage.setItem(optionsKey,JSON.stringify(options()));$('settings-status').textContent='Layout and languages saved in this browser.'}
 catch{$('settings-status').textContent='Browser storage unavailable; settings apply for this session only.'}
 stop();examples=examplesForLayout(options().layout);drawExamples();updateLayoutLabels();render();
});
function updateLayoutLabels(){const name=options().layout==='qwerty'?'QWERTY':'Colemak';$('jp-layout').textContent='Romaji · '+name;$('en-layout').textContent=name;$('input-help').textContent=name+' ready · Enter commits. Esc clears.'}
$('raw').addEventListener('input',()=>{stop();render()});$('raw').addEventListener('keydown',e=>{
 if(e.isComposing || e.ctrlKey || e.metaKey || e.altKey)return;
 if(e.key==='Enter'){e.preventDefault();commit();return}
 if(e.key==='Escape'){e.preventDefault();setRaw('');return}
 const key=physicalKey(e,options().layout);
 if(key===null)return;
 e.preventDefault();stop();
 const field=$('raw');
 if(field.value.length-(field.selectionEnd-field.selectionStart)+key.length>400)return;
 field.setRangeText(key,field.selectionStart,field.selectionEnd,'end');
 render();
});$('clear').onclick=()=>{setRaw('');$('raw').focus()};$('commit').onclick=commit;$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(committed);$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy text',1500)}catch{$('copy').textContent='Select the text above to copy'}};
$('copy-debug').onclick=async()=>{
 stop();
 const visibleCandidates=$('raw').value?candidates:[];
 const report={
  format:'polytype-debug-v1',capturedAt:new Date().toISOString(),
  engine:'Rust/WASM',profile:'expanded',ranking:'scowl-context-v4+family-v1',
  options:options(),
  browser:navigator.userAgent,mode:location.protocol==='file:'?'standalone':'web',
  raw:$('raw').value,rawEncoding:'QWERTY physical positions; roman interpretation uses options.layout',
  selection:{start:$('raw').selectionStart,end:$('raw').selectionEnd},
  selectedRank:visibleCandidates.length?selected+1:null,
  candidates:visibleCandidates.map((c,i)=>({rank:i+1,text:c.text,commitText:commitCandidate(c),score:c.score,lang:c.lang})),
  selectedTrace:visibleCandidates[selected]?.parts??[],dictionary:dictionarySize(),
  omitted:'Committed history and custom dictionary contents are not included.',
 };
 const text=JSON.stringify(report,null,2);
 $('debug-report').value=text;
 $('debug-preview').hidden=false;
 $('debug-status').textContent='Copying report…';
 try{
  await navigator.clipboard.writeText(text);
  $('debug-status').textContent='Debug report copied. Review it before sharing.';
 }catch{
  $('debug-status').textContent='Clipboard unavailable. Select and copy the report below.';
  $('debug-preview').open=true;$('debug-report').focus();$('debug-report').select();
 }
};
// Explicit local captures only: no automatic logging or network submission.
const casesKey='polytype-test-cases-v1';let savedCases=[],caseSnapshot=null,casesStorageHealthy=true;
function validCase(row){return row&&typeof row.raw==='string'&&row.raw.length<=400&&typeof row.text==='string'&&row.text.length<=2000&&row.options&&['colemak','qwerty'].includes(row.options.layout)&&['english','japanese','zhuyin'].every(key=>typeof row.options[key]==='boolean')}
function updateCaseCount(){ $('case-count').textContent=savedCases.length+' / 100 saved locally';$('export-cases').disabled=!savedCases.length; }
try{const rows=JSON.parse(localStorage.getItem(casesKey)||'[]');if(!Array.isArray(rows)||rows.length>100||!rows.every(validCase))throw new Error('Invalid saved cases');savedCases=rows}catch{casesStorageHealthy=false;$('case-status').textContent='Saved cases could not be loaded; existing storage will not be overwritten. Export new captures before closing.'}
updateCaseCount();
$('capture-case').onclick=()=>{
 stop();if(!$('raw').value)return;
 caseSnapshot={raw:$('raw').value,options:options(),selectedRank:candidates.length?selected+1:null,dictionary:dictionarySize(),ranking:'scowl-context-v4+family-v1'};
 $('case-raw').value=caseSnapshot.raw;$('case-expected').value=candidates[selected]?commitCandidate(candidates[selected]):'';
 $('case-editor').hidden=false;$('case-editor').open=true;$('case-expected').focus();
 $('case-status').textContent='Review or correct the expected output, then save. This is a snapshot; later typing does not change it.';
};
$('case-form').addEventListener('submit',event=>{
 event.preventDefault();if(!caseSnapshot)return;
 const row={...caseSnapshot,text:$('case-expected').value,id:'local-'+Date.now()+'-'+savedCases.length,recordedAt:new Date().toISOString()};
 if(!validCase(row)||!row.text.length){$('case-status').textContent='Enter an expected output of 1–2000 characters.';return}
 if(savedCases.some(c=>c.raw===row.raw&&c.text===row.text&&JSON.stringify(c.options)===JSON.stringify(row.options))){$('case-status').textContent='This case is already saved.';return}
 if(savedCases.length>=100){$('case-status').textContent='The local case limit is 100. Export your cases before collecting more.';return}
 savedCases.push(row);updateCaseCount();
 try{if(!casesStorageHealthy)throw new Error('Storage unavailable');localStorage.setItem(casesKey,JSON.stringify(savedCases));$('case-status').textContent='Saved in this browser only. Export JSONL to share or evaluate it.'}
 catch{$('case-status').textContent='Browser storage unavailable: saved for this session only. Export JSONL before closing.'}
});
$('export-cases').onclick=()=>{
 const blob=new Blob([savedCases.map(row=>JSON.stringify(row)).join('\n')+'\n'],{type:'application/x-ndjson'});
 const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='polytype-local-cases.jsonl';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('replay').onclick=()=>{if(timer){stop();return}const target=$('raw').value||examples[0].raw;$('raw').value='';render();let i=0;$('replay').textContent='Pause replay';timer=setInterval(()=>{$('raw').value=target.slice(0,++i);render();if(i>=target.length)stop()},145)};
const storageKey='polytype-custom-tw-v1';let userEntries=[];
function drawDictionary(){
 const size=dictionarySize();$('dictionary-count').textContent=size.builtIn+' 筆基礎 · '+size.imported+' 筆擴充 · '+size.custom+' 筆自訂 · '+size.englishImported+' English';
 $('custom-entries').replaceChildren();
 userEntries.forEach((entry,index)=>{const row=el('div','custom-entry');row.append(el('span','',entry.reading+' → '+entry.text));const remove=el('button','quiet','移除');remove.type='button';remove.setAttribute('aria-label','移除 '+entry.text);remove.onclick=()=>{userEntries=setCustomEntries(userEntries.filter((_,i)=>i!==index));persistDictionary();drawDictionary();render()};row.append(remove);$('custom-entries').append(row)});
}
function persistDictionary(){try{localStorage.setItem(storageKey,JSON.stringify(userEntries));$('dictionary-status').textContent='已儲存在此瀏覽器。'}catch{$('dictionary-status').textContent='此瀏覽器無法儲存；新增詞條僅在本次開啟期間有效。'}}
try{const saved=localStorage.getItem(storageKey);if(saved)userEntries=setCustomEntries(JSON.parse(saved))}catch{$('dictionary-status').textContent='無法載入自訂詞庫，先使用內建詞庫。'}
$('dictionary-form').addEventListener('submit',e=>{
 e.preventDefault();
 try{const entry={reading:$('entry-reading').value,text:$('entry-text').value};
 if(userEntries.some(x=>x.reading===entry.reading.trim()&&x.text===entry.text.trim()))throw new Error('這筆詞條已存在。');
 userEntries=setCustomEntries([...userEntries,entry]);persistDictionary();drawDictionary();render();$('dictionary-form').reset();$('entry-reading').focus();
 }catch(error){$('dictionary-status').textContent=error.message}
});
drawDictionary();
document.getElementById('raw').disabled=false;
document.getElementById('copy-debug').disabled=false;
document.getElementById('input-options').disabled=false;
updateLayoutLabels();
setRaw(examples[0].raw);
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'stage_keystrokes',description:'Replace the demo preedit with QWERTY-encoded keystrokes and return candidate interpretations. Does not commit text.',inputSchema:{type:'object',properties:{keystrokes:{type:'string',maxLength:400}},required:['keystrokes'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input.keystrokes!=='string'||input.keystrokes.length>400)throw new Error('Provide at most 400 keystrokes');setRaw(input.keystrokes);return{candidates:candidates.map(x=>x.text)}}})).catch(()=>{})}catch{}}
