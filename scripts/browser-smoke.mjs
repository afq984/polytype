// Optional browser check using Chrome's debugging protocol; no npm dependencies.
// CHROME_BIN=CHROME node scripts/browser-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {feedbackCases,mixedCases} from '../eval/cases.mjs';
import {captureA,captureB} from '../eval/island-cases.mjs';
import {rankingId,rawEncodingVersion} from '../web/engine.mjs';

const profile = await mkdtemp(join(tmpdir(), 'polytype-browser-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
  '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], {stdio: ['ignore', 'ignore', 'pipe']});
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
    let output = '';
    chrome.on('error', error => { clearTimeout(timeout); reject(error); });
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(new URL(match[1])); }
    });
  });
  const pages = await (await fetch('http://' + endpoint.host + '/json/list')).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', reject, {once: true});
  });
  let nextId = 0;
  const pending = new Map();
  const browserErrors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
    pending.set(id, {resolve, reject, timeout});
    socket.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  const readOptions=()=>evaluate("({layout:document.getElementById('keyboard-layout').value,english:document.getElementById('enable-english').checked,japanese:document.getElementById('enable-japanese').checked,zhuyin:document.getElementById('enable-zhuyin').checked})");
  const reloadReady=async()=>{
    // Prevent a still-live old document from satisfying readiness after reload.
    await evaluate("document.getElementById('raw').disabled=true");
    await send('Page.reload');
    for(let attempt=0;attempt<400;attempt++){
      if(await evaluate("!!document.getElementById('raw') && !document.getElementById('raw').disabled"))return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.fail('Reload did not initialize the demo');
  };
  const key = async (key, code, keyCode, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, modifiers,
      ...(keyCode ? {windowsVirtualKeyCode: keyCode} : {text: key})});
    await send('Input.dispatchKeyEvent', {type: 'keyUp', key, code});
  };
  const typeRoman = async text => {
    const physical = 'qwertyuiopasdfghjkl;zxcvbnm';
    const layout = 'qwfpgjluy;arstdhneiozxcvbkm';
    for (const char of text) {
      const raw = physical[layout.indexOf(char)] || char;
      const code = /^[a-z]$/.test(raw) ? 'Key' + raw.toUpperCase()
        : ({';': 'Semicolon', "'": 'Quote', '-': 'Minus', ' ': 'Space'})[raw];
      assert.ok(code, char);
      await key(char, code);
    }
  };
  for (const url of [process.env.DEMO_URL || 'http://127.0.0.1:4173', new URL('../Polytype-Demo.html', import.meta.url).href]) {
    await send('Page.navigate', {url});
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate("document.querySelectorAll('#examples button').length === 13")) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '小さい 的英文是 small');
    assert.deepEqual(await readOptions(),{layout:'qwerty',english:true,japanese:true,zhuyin:true});
    assert.ok(await evaluate("document.getElementById('raw').value.startsWith('tiisai ')"));
    assert.equal(await evaluate("document.activeElement.id==='raw'"),false);
    assert.equal(await evaluate("document.getElementById('more-tools').open"),false);
    assert.equal(await evaluate("document.getElementById('candidates').getAttribute('role')"),'group');
    assert.equal(await evaluate("document.getElementById('preedit').getAttribute('aria-labelledby')"),'preedit-label');
    assert.equal(await evaluate("getComputedStyle(document.getElementById('examples')).flexWrap"),'nowrap');
    assert.equal(await evaluate("document.getElementById('examples').closest('.compose')!==null"),true);
    await evaluate("document.getElementById('more-tools').open=true");
    await new Promise(resolve=>setTimeout(resolve,100));
    await reloadReady();
    assert.equal(await evaluate("document.getElementById('more-tools').open"),true);
    await evaluate("document.getElementById('more-tools').open=false");
    await new Promise(resolve=>setTimeout(resolve,100));
    await reloadReady();
    assert.equal(await evaluate("document.getElementById('more-tools').open"),false);

    // Persist layout and disabled languages before any other typing tests.
    await evaluate("document.getElementById('keyboard-layout').value='colemak'; document.getElementById('enable-english').checked=false; document.getElementById('enable-zhuyin').checked=false; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    await reloadReady();
    assert.deepEqual(await readOptions(),{layout:'colemak',english:false,japanese:true,zhuyin:false});
    assert.equal(await evaluate("document.getElementById('en-layout').textContent"),'Colemak');
    assert.ok(await evaluate("document.getElementById('raw').value.startsWith('flldal ')"));
    assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('polytype-input-options-v1'))"),await readOptions());
    await evaluate("document.getElementById('enable-english').click(); document.getElementById('enable-zhuyin').click()");
    await evaluate("document.getElementById('clear').click()");
    await typeRoman('gakkou');
    // A complete reading converts through the imported dictionary; kana scripts stay selectable.
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '学校');
    await key('Backspace', 'Backspace', 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'がっこ');
    await typeRoman('u');
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.endsWith('がっこう'))"));
    await evaluate("[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.endsWith('ガッコウ')).click(); document.getElementById('raw').focus()");
    await key('Enter', 'Enter', 13);
    assert.equal(await evaluate("document.getElementById('committed').textContent"), 'ガッコウ');
    await typeRoman('kan');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'かn');
    await key('Enter', 'Enter', 13);
    assert.equal(await evaluate("document.getElementById('committed').textContent"), 'ガッコウ\nかん');
    await typeRoman("shin'you");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '信用');
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.endsWith('しんよう'))"));
    await key('Escape', 'Escape', 27);
    assert.equal(await evaluate("document.getElementById('raw').value"), '');
    await typeRoman('conclusion');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'conclusion');
    await key(':', 'KeyP', undefined, 8);
    assert.equal(await evaluate("document.getElementById('raw').value"), 'c;jcuidl;jP');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'conclusion:');
    await key('Escape', 'Escape', 27);
    await key('O', 'Semicolon', undefined, 8);
    assert.equal(await evaluate("document.getElementById('raw').value"), ':');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'O');
    await key('Escape', 'Escape', 27);
    for(const row of feedbackCases) {
      await evaluate(`document.getElementById('raw').value=${JSON.stringify(row.raw)}; document.getElementById('raw').dispatchEvent(new Event('input', {bubbles:true}))`);
      assert.equal(await evaluate("document.getElementById('preedit').textContent"), row.text, row.id);
    }
    await evaluate("[...document.querySelectorAll('#examples button')].find(b=>b.textContent==='Kana + Chinese + English').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '学校 你好 hello');
    await evaluate("[...document.querySelectorAll('#examples button')].find(b=>b.textContent==='Expanded Chinese dictionary').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '資料庫 hello');
    assert.ok(await evaluate("document.getElementById('dictionary-count').textContent.includes('48184')"));
    assert.ok(await evaluate("document.getElementById('dictionary-count').textContent.includes('69097')"));
    // Shift+Comma follows a converted Chinese segment; ASCII stays selectable.
    await evaluate("document.getElementById('raw').value='us3lc3'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('raw').focus(); document.getElementById('raw').setSelectionRange(6,6)");
    await key('<','Comma',undefined,8);
    assert.equal(await evaluate("document.getElementById('raw').value"),'us3lc3<');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'你好，');
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.slice(1)==='你好<')"));
    await key('(', 'Digit9', undefined, 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'你好，（');
    await key('?', 'Slash', undefined, 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'你好，（？');
    await key(')', 'Digit0', undefined, 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'你好，（？）');
    await evaluate("document.getElementById('raw').value='c96dk3u3';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('raw').focus();document.getElementById('raw').setSelectionRange(8,8)");
    await key('1','Digit1');await key(' ','Space');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'還可以ㄅ');
    await key(' ','Space');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'還可以ㄅ ');
    // One physical Space completes ㄍㄤ and opens call; a second stays visible.
    for(const layout of ['qwerty','colemak'])for(const spaces of [1,2]){
      await evaluate(`document.getElementById('keyboard-layout').value=${JSON.stringify(layout)}; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true})); document.getElementById('raw').value=''; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('raw').focus()`);
      await key(layout==='qwerty'?'e':'f','KeyE');
      await key(layout==='qwerty'?';':'o','Semicolon');
      for(let i=0;i<spaces;i++)await key(' ','Space',32);
      if(layout==='colemak')await typeRoman('call');
      else for(const letter of 'call')await key(letter,'Key'+letter.toUpperCase());
      assert.equal(await evaluate("document.getElementById('preedit').textContent"),spaces===1?'剛call':'剛 call',layout);
      assert.equal(await evaluate("document.getElementById('raw').value"),'e;'+' '.repeat(spaces)+(layout==='qwerty'?'call':'cauu'));
    }
    // Dotted Roman numbers stay literal; digit-only Chinese is a local choice.
    for(const layout of ['qwerty','colemak']){
      await evaluate(`document.getElementById('keyboard-layout').value=${JSON.stringify(layout)};document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').focus()`);
      const type=async text=>{
        if(layout==='colemak')return typeRoman(text);
        for(const letter of text)await key(letter,letter===' '?'Space':'Key'+letter.toUpperCase());
      };
      await type('release ');
      await key('1','Digit1');await key('.','Period');await key('0','Digit0');await key('3','Digit3');
      assert.equal(await evaluate("document.getElementById('preedit').textContent"),'release 1.03');
      const chinese=await evaluate("[...document.querySelectorAll('#candidates button')].findIndex(b=>b.textContent.slice(1)==='release 版')");
      assert.ok(chinese>0,'Chinese remains below the numeral in the whole candidate list');
      await evaluate(`document.querySelectorAll('#candidates button')[${chinese}].click()`);
      await key('Enter','Enter',13);
      assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('release 版')"));
      await evaluate("document.getElementById('clear').click();document.getElementById('raw').focus()");
      await type('release ');
      await key('1','Digit1');await key('.','Period');await key('0','Digit0');await key('3','Digit3');
      await key('Enter','Enter',13);
      assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('release 1.03')"));
      await evaluate("document.getElementById('clear').click();document.getElementById('raw').focus()");
      await type('page ');await key('5','Digit5');await key('3','Digit3');
      assert.equal(await evaluate("document.getElementById('preedit').textContent"),'page 53');
    }
    // Numeric spans use the same physical first-tone switch and exact Spaces.
    for(const layout of ['qwerty','colemak'])for(const spaces of [1,2]){
      await evaluate(`document.getElementById('keyboard-layout').value=${JSON.stringify(layout)};document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').focus()`);
      await key(layout==='qwerty'?'e':'f','KeyE');
      await key(layout==='qwerty'?';':'o','Semicolon');
      for(let i=0;i<spaces;i++)await key(' ','Space',32);
      await key('1','Digit1');await key('7','Digit7');
      assert.equal(await evaluate("document.getElementById('preedit').textContent"),'剛'+' '.repeat(spaces-1)+'17');
      await key('Enter','Enter',13);
      assert.ok(await evaluate("document.getElementById('committed').textContent").then(text=>text.endsWith('剛'+' '.repeat(spaces-1)+'17')));
    }
    await evaluate("document.getElementById('keyboard-layout').value='colemak'; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    // Browser storage remains outside the core; rehydrate it into a fresh WASM instance.
    await evaluate("document.getElementById('entry-reading').value='ㄎㄜ ㄐㄧˋ'; document.getElementById('entry-text').value='科技'; document.getElementById('dictionary-form').requestSubmit()");
    await evaluate("document.getElementById('raw').value='kd ur4'; document.getElementById('raw').dispatchEvent(new Event('input', {bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '科技');
    await send('Page.reload');
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate("document.getElementById('custom-entries')?.textContent.includes('科技') && !document.getElementById('raw').disabled")) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await evaluate("document.getElementById('raw').value='kd ur4'; document.getElementById('raw').dispatchEvent(new Event('input', {bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '科技');
    await evaluate("document.getElementById('more-tools').open=true");
    // Exercise both clipboard outcomes deterministically, without touching the
    // host clipboard. The report must preserve selection and omit user history.
    const snapshot=await evaluate(`(async()=>{
      document.getElementById('raw').value='naj';
      document.getElementById('raw').dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelectorAll('#candidates button')[1].click();
      const before=document.getElementById('preedit').textContent;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedDebug=text}}});
      await document.getElementById('copy-debug').onclick();
      return {report:JSON.parse(window.copiedDebug),before,after:document.getElementById('preedit').textContent,
        preview:document.getElementById('debug-report').value,status:document.getElementById('debug-status').textContent};
    })()`);
    assert.equal(snapshot.report.format,'polytype-debug-v1');
    assert.equal(snapshot.report.raw,'naj');
    assert.equal(snapshot.report.selectedRank,2);
    assert.equal(snapshot.report.candidates[1].text,snapshot.before);
    assert.equal(snapshot.report.selectedTrace.map(part=>part.text).join(''),snapshot.before);
    assert.equal(snapshot.before,snapshot.after);
    assert.equal(snapshot.report.dictionary.custom,1);
    assert.equal('committed' in snapshot.report,false);
    assert.equal('userEntries' in snapshot.report,false);
    assert.deepEqual(JSON.parse(snapshot.preview),snapshot.report);
    assert.match(snapshot.status,/copied/);
    const fallback=await evaluate(`(async()=>{
      navigator.clipboard.writeText=async()=>{throw new Error('denied')};
      await document.getElementById('copy-debug').onclick();
      const field=document.getElementById('debug-report');
      return {open:document.getElementById('debug-preview').open,focused:document.activeElement===field,
        start:field.selectionStart,end:field.selectionEnd,length:field.value.length,
        status:document.getElementById('debug-status').textContent};
    })()`);
    assert.equal(fallback.open,true);assert.equal(fallback.focused,true);
    assert.equal(fallback.start,0);assert.equal(fallback.end,fallback.length);
    assert.match(fallback.status,/Clipboard unavailable/);
    await evaluate("document.getElementById('clear').click(); document.getElementById('keyboard-layout').value='qwerty'; document.getElementById('enable-japanese').checked=false; document.getElementById('enable-zhuyin').checked=false; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true})); document.getElementById('raw').focus()");
    for(const char of 'hello')await key(char,'Key'+char.toUpperCase());
    await key('P','KeyP',undefined,8);
    await key(':','Semicolon',undefined,8);
    assert.equal(await evaluate("document.getElementById('raw').value"),'helloP:');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'helloP:');
    await evaluate("document.getElementById('enable-english').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'Enable at least one language.');
    assert.equal(await evaluate("document.getElementById('commit').disabled"),true);
    await reloadReady();
    assert.deepEqual(await readOptions(),{layout:'qwerty',english:false,japanese:false,zhuyin:false});
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'Enable at least one language.');
    assert.equal(await evaluate("document.getElementById('commit').disabled"),true);
    await evaluate("document.getElementById('enable-japanese').click(); document.getElementById('enable-zhuyin').click(); document.getElementById('enable-english').click(); [...document.querySelectorAll('#examples button')].find(b=>b.textContent==='Kana + Chinese + English').click()");
    assert.equal(await evaluate("document.getElementById('raw').value"),'gakkou us3lc3 hello');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'学校 你好 hello');
    await evaluate("document.getElementById('clear').click()");
    const loop='for (int i = 0; i < 100; i++)';
    for(const char of loop) {
      const punctuation={' ':['Space',0],'(':['Digit9',8],')':['Digit0',8],';':['Semicolon',0],'<':['Comma',8],'+':['Equal',8],'=':['Equal',0]};
      const [code,modifiers]=/[a-z]/.test(char)?['Key'+char.toUpperCase(),0]:/[0-9]/.test(char)?['Digit'+char,0]:punctuation[char];
      await key(char,code,undefined,modifiers);
      assert.ok(await evaluate("document.querySelectorAll('#candidates button').length>0"));
    }
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),loop);
    await evaluate("document.getElementById('clear').click()");
    for(const char of 'kan')await key(char,'Key'+char.toUpperCase());
    await key('.','Period');
    // Punctuation completes the reading, so the imported conversion appears; kana stays selectable.
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'感.');
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.slice(1)==='かん.')"));
    await key('Backspace','Backspace',8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'かn');
    await key('.','Period');
    const settingsReport=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.deepEqual(settingsReport.options,{layout:'qwerty',english:true,japanese:true,zhuyin:true});
    const recovered=mixedCases.find(row=>row.id==='mixed-06-qwerty-all');
    // The imported dictionary converts lowercase tanaka to 田中; the kana reading
    // remains selectable, while the provisional Latin alternative is a TODO (PT-004).
    const recoveredKana=recovered.text.replace('/ tanaka で','/ たなか で');
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(recovered.raw)}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.notEqual(await evaluate("document.getElementById('preedit').textContent"),recovered.input);
    await evaluate(`[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)===${JSON.stringify(recoveredKana)}).click(); document.getElementById('commit').click()`);
    assert.ok(await evaluate(`document.getElementById('committed').textContent.endsWith(${JSON.stringify(recoveredKana)})`));
    await evaluate("document.getElementById('raw').value='kan.'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    await evaluate("document.getElementById('keyboard-layout').value='colemak'; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('raw').value"),'kan.');
    await evaluate("document.getElementById('raw').value=''; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    await typeRoman('sinn');
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.slice(1)==='しん')"));
    await typeRoman('you');
    assert.equal(await evaluate("document.getElementById('raw').value"),'dljjo;i');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'信用');
    await key('Backspace','Backspace',8);
    // Backspace replays the remaining keys: しんよ is complete, so it converts too (神輿) while the kana stays listed.
    assert.ok(await evaluate("[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.slice(1)==='しんよ')"));
    await typeRoman('u');
    // The kana reading stays one click away when the dictionary converts it.
    await evaluate("[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)==='しんよう').click(); document.getElementById('commit').click()");
    assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('しんよう')"));
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(captureA)}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'量到的 p95 latency 增加了 11.6% 還在範圍之內');
    const islandTarget='量到的 p95 latency 增加了 11.6% 還在範圍之內';
    await evaluate(`[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)===${JSON.stringify(islandTarget)}).click(); document.getElementById('commit').click()`);
    assert.ok(await evaluate(`document.getElementById('committed').textContent.endsWith(${JSON.stringify(islandTarget)})`));
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(captureB.replace('ep cuaigk','ep  cuaigk'))}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.ok((await evaluate("document.getElementById('preedit').textContent")).includes('跟 claude 討論'));
    const islandReport=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.equal(islandReport.ranking,rankingId);
    // Confidence cues replace the existing underline and carry accessible help.
    await evaluate("document.getElementById('raw').value='u4';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    const cues=await evaluate("[...document.querySelectorAll('#preedit .uncertain')].map(e=>({description:e.getAttribute('aria-description'),style:getComputedStyle(e,'::after').borderBottomStyle}))");
    assert.ok(cues.length);for(const cue of cues){assert.ok(cue.description.includes('alternative'));assert.equal(cue.style,'dotted')}
    // Local correction uses exact raw spans, independent of whole-sentence rank.
    await evaluate("document.getElementById('keyboard-layout').value='qwerty';document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').value='y94 y94 hello';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('raw').setSelectionRange(3,3);document.getElementById('raw').focus()");
    await new Promise(resolve=>setTimeout(resolve,50));
    const beforeMenuScroll=await evaluate('scrollY');
    await key('ArrowDown','ArrowDown',40);
    assert.equal(await evaluate("document.getElementById('segment-menu').hidden"),false);
    assert.equal(await evaluate("document.getElementById('segment-menu').closest('#choice-slot')!==null"),true);
    assert.equal(await evaluate("getComputedStyle(document.getElementById('candidates')).display"),'none');
    assert.equal(await evaluate('scrollY'),beforeMenuScroll);
    assert.equal(await evaluate("document.activeElement.id"),'segment-menu');
    // A short viewport must clip the menu internally, even when it resizes
    // after opening and the raw editor no longer owns focus.
    await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});
    await new Promise(resolve=>setTimeout(resolve,100));
    const correctionBoxes=await evaluate("['raw','preedit','segment-menu','segment-preview'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,top:r.top,bottom:r.bottom,height:innerHeight}})");
    for(const box of correctionBoxes)assert.ok(box.top>=0&&box.bottom<=box.height,JSON.stringify(box));
    const previewLayout=await evaluate("(()=>{const scroller=document.getElementById('segment-scroll'),preview=document.getElementById('segment-preview');return {scrollBottom:scroller.getBoundingClientRect().bottom,previewTop:preview.getBoundingClientRect().top,scrollOverflow:getComputedStyle(scroller).overflowY,previewParent:preview.parentElement.id}})()");
    assert.ok(previewLayout.scrollBottom<=previewLayout.previewTop,JSON.stringify(previewLayout));
    assert.equal(previewLayout.scrollOverflow,'auto');
    assert.equal(previewLayout.previewParent,'segment-menu');
    await send('Emulation.clearDeviceMetricsOverride');
    await new Promise(resolve=>setTimeout(resolve,100));
    await key('2','Digit2');
    assert.equal(await evaluate("getComputedStyle(document.getElementById('candidates')).display"),'flex');
    assert.deepEqual(await evaluate("[document.getElementById('raw').selectionStart,document.getElementById('raw').selectionEnd]"),[3,3]);
    assert.equal(await evaluate("document.getElementById('raw').value"),'y94 y94 hello');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'再 在 hello');
    await evaluate("document.querySelector('#preedit [data-start=\"4\"]').click();[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='再').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'再 再 hello');
    assert.equal(await evaluate("document.querySelectorAll('#preedit .locked').length"),2);
    const correctedReport=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.deepEqual(correctedReport.constraints,[{start:0,end:3,text:'再',lang:'TW'},{start:4,end:7,text:'再',lang:'TW'}]);
    assert.equal(correctedReport.ranking,rankingId+'+segment-v1');
    assert.equal(correctedReport.rawEncodingVersion,rawEncodingVersion);
    await evaluate("document.getElementById('raw').focus();document.getElementById('raw').setSelectionRange(7,7)");
    await key('ArrowDown','ArrowDown',40);await key('Escape','Escape',27);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'再 再 hello');
    await key('ArrowDown','ArrowDown',40);await key('Tab','Tab',9);
    assert.equal(await evaluate("document.getElementById('segment-menu').hidden"),true);
    assert.equal(await evaluate("document.getElementById('raw').value"),'y94 y94 hello');
    await evaluate("document.getElementById('raw').focus();document.getElementById('raw').setSelectionRange(7,7)");
    await key('ArrowDown','ArrowDown',40);await key('Backspace','Backspace',8);
    assert.equal(await evaluate("document.getElementById('raw').value"),'y94 y9 hello');
    assert.equal(await evaluate("document.querySelectorAll('#preedit .locked').length"),1);
    await evaluate("document.getElementById('unlock-all').click()");
    assert.equal(await evaluate("document.querySelectorAll('#preedit .locked').length"),0);
    await evaluate("document.getElementById('clear').click();document.getElementById('raw').value='/j5';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('raw').setSelectionRange(3,3);document.getElementById('raw').focus()");
    await key('ArrowDown','ArrowDown',40);await key(' ','Space');
    assert.equal(await evaluate("document.getElementById('raw').value"),'/j5 ');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'中');
    assert.equal(await evaluate("document.getElementById('segment-menu').hidden"),true);
    await key(' ','Space');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'中 ');
    await evaluate("document.getElementById('clear').click();document.getElementById('raw').value='us3lc3 hello';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start=\"0\"]').click();document.querySelector('#segment-splits button').click();[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='妳').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'妳好 hello');
    await evaluate("document.getElementById('clear').click();document.getElementById('raw').value='y/ ru8 xk7';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('raw').setSelectionRange(3,3);document.getElementById('raw').focus()");
    await key('ArrowDown','ArrowDown',40);await key('ArrowRight','ArrowRight',39,8);
    await evaluate("[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='增加').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'增加了');
    await evaluate("document.querySelector('.unlock-segment').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'增加了');
    await evaluate("document.getElementById('clear').click();document.getElementById('raw').value='gakkou tanaka hello';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start=\"7\"]').click();document.querySelector('#segment-choices [data-kind=\"english\"]').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'学校 tanaka hello');
    await key('Enter','Enter',13);
    assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('学校 tanaka hello')"));
    await evaluate("document.getElementById('raw').value='hello kan';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start=\"6\"]').click();document.querySelector('#segment-choices [data-kind=\"katakana\"]').focus()");
    await key('Enter','Enter',13);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'hello カン');
    await key('Enter','Enter',13);
    assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('hello カン')"));
    for(const layout of ['qwerty','colemak']) {
      const pairs=[['<','，'],['>','。'],['?','？'],['!','！'],[':','：'],["'",'、'],['"','；'],['[','「'],[']','」'],['{','『'],['}','』'],['(','（'],[')','）']];
      if(layout==='colemak')pairs.push(['P','：']);
      for(const [rawKey,full]of pairs) {
        const raw='y94'+rawKey,ascii=rawKey==='P'?':':rawKey;
        await evaluate(`document.getElementById('keyboard-layout').value=${JSON.stringify(layout)};document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').value=${JSON.stringify(raw)};document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start="3"]').click()`);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('#segment-choices button')].map(b=>b.dataset.text)"),[full,ascii]);
        await evaluate(`[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text===${JSON.stringify(ascii)}).click()`);
        assert.equal(await evaluate("document.getElementById('raw').value"),raw);
        assert.equal(await evaluate("document.querySelector('#preedit [data-start=\"3\"]').textContent"),ascii);
        await evaluate("document.querySelector('#preedit [data-start=\"3\"]').click()");
        await key('1','Digit1');
        assert.equal(await evaluate("document.querySelector('#preedit [data-start=\"3\"]').textContent"),full);
      }
    }
    await evaluate("document.getElementById('clear').click();document.getElementById('raw').value='%';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('correct-segment').disabled"),true);
    await evaluate("document.getElementById('enable-english').checked=false;document.getElementById('enable-japanese').checked=false;document.getElementById('enable-english').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').value='1 ?';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start=\"0\"]').click();[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='ㄅ').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'ㄅ?');
    await evaluate("document.getElementById('enable-english').checked=true;document.getElementById('enable-japanese').checked=true;document.getElementById('enable-english').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click()");
    // Reading-based conversion and identical-preedit commit recovery.
    await evaluate("document.getElementById('keyboard-layout').value='qwerty'; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    for(const [raw,target] of [['toukyou','東京'],['nihonngo','日本語']]){
      await evaluate(`document.getElementById('raw').value=${JSON.stringify(raw)}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
      assert.ok(await evaluate(`[...document.querySelectorAll('#candidates button')].some(b=>b.textContent.slice(1)===${JSON.stringify(target)})`));
    }
    await evaluate("document.getElementById('raw').value='tokyo'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    assert.ok(!(await evaluate("document.getElementById('candidates').textContent")).includes('東京'));
    await evaluate("document.getElementById('raw').value='n'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    await evaluate("[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)==='n → ン').click(); document.getElementById('commit').click()");
    assert.ok(await evaluate("document.getElementById('committed').textContent.endsWith('ン')"));
    await evaluate("document.getElementById('keyboard-layout').value='colemak'; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    await evaluate("document.getElementById('raw').value='kan.'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    // Capturing does not save until the expected output is reviewed. Later
    // typing must not silently change the captured input or options.
    await evaluate("document.getElementById('capture-case').click()");
    assert.equal(await evaluate("document.getElementById('case-raw').value"),'kan.');
    const capturedOptions=await evaluate("({layout:document.getElementById('keyboard-layout').value,english:document.getElementById('enable-english').checked,japanese:document.getElementById('enable-japanese').checked,zhuyin:document.getElementById('enable-zhuyin').checked})");
    await evaluate("document.getElementById('case-expected').value='My corrected output.'; document.getElementById('raw').value='different'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('case-form').requestSubmit()");
    const saved=await evaluate("JSON.parse(localStorage.getItem('polytype-test-cases-v1'))");
    assert.equal(saved.length,1);assert.equal(saved[0].raw,'kan.');assert.equal(saved[0].text,'My corrected output.');
    assert.equal(saved[0].rawEncodingVersion,rawEncodingVersion);assert.equal(saved[0].ranking,rankingId);
    assert.deepEqual(saved[0].options,capturedOptions);assert.equal('committed' in saved[0],false);
    await evaluate("document.getElementById('case-form').requestSubmit()");
    assert.match(await evaluate("document.getElementById('case-status').textContent"),/already saved/);
    const exported=await evaluate(`(async()=>{
      const oldCreate=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
      let blob,name;
      URL.createObjectURL=value=>{blob=value;return oldCreate(value)};
      HTMLAnchorElement.prototype.click=function(){name=this.download};
      try{document.getElementById('export-cases').click();return {name,text:await blob.text()}}
      finally{URL.createObjectURL=oldCreate;HTMLAnchorElement.prototype.click=oldClick}
    })()`);
    assert.equal(exported.name,'polytype-local-cases.jsonl');assert.deepEqual(JSON.parse(exported.text),saved[0]);
    await send('Page.reload');
    for(let attempt=0;attempt<100;attempt++){
      if(await evaluate("document.getElementById('case-count')?.textContent==='1 / 100 saved locally'"))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(await evaluate("document.getElementById('case-count').textContent"),'1 / 100 saved locally');
    // Blind mode starts fresh and never offers predictions or a prefilled target.
    await evaluate("document.getElementById('more-tools').open=true");
    await evaluate("document.getElementById('blind-capture').click()");
    assert.equal(await evaluate("document.getElementById('raw').value"),'');
    await typeRoman('hello  ');
    const blindRaw=await evaluate("document.getElementById('raw').value");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),blindRaw);
    assert.equal(await evaluate("document.querySelectorAll('#candidates button').length"),0);
    assert.equal(await evaluate("document.querySelectorAll('#segments .segment').length"),0);
    assert.equal(await evaluate("document.getElementById('commit').disabled"),true);
    await evaluate("document.getElementById('capture-case').click()");
    assert.equal(await evaluate("document.getElementById('case-expected').value"),'');
    await evaluate("document.getElementById('more-tools').open=false;document.getElementById('raw').focus()"); await key('Enter','Enter',13);
    assert.equal(await evaluate("document.getElementById('more-tools').open"),true);
    assert.equal(await evaluate("document.activeElement.id"),'case-expected');
    await evaluate("document.getElementById('case-expected').value='hello  ';document.getElementById('case-form').requestSubmit()");
    const blindSaved=await evaluate("JSON.parse(localStorage.getItem('polytype-test-cases-v1')).at(-1)");
    assert.equal(blindSaved.blind,true);assert.equal(blindSaved.raw,blindRaw);assert.equal(blindSaved.text,'hello  ');
    assert.deepEqual(blindSaved.options,capturedOptions);assert.equal(blindSaved.selectedRank,null);
    const blindExport=await evaluate(`(async()=>{
      const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let blob;
      URL.createObjectURL=value=>{blob=value;return create(value)};HTMLAnchorElement.prototype.click=()=>{};
      try{document.getElementById('export-cases').click();return (await blob.text()).trim().split('\\n').map(JSON.parse).at(-1)}
      finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click}
    })()`);
    assert.deepEqual(blindExport,blindSaved);
    await evaluate("document.getElementById('blind-capture').click();document.getElementById('raw').value='hello';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    assert.ok(await evaluate("document.querySelectorAll('#candidates button').length>0"));
    // Storage denial still leaves the case exportable in this session.
    const denied=await evaluate(`(()=>{
      document.getElementById('capture-case').click();document.getElementById('case-expected').value='session only';
      const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('denied')};
      try{document.getElementById('case-form').requestSubmit();return document.getElementById('case-status').textContent}
      finally{Storage.prototype.setItem=original}
    })()`);
    assert.match(denied,/session only/);
    // Applied correction choices never learn until Remember is explicitly used.
    const stageMemory=raw=>evaluate(`document.getElementById('clear').click();document.getElementById('raw').value=${JSON.stringify(raw)};document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    await evaluate("document.getElementById('keyboard-layout').value='qwerty';document.getElementById('enable-english').checked=true;document.getElementById('enable-japanese').checked=true;document.getElementById('enable-zhuyin').checked=true;document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    await stageMemory('y94');
    await evaluate("document.querySelector('#preedit button').click();[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='再').click()");
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('polytype-custom-tw-v1')).some(e=>e.text==='再')"),false);
    await evaluate("document.querySelector('#preedit button').click();document.getElementById('segment-remember').click()");
    assert.ok(await evaluate("JSON.parse(localStorage.getItem('polytype-custom-tw-v1')).some(e=>e.reading==='ㄗㄞˋ'&&e.text==='再')"));
    await stageMemory('y94');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'再');
    await stageMemory('gakkou');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'学校');
    await evaluate("document.querySelector('#preedit button').click();document.querySelector('#segment-choices [data-kind=english]').click()");
    assert.equal(await evaluate("localStorage.getItem('polytype-custom-en-v1')"),null);
    await evaluate("document.querySelector('#preedit button').click()");
    // Existing ArrowDown/Enter bindings reach the explicit Remember action.
    for(let i=0;i<20;i++)await key('ArrowDown','ArrowDown',40);
    assert.equal(await evaluate("document.getElementById('segment-remember').getAttribute('aria-pressed')"),'true');
    await key('Enter','Enter',13);
    assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('polytype-custom-en-v1'))"),['gakkou']);
    await stageMemory('gakkou');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'gakkou');
    const dictionaryExport=await evaluate(`(async()=>{const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let blob,name;URL.createObjectURL=value=>{blob=value;return create(value)};HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.getElementById('export-dictionary').click();return {name,value:JSON.parse(await blob.text())}}finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click}})()`);
    assert.equal(dictionaryExport.name,'polytype-custom-dictionary.json');assert.deepEqual(dictionaryExport.value.english,['gakkou']);assert.ok(dictionaryExport.value.chinese.some(e=>e.text==='再'));
    const memoryDebug=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.equal(memoryDebug.dictionary.englishCustom,1);assert.equal(memoryDebug.customEntryDependent,true);assert.equal('englishEntries' in memoryDebug,false);
    await reloadReady();
    assert.ok(await evaluate("document.getElementById('custom-entries').textContent.includes('English → gakkou')"));
    await stageMemory('gakkou');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'gakkou');
    await evaluate("document.querySelector('#custom-entries [aria-label=\"Remove English gakkou\"]').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'学校');
    await evaluate("document.querySelector('#custom-entries [aria-label=\"移除 再\"]').click()");
    await stageMemory('y94');assert.equal(await evaluate("document.getElementById('preedit').textContent"),'在');
    await stageMemory('gakkou');
    const rememberDenied=await evaluate(`(()=>{document.querySelector('#preedit button').click();document.querySelector('#segment-choices [data-kind=english]').click();document.querySelector('#preedit button').click();const set=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('denied')};try{document.getElementById('segment-remember').click();return document.getElementById('dictionary-status').textContent}finally{Storage.prototype.setItem=set}})()`);
    assert.match(rememberDenied,/session only/);
    await evaluate("document.querySelector('#custom-entries [aria-label=\"Remove English gakkou\"]').click();localStorage.setItem('polytype-custom-en-v1','{')");
    await reloadReady();await stageMemory('gakkou');
    await evaluate("document.querySelector('#preedit button').click();document.querySelector('#segment-choices [data-kind=english]').click();document.querySelector('#preedit button').click();document.getElementById('segment-remember').click()");
    assert.equal(await evaluate("localStorage.getItem('polytype-custom-en-v1')"),'{');
    assert.match(await evaluate("document.getElementById('dictionary-status').textContent"),/session only/);
    await evaluate("localStorage.removeItem('polytype-custom-en-v1')");await reloadReady();
    // Invalid stored preferences are ignored, without overwriting them on load.
    const defaults={layout:'qwerty',english:true,japanese:true,zhuyin:true};
    for(const invalid of ['{','null','[]',JSON.stringify({...defaults,layout:'dvorak'}),JSON.stringify({...defaults,english:'false'}),JSON.stringify({layout:'qwerty'})]) {
      await evaluate(`localStorage.setItem('polytype-input-options-v1',${JSON.stringify(invalid)})`);
      await reloadReady();
      assert.deepEqual(await readOptions(),defaults);
      assert.match(await evaluate("document.getElementById('settings-status').textContent"),/could not be loaded/);
      assert.equal(await evaluate("localStorage.getItem('polytype-input-options-v1')"),invalid);
      assert.equal(await evaluate("document.getElementById('preedit').textContent"),'小さい 的英文是 small');
    }
    await evaluate("document.getElementById('enable-japanese').click()");
    const persisted=await evaluate("localStorage.getItem('polytype-input-options-v1')");
    const sessionOptions=await evaluate(`(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=()=>{throw new Error('denied')};
      const raw=document.getElementById('raw').value;
      try{document.getElementById('enable-japanese').click();return {raw,sameRaw:document.getElementById('raw').value===raw,status:document.getElementById('settings-status').textContent}}
      finally{Storage.prototype.setItem=original}
    })()`);
    assert.equal(sessionOptions.sameRaw,true);
    assert.match(sessionOptions.status,/session only/);
    assert.deepEqual(await readOptions(),defaults);
    assert.equal(await evaluate("localStorage.getItem('polytype-input-options-v1')"),persisted);
    await reloadReady();
    assert.equal((await readOptions()).japanese,false);
    // Loading/exporting old saved captures must not rewrite their encoding.
    const historical={raw:'a: b',text:'a: b',options:{layout:'colemak',english:true,japanese:false,zhuyin:false},ranking:'zh-punct-v1'};
    const historicalJSON=JSON.stringify([historical]);
    await evaluate(`localStorage.setItem('polytype-test-cases-v1',${JSON.stringify(historicalJSON)})`);
    await reloadReady();
    assert.equal(await evaluate("localStorage.getItem('polytype-test-cases-v1')"),historicalJSON);
    const oldExport=await evaluate(`(async()=>{
      let blob;const original=URL.createObjectURL;
      URL.createObjectURL=value=>{blob=value;return original(value)};
      try{document.getElementById('export-cases').click();return await blob.text()}
      finally{URL.createObjectURL=original}
    })()`);
    assert.deepEqual(JSON.parse(oldExport),historical);
    // Access to the localStorage property itself can throw in restricted browsers.
    const blockedStorage=await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}})"});
    await reloadReady();
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:blockedStorage.identifier});
    assert.deepEqual(await readOptions(),defaults);
    assert.equal(await evaluate("document.getElementById('more-tools').open"),false);
    await evaluate("document.getElementById('more-tools').open=true");
    assert.match(await evaluate("document.getElementById('settings-status').textContent"),/could not be loaded/);
    await evaluate("document.getElementById('enable-japanese').click(); document.getElementById('enable-zhuyin').click(); document.getElementById('clear').click()");
    for(const char of 'hello')await key(char,'Key'+char.toUpperCase());
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'hello');
    assert.match(await evaluate("document.getElementById('settings-status').textContent"),/session only/);
    // Explicit captures retain correction constraints, even when storage fails.
    await evaluate("document.getElementById('keyboard-layout').value='qwerty';document.getElementById('enable-japanese').checked=true;document.getElementById('enable-zhuyin').checked=true;document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('clear').click();document.getElementById('raw').value='y94 hello';document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#preedit [data-start=\"0\"]').click();[...document.querySelectorAll('#segment-choices button')].find(b=>b.dataset.text==='再').click();document.getElementById('capture-case').click();document.getElementById('case-form').requestSubmit()");
    const correctedCapture=await evaluate(`(async()=>{
      const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let blob;
      URL.createObjectURL=value=>{blob=value;return create(value)};HTMLAnchorElement.prototype.click=()=>{};
      try{document.getElementById('export-cases').click();return (await blob.text()).trim().split('\\n').map(JSON.parse).at(-1)}
      finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click}
    })()`);
    assert.deepEqual(correctedCapture.constraints,[{start:0,end:3,text:'再',lang:'TW'}]);
    assert.equal(correctedCapture.text,'再 hello');assert.ok(correctedCapture.ranking.endsWith('+segment-v1'));
    await evaluate("document.getElementById('blind-capture').click()");
    assert.equal(await evaluate("document.getElementById('correction-tools').hidden"),true);
    assert.equal(await evaluate("document.querySelectorAll('#preedit .uncertain').length"),0);
    assert.equal(await evaluate("document.getElementById('segment-menu').hidden"),true);
    assert.deepEqual(browserErrors, []);
    console.log('Browser passed:', url);
  }
  await send('Network.enable');
  await send('Network.setBlockedURLs', {urls:['*polytype_bg.wasm*']});
  await send('Page.navigate', {url:process.env.DEMO_URL || 'http://127.0.0.1:4173'});
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.getElementById('preedit')?.textContent === 'The input engine is unavailable.'")) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'The input engine is unavailable.');
  assert.equal(await evaluate("document.getElementById('raw').disabled"), true);
  assert.equal(await evaluate("document.getElementById('copy-debug').disabled"), true);
  console.log('Missing WASM produces a visible error and disables input; no JS fallback.');
} finally {
  socket?.close();
  chrome.kill('SIGTERM');
}
