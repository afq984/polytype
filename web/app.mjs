import{rankingId,rawEncodingVersion,decode,decodeConstrained,segments,alternatives,rebaseConstraints,commitCandidate,examplesForLayout,physicalKey,setCustomEntries,dictionarySize}from'./engine.mjs';
const $=id=>document.getElementById(id);let candidates=[],selected=0,committed='',timer=null;
let constraints=[],rawSnapshot='',segmentView=null,segmentMenu=null,pendingEdit;
const ranking=()=>rankingId+(constraints.length?'+segment-v1':'');
const blind=()=>$('blind-capture').checked;
const options=()=>({layout:$('keyboard-layout').value,english:$('enable-english').checked,japanese:$('enable-japanese').checked,zhuyin:$('enable-zhuyin').checked});
const toolsKey='polytype-tools-open-v1';
try{$('more-tools').open=localStorage.getItem(toolsKey)==='true'}catch{}
$('more-tools').addEventListener('toggle',()=>{try{localStorage.setItem(toolsKey,String($('more-tools').open))}catch{}});
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
function render(reset=true){if(reset)selected=0;rawSnapshot=$('raw').value;candidates=blind()?[]:(constraints.length?decodeConstrained(rawSnapshot,constraints,options()):decode(rawSnapshot,options()));selected=Math.min(selected,Math.max(0,candidates.length-1));const best=candidates[selected];segmentView=blind()||!best||!rawSnapshot?null:segments(rawSnapshot,options(),constraints,selected);$('count').textContent=rawSnapshot.length+' / 400 keys';$('preedit').replaceChildren();$('segments').replaceChildren();$('candidates').replaceChildren();$('replay').disabled=blind();$('commit').disabled=blind()||!rawSnapshot||!best;$('capture-case').disabled=!rawSnapshot;$('correct-segment').disabled=blind()||!segmentView?.units.length;$('unlock-all').disabled=!constraints.length;$('correction-tools').hidden=blind();
 if(blind()){
  $('preedit').append(el('span','placeholder',$('raw').value||'Blind capture: type your raw keys.'));
  $('segments').append(el('p','muted','Predictions are hidden. Finish to enter the intended text.'));
  return;
 }
 if(!$('raw').value){$('preedit').append(el('span','placeholder','Start typing to see an interpretation.'));$('segments').append(el('p','muted','Your keystrokes will appear here.'))}
 else if(best){for(const s of segmentView.segments){const p=best.parts[s.partIndex],editable=segmentView.spans.some(span=>span.start===s.start&&span.end===s.end);const piece=el(editable?'button':'span',s.lang==='space'?'space':'piece '+s.lang.toLowerCase()+(editable?' segment-piece':'')+(s.locked?' locked':''),s.text);piece.dataset.start=s.start;piece.dataset.end=s.end;if(editable){piece.type='button';piece.setAttribute('aria-label',`Correct ${s.text}${s.locked?' (locked)':''}`);piece.onclick=()=>openSegment(s)};$('preedit').append(piece);const row=el('div','segment'+(s.locked?' locked':''));row.dataset.start=s.start;row.dataset.end=s.end;row.append(el('span','tag '+s.lang.toLowerCase(),s.lang==='space'?'␣':s.lang));const middle=el('div');middle.append(el('code','',s.raw.replaceAll(' ','␣')),el('small','',p.note));
 if(p.slots){const slots=el('div','phonetic-slots');p.slots.forEach((symbol,i)=>{const slot=el('span','phonetic-slot');slot.append(el('span','slot-label',['聲母','介音','韻母'][i]),el('strong','',symbol||'—'));slots.append(slot)});middle.append(slots);if(p.changes.length)middle.append(el('small','replacements',p.changes.join(' · ')))}
 if(s.locked){const unlock=el('button','quiet unlock-segment','Unlock');unlock.type='button';unlock.onclick=e=>{e.stopPropagation();unlockSpan(s)};middle.append(el('small','lock-label','Locked choice'),unlock)}
 const result=el(editable?'button':'span','result'+(editable?' segment-result':''),s.lang==='space'?'␣':s.text);if(editable){result.type='button';result.onclick=()=>openSegment(s)};row.append(middle,result);$('segments').append(row)}}
 if($('raw').value&&!best){const enabled=options();$('preedit').append(el('span','placeholder',enabled.english||enabled.japanese||enabled.zhuyin?'No interpretation with the enabled languages.':'Enable at least one language.'))}
 candidates.forEach((c,i)=>{if(!$('raw').value)return;const b=el('button');b.setAttribute('aria-pressed',String(i===selected));const commit=commitCandidate(c),label=commit!==c.text&&candidates.some((other,j)=>j!==i&&other.text===c.text)?`${c.text} → ${commit}`:c.text;b.append(el('span','candidate-index',String(i+1)),document.createTextNode(label));b.onclick=()=>{closeSegment(false);selected=i;render(false)};$('candidates').append(b)});
 document.querySelectorAll('#examples button').forEach((b,i)=>b.classList.toggle('active',$('raw').value===examples[i].raw));}
function setRaw(raw){stop();closeSegment(false);constraints=[];pendingEdit=undefined;$('correction-status').textContent='';$('raw').value=raw.slice(0,400);render()}
function commit(){if(blind()){$('capture-case').click();return}if(!$('raw').value||!candidates[selected])return;stop();committed+=(committed?'\n':'')+commitCandidate(candidates[selected]);$('committed').textContent=committed;$('copy').disabled=false;setRaw('');$('raw').focus()}
function drawExamples(){ $('examples').replaceChildren();for(const example of examples){const b=el('button','',example.name);b.onclick=()=>{setRaw(example.raw);$('raw').focus()};$('examples').append(b)}}
drawExamples();
$('input-options').addEventListener('change',()=>{
 try{localStorage.setItem(optionsKey,JSON.stringify(options()));$('settings-status').textContent='Layout and languages saved in this browser.'}
 catch{$('settings-status').textContent='Browser storage unavailable; settings apply for this session only.'}
 stop();closeSegment(false);if(constraints.length)$('correction-status').textContent='Choices unlocked after input settings changed.';constraints=[];examples=examplesForLayout(options().layout);drawExamples();updateLayoutLabels();render();
});
function updateLayoutLabels(){const name=options().layout==='qwerty'?'QWERTY':'Colemak';$('jp-layout').textContent='Romaji · '+name;$('en-layout').textContent=name;$('input-help').textContent=name+(blind()?' · Blind capture: Enter finishes. Esc clears.':' ready · Enter commits. Esc clears.')}
$('raw').addEventListener('input',()=>{stop();closeSegment(false);syncRaw(pendingEdit);pendingEdit=undefined;render()});$('raw').addEventListener('keydown',e=>{
 if(correctionKeyDown(e))return;
 if(e.isComposing || e.ctrlKey || e.metaKey || e.altKey)return;
 if(e.key==='Enter'){e.preventDefault();commit();return}
 if(e.key==='Escape'){e.preventDefault();setRaw('');return}
 const key=physicalKey(e,options().layout);
 if(key===null)return;
 e.preventDefault();stop();
 insertRawKey(key);
});$('clear').onclick=()=>{setRaw('');$('raw').focus()};$('commit').onclick=commit;$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(committed);$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy text',1500)}catch{$('copy').textContent='Select the text above to copy'}};

// Correction state and edit adaptation. All decoding/span decisions stay in Rust.
function syncRaw(edit){
 const next=$('raw').value;
 if(constraints.length){
  let result;
  try{result=rebaseConstraints(rawSnapshot,next,constraints,options(),edit)}
  catch{try{result=rebaseConstraints(rawSnapshot,next,constraints,options())}catch(error){constraints=[];$('correction-status').textContent='Choices released: '+error.message}}
  if(result){constraints=result.constraints;if(result.removed.length)$('correction-status').textContent=`${result.removed.length} choice(s) unlocked after editing.`}
 }
 rawSnapshot=next;
}
function replaceRaw(start,end,inserted){
 const field=$('raw');if(field.value.length-(end-start)+inserted.length>400)return;
 field.setRangeText(inserted,start,end,'end');syncRaw({start,end,inserted});pendingEdit=undefined;render();
}
function insertRawKey(key){const field=$('raw');replaceRaw(field.selectionStart,field.selectionEnd,key)}
function adjacentScalar(raw,at,direction){
 if(direction<0){if(!at)return at;return at-((raw.charCodeAt(at-1)>=0xdc00&&raw.charCodeAt(at-1)<=0xdfff&&at>1)?2:1)}
 if(at>=raw.length)return at;return at+((raw.charCodeAt(at)>=0xd800&&raw.charCodeAt(at)<=0xdbff&&at+1<raw.length)?2:1);
}
$('raw').addEventListener('beforeinput',event=>{
 const field=$('raw');let start=field.selectionStart,end=field.selectionEnd;pendingEdit=undefined;
 if(event.inputType==='deleteContentBackward'){if(start===end)start=adjacentScalar(field.value,start,-1);pendingEdit={start,end,inserted:''}}
 else if(event.inputType==='deleteContentForward'){if(start===end)end=adjacentScalar(field.value,end,1);pendingEdit={start,end,inserted:''}}
 else if(event.inputType==='deleteByCut')pendingEdit={start,end,inserted:''};
 else if(event.inputType==='insertText'&&typeof event.data==='string')pendingEdit={start,end,inserted:event.data};
 else if(event.inputType==='insertFromPaste'&&event.dataTransfer)pendingEdit={start,end,inserted:event.dataTransfer.getData('text/plain')};
});
function correctionSignature(){return JSON.stringify([$('raw').value,options(),constraints,selected])}
function closeSegment(restore=true){
 const saved=segmentMenu?.selection;segmentMenu=null;$('segment-menu').hidden=true;
 document.querySelectorAll('.correction-focus').forEach(element=>element.classList.remove('correction-focus'));
 if(restore&&saved){const field=$('raw');field.focus({preventScroll:true});field.setSelectionRange(saved.start,saved.end,saved.direction)}
}
function menuConstraints(choice){return [...constraints.filter(c=>c.start!==choice.constraint.start||c.end!==choice.constraint.end),choice.constraint].sort((a,b)=>a.start-b.start)}
function previewChoice(index){
 if(!segmentMenu)return;
 if(segmentMenu.signature!==correctionSignature()){closeSegment();$('correction-status').textContent='Correction menu closed after the composition changed.';return}
 segmentMenu.index=Math.max(0,Math.min(index,segmentMenu.choices.length-1));
 const choice=segmentMenu.choices[segmentMenu.index];if(!choice)return;
 let preview;
 try{const locks=menuConstraints(choice),result=decodeConstrained($('raw').value,locks,options());if(result.length)preview={locks,result}}
 catch{/* This local source choice may not fit the surrounding interpretation. */}
 segmentMenu.preview=preview;
 $('segment-preview').textContent=preview?commitCandidate(preview.result[0]):'This choice has no complete interpretation in the current composition.';
 [...$('segment-choices').querySelectorAll('button')].forEach((button,i)=>{button.setAttribute('aria-selected',String(i===segmentMenu.index));if(i===segmentMenu.index)button.setAttribute('aria-disabled',String(!preview))});
 $('segment-menu-status').textContent=preview?`Choose ${choice.commitText} · ${choice.lang}`:'Choose another alternative or a larger span.';
 keepChoiceInView();
}
function applyChoice(index){
 previewChoice(index);if(!segmentMenu?.preview)return;
 const {locks}=segmentMenu.preview,choice=segmentMenu.choices[segmentMenu.index];constraints=locks;
 closeSegment();$('correction-status').textContent=`Locked ${choice.commitText}.`;render();
}
function openSegment(span,selection,anchor){
 if(blind()||!segmentView)return;stop();
 const field=$('raw'),saved=selection??segmentMenu?.selection??{start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection};
 let page;try{page=alternatives(field.value,{start:span.start,end:span.end},options(),constraints,selected)}catch(error){$('correction-status').textContent=error.message;return}
 segmentMenu={span:{start:span.start,end:span.end},anchor:anchor??{start:span.start,end:span.end},selection:saved,view:segmentView,signature:correctionSignature(),page,choices:[...page.items,...page.actions],index:0};
 $('segment-menu-title').textContent=`Correct ${span.text??'selected span'} · ${page.raw.replaceAll(' ','␣')}`;
 $('segment-more').hidden=!page.truncated;$('segment-choices').replaceChildren();$('segment-splits').replaceChildren();
 const actionLabels={english:'Use English',raw:'Use raw keys',hiragana:'Hiragana',katakana:'Katakana'};
 segmentMenu.choices.forEach((choice,index)=>{
  const outcome=choice.text===choice.commitText?choice.text:`${choice.text} → ${choice.commitText}`;
  const label=index<page.items.length?`${index+1}. ${outcome}`:`${actionLabels[choice.kind]} · ${outcome}`;
  const button=el('button','segment-choice',label);button.type='button';button.setAttribute('role','option');button.dataset.kind=choice.kind;button.dataset.text=choice.commitText;
  button.onclick=()=>applyChoice(index);button.onfocus=()=>previewChoice(index);$('segment-choices').append(button);
 });
 for(const unit of segmentView.units.filter(unit=>unit.start>=span.start&&unit.end<=span.end&&(unit.start!==span.start||unit.end!==span.end))){
  const button=el('button','quiet',`Syllable ${unit.raw.replaceAll(' ','␣')}`);button.type='button';button.onclick=()=>openSegment(unit,saved);$('segment-splits').append(button);
 }
 $('segment-unlock').hidden=!constraints.some(c=>c.start===span.start&&c.end===span.end);
 $('segment-menu').hidden=false;
 document.querySelectorAll('#preedit [data-start],#segments [data-start]').forEach(element=>element.classList.toggle('correction-focus',Number(element.dataset.start)<span.end&&Number(element.dataset.end)>span.start));
 const current=segmentView.segments.find(s=>s.start===span.start&&s.end===span.end);
 const initial=segmentMenu.choices.findIndex(choice=>choice.lang===current?.lang&&choice.commitText===current?.text);
 previewChoice(initial<0?0:initial);fitSegmentMenu();$('segment-menu').focus({preventScroll:true});
}
// Scroll only choices/controls; preview has its own row below that scroll area.
function keepChoiceInView(){
 if(!segmentMenu)return;
 const choice=$('segment-choices').children[segmentMenu.index];if(!choice)return;
 const scroller=$('segment-scroll'),visible=scroller.getBoundingClientRect(),item=choice.getBoundingClientRect();
 if(item.top<visible.top)scroller.scrollTop+=item.top-visible.top;
 else if(item.bottom>visible.bottom)scroller.scrollTop+=item.bottom-visible.bottom;
}
// Bound the menu inside the slot, leaving the raw field and preedit in view.
function fitSegmentMenu(){
 if(!segmentMenu)return;
 const viewport=window.visualViewport,top=viewport?.offsetTop??0,height=viewport?.height??innerHeight;
 const slot=$('choice-slot').getBoundingClientRect();
 $('segment-menu').style.maxHeight=Math.max(24,top+height-slot.top-8)+'px';
 keepChoiceInView();
}
function openCaretSegment(){
 const caret=$('raw').selectionStart,units=segmentView?.units??[];
 const unit=units.find(s=>s.start<caret&&s.end>=caret)??units.find(s=>s.start>=caret)??units.at(-1);if(unit)openSegment(unit);
}
function moveSegment(direction){
 if(!segmentMenu)return;const {span,selection,view}=segmentMenu;
 const unit=direction<0?[...view.units].reverse().find(s=>s.end<=span.start):view.units.find(s=>s.start>=span.end);
 if(unit)openSegment(unit,selection);
}
function extendSegment(direction){
 if(!segmentMenu)return;const {span,selection,anchor,view}=segmentMenu;
 let choices;
 if(direction<0){choices=span.end>anchor.end?view.spans.filter(s=>s.start===span.start&&s.end<span.end&&s.end>=anchor.end).sort((a,b)=>b.end-a.end):view.spans.filter(s=>s.end===span.end&&s.start<span.start).sort((a,b)=>b.start-a.start)}
 else{choices=span.start<anchor.start?view.spans.filter(s=>s.end===span.end&&s.start>span.start&&s.start<=anchor.start).sort((a,b)=>a.start-b.start):view.spans.filter(s=>s.start===span.start&&s.end>span.end).sort((a,b)=>a.end-b.end)}
 if(choices[0])openSegment(choices[0],selection,anchor);
}
function unlockSpan(span){closeSegment();constraints=constraints.filter(c=>c.start!==span.start||c.end!==span.end);$('correction-status').textContent='Choice unlocked.';render()}
$('correct-segment').onclick=openCaretSegment;
$('unlock-all').onclick=()=>{closeSegment();constraints=[];$('correction-status').textContent='All choices unlocked.';render()};
$('segment-unlock').onclick=()=>{if(segmentMenu)unlockSpan(segmentMenu.span)};
$('segment-cancel').onclick=()=>closeSegment();
$('segment-extend-left').onclick=()=>extendSegment(-1);$('segment-extend-right').onclick=()=>extendSegment(1);
$('raw').addEventListener('pointerdown',()=>closeSegment(false));
document.addEventListener('pointerdown',event=>{if(segmentMenu&&!event.target.closest('#segment-menu,#preedit,#segments,#correct-segment'))closeSegment(false)});

// Provisional correction key bindings live here so they can be changed together.
function correctionKeyDown(event){
 if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey){if(segmentMenu)closeSegment();return false}
 if(!segmentMenu){if(event.key==='ArrowDown'&&!blind()&&segmentView?.units.length){event.preventDefault();openCaretSegment();return true}return false}
 if(event.key==='Tab'){closeSegment();return false}
 if(event.key==='Escape'){event.preventDefault();closeSegment();return true}
 if(event.key==='Enter'){event.preventDefault();applyChoice(segmentMenu.index);return true}
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const direction=event.key==='ArrowLeft'?-1:1;event.shiftKey?extendSegment(direction):moveSegment(direction);return true}
 if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();previewChoice(segmentMenu.index+(event.key==='ArrowUp'?-1:1));return true}
 if(event.key==='Home'||event.key==='End'){event.preventDefault();previewChoice(event.key==='Home'?0:Math.max(0,segmentMenu.page.items.length-1));return true}
 if(!event.shiftKey&&/^Digit[1-9]$/.test(event.code)){event.preventDefault();const index=Number(event.code.slice(5))-1;if(index<segmentMenu.page.items.length)applyChoice(index);return true}
 if(event.key==='Backspace'||event.key==='Delete'){
  event.preventDefault();closeSegment();const field=$('raw');let start=field.selectionStart,end=field.selectionEnd;
  if(start===end){if(event.key==='Backspace')start=adjacentScalar(field.value,start,-1);else end=adjacentScalar(field.value,end,1)}
  replaceRaw(start,end,'');return true;
 }
 const key=physicalKey(event,options().layout);if(key!==null){event.preventDefault();closeSegment();insertRawKey(key);return true}
 return false;
}
$('segment-menu').addEventListener('keydown',correctionKeyDown);

$('copy-debug').onclick=async()=>{
 stop();
 const visibleCandidates=$('raw').value?candidates:[];
 const report={
  format:'polytype-debug-v1',capturedAt:new Date().toISOString(),
  engine:'Rust/WASM',profile:'expanded',ranking:ranking(),
  options:options(),
  browser:navigator.userAgent,mode:location.protocol==='file:'?'standalone':'web',
  raw:$('raw').value,rawEncodingVersion,rawEncoding:'QWERTY physical positions; roman interpretation uses options.layout',
  selection:{start:$('raw').selectionStart,end:$('raw').selectionEnd},
  selectedRank:visibleCandidates.length?selected+1:null,
  candidates:visibleCandidates.map((c,i)=>({rank:i+1,text:c.text,commitText:commitCandidate(c),score:c.score,lang:c.lang})),
  selectedTrace:visibleCandidates[selected]?.parts??[],dictionary:dictionarySize(),
  ...(constraints.length?{constraints:constraints.map(c=>({...c}))}:{}),
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
function validCase(row){return row&&typeof row.raw==='string'&&row.raw.length<=400&&typeof row.text==='string'&&row.text.length<=2000&&(row.blind===undefined||typeof row.blind==='boolean')&&validConstraints(row.constraints,row.raw)&&row.options&&['colemak','qwerty'].includes(row.options.layout)&&['english','japanese','zhuyin'].every(key=>typeof row.options[key]==='boolean')}
function validConstraints(value,raw){return value===undefined||(Array.isArray(value)&&value.length<=400&&value.every(c=>c&&Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start>=0&&c.start<c.end&&c.end<=raw.length&&typeof c.text==='string'&&['TW','JP','EN','RAW'].includes(c.lang)))}
function updateCaseCount(){ $('case-count').textContent=savedCases.length+' / 100 saved locally';$('export-cases').disabled=!savedCases.length; }
try{const rows=JSON.parse(localStorage.getItem(casesKey)||'[]');if(!Array.isArray(rows)||rows.length>100||!rows.every(validCase))throw new Error('Invalid saved cases');savedCases=rows}catch{casesStorageHealthy=false;$('case-status').textContent='Saved cases could not be loaded; existing storage will not be overwritten. Export new captures before closing.'}
updateCaseCount();
$('blind-capture').onchange=()=>{
 stop();caseSnapshot=null;$('case-editor').hidden=true;$('debug-preview').hidden=true;
 $('examples').hidden=blind();$('committed-output').hidden=blind();
 $('case-status').textContent=blind()?'Blind capture on. Predictions stay hidden; finish before entering the intended text.':'Blind capture off.';
 updateLayoutLabels();setRaw('');$('raw').focus();
};
$('capture-case').onclick=()=>{
 stop();if(!$('raw').value)return;
 caseSnapshot={...(blind()?{blind:true}:{}),raw:$('raw').value,rawEncodingVersion,options:options(),selectedRank:candidates.length?selected+1:null,dictionary:dictionarySize(),ranking:ranking(),...(constraints.length?{constraints:constraints.map(c=>({...c}))}:{})};
 $('case-expected-label').textContent=blind()?'Intended text · type with your OS IME':'Expected output · edit if the selected candidate is wrong';
 $('case-raw').value=caseSnapshot.raw;$('case-expected').value=!blind()&&candidates[selected]?commitCandidate(candidates[selected]):'';
 $('more-tools').open=true;$('case-editor').hidden=false;$('case-editor').open=true;$('case-expected').focus();
 $('case-status').textContent=blind()?'Enter the intended text with your OS IME, then save locally. Predictions remain hidden.':'Review or correct the expected output, then save. This is a snapshot; later typing does not change it.';
};
$('case-form').addEventListener('submit',event=>{
 event.preventDefault();if(!caseSnapshot)return;
 const row={...caseSnapshot,text:$('case-expected').value,id:'local-'+Date.now()+'-'+savedCases.length,recordedAt:new Date().toISOString()};
 if(!validCase(row)||!row.text.length){$('case-status').textContent='Enter an expected output of 1–2000 characters.';return}
 if(savedCases.some(c=>c.raw===row.raw&&c.text===row.text&&(c.rawEncodingVersion??1)===row.rawEncodingVersion&&JSON.stringify(c.options)===JSON.stringify(row.options)&&JSON.stringify(c.constraints??[])===JSON.stringify(row.constraints??[])&&Boolean(c.blind)===Boolean(row.blind))){$('case-status').textContent='This case is already saved.';return}
 if(savedCases.length>=100){$('case-status').textContent='The local case limit is 100. Export your cases before collecting more.';return}
 savedCases.push(row);updateCaseCount();
 try{if(!casesStorageHealthy)throw new Error('Storage unavailable');localStorage.setItem(casesKey,JSON.stringify(savedCases));$('case-status').textContent='Saved in this browser only. Export JSONL to share or evaluate it.'}
 catch{$('case-status').textContent='Browser storage unavailable: saved for this session only. Export JSONL before closing.'}
 if(row.blind){caseSnapshot=null;$('case-editor').hidden=true;setRaw('');$('raw').focus()}
});
$('export-cases').onclick=()=>{
 const blob=new Blob([savedCases.map(row=>JSON.stringify(row)).join('\n')+'\n'],{type:'application/x-ndjson'});
 const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='polytype-local-cases.jsonl';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('replay').onclick=()=>{if(timer){stop();return}const target=$('raw').value||examples[0].raw;setRaw('');let i=0;$('replay').textContent='Pause replay';timer=setInterval(()=>{$('raw').value=target.slice(0,++i);render();if(i>=target.length)stop()},145)};
const storageKey='polytype-custom-tw-v1';let userEntries=[];
function drawDictionary(){
 const size=dictionarySize();$('dictionary-count').textContent=size.builtIn+' 筆基礎 · '+size.imported+' 筆擴充 · '+size.custom+' 筆自訂 · '+size.englishImported+' English · '+size.japaneseImported+' 日本語';
 $('custom-entries').replaceChildren();
 userEntries.forEach((entry,index)=>{const row=el('div','custom-entry');row.append(el('span','',entry.reading+' → '+entry.text));const remove=el('button','quiet','移除');remove.type='button';remove.setAttribute('aria-label','移除 '+entry.text);remove.onclick=()=>{userEntries=setCustomEntries(userEntries.filter((_,i)=>i!==index));closeSegment(false);syncRaw();persistDictionary();drawDictionary();render()};row.append(remove);$('custom-entries').append(row)});
}
function persistDictionary(){try{localStorage.setItem(storageKey,JSON.stringify(userEntries));$('dictionary-status').textContent='已儲存在此瀏覽器。'}catch{$('dictionary-status').textContent='此瀏覽器無法儲存；新增詞條僅在本次開啟期間有效。'}}
try{const saved=localStorage.getItem(storageKey);if(saved)userEntries=setCustomEntries(JSON.parse(saved))}catch{$('dictionary-status').textContent='無法載入自訂詞庫，先使用內建詞庫。'}
$('dictionary-form').addEventListener('submit',e=>{
 e.preventDefault();
 try{const entry={reading:$('entry-reading').value,text:$('entry-text').value};
 if(userEntries.some(x=>x.reading===entry.reading.trim()&&x.text===entry.text.trim()))throw new Error('這筆詞條已存在。');
 userEntries=setCustomEntries([...userEntries,entry]);closeSegment(false);syncRaw();persistDictionary();drawDictionary();render();$('dictionary-form').reset();$('entry-reading').focus();
 }catch(error){$('dictionary-status').textContent=error.message}
});
drawDictionary();
document.getElementById('raw').disabled=false;
document.getElementById('blind-capture').disabled=false;
document.getElementById('copy-debug').disabled=false;
document.getElementById('input-options').disabled=false;
updateLayoutLabels();
setRaw(examples[0].raw);
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'stage_keystrokes',description:'Replace the demo preedit with QWERTY-encoded keystrokes and return candidate interpretations. Does not commit text.',inputSchema:{type:'object',properties:{keystrokes:{type:'string',maxLength:400}},required:['keystrokes'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input.keystrokes!=='string'||input.keystrokes.length>400)throw new Error('Provide at most 400 keystrokes');setRaw(input.keystrokes);return{candidates:candidates.map(x=>x.text)}}})).catch(()=>{})}catch{}}

// Keep the typing loop visible when focus or a virtual keyboard changes the viewport.
const compose=document.querySelector('.compose');
function keepComposeInView(){
 if(document.activeElement!==$('raw')||getComputedStyle(compose).position==='sticky')return;
 const vv=window.visualViewport,top=vv?vv.offsetTop:0,height=vv?vv.height:innerHeight,r=compose.getBoundingClientRect();
 if(r.top<top||r.bottom>top+height)window.scrollBy({top:r.top-top-8,behavior:'instant'});
}
$('raw').addEventListener('focus',()=>requestAnimationFrame(keepComposeInView));
window.visualViewport?.addEventListener('resize',()=>{fitSegmentMenu();keepComposeInView()});

// Leave room above secondary controls when the compose card is sticky.
new ResizeObserver(()=>{compose.parentElement.style.setProperty('--compose-height',compose.getBoundingClientRect().height+'px');fitSegmentMenu()}).observe(compose);
