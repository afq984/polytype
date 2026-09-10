// Optional browser check using Chrome's debugging protocol; no npm dependencies.
// CHROME_BIN=/path/to/chrome node scripts/browser-smoke.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {feedbackCases,mixedCases} from '../eval/cases.mjs';
import {captureA,captureB} from '../eval/island-cases.mjs';

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
    for(let attempt=0;attempt<100;attempt++){
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
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'がっこう');
    await key('Backspace', 'Backspace', 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'がっこ');
    await typeRoman('u');
    await evaluate("[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.endsWith('ガッコウ')).click(); document.getElementById('raw').focus()");
    await key('Enter', 'Enter', 13);
    assert.equal(await evaluate("document.getElementById('committed').textContent"), 'ガッコウ');
    await typeRoman('kan');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'かn');
    await key('Enter', 'Enter', 13);
    assert.equal(await evaluate("document.getElementById('committed').textContent"), 'ガッコウ\nかん');
    await typeRoman("shin'you");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'しんよう');
    await key('Escape', 'Escape', 27);
    assert.equal(await evaluate("document.getElementById('raw').value"), '');
    await typeRoman('conclusion');
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'conclusion');
    await key(':', 'KeyP', undefined, 8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'conclusion:');
    await key('Escape', 'Escape', 27);
    for(const row of feedbackCases) {
      await evaluate(`document.getElementById('raw').value=${JSON.stringify(row.raw)}; document.getElementById('raw').dispatchEvent(new Event('input', {bubbles:true}))`);
      assert.equal(await evaluate("document.getElementById('preedit').textContent"), row.text, row.id);
    }
    await evaluate("[...document.querySelectorAll('#examples button')].find(b=>b.textContent==='Kana + Chinese + English').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), 'がっこう 你好 hello');
    await evaluate("[...document.querySelectorAll('#examples button')].find(b=>b.textContent==='Expanded Chinese dictionary').click()");
    assert.equal(await evaluate("document.getElementById('preedit').textContent"), '資料庫 hello');
    assert.ok(await evaluate("document.getElementById('dictionary-count').textContent.includes('28184')"));
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
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'がっこう 你好 hello');
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
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'かん.');
    await key('Backspace','Backspace',8);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'かn');
    await key('.','Period');
    const settingsReport=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.deepEqual(settingsReport.options,{layout:'qwerty',english:true,japanese:true,zhuyin:true});
    const recovered=mixedCases.find(row=>row.id==='mixed-06-qwerty-all');
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(recovered.raw)}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.notEqual(await evaluate("document.getElementById('preedit').textContent"),recovered.input);
    await evaluate(`[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)===${JSON.stringify(recovered.text)}).click(); document.getElementById('commit').click()`);
    assert.ok(await evaluate(`document.getElementById('committed').textContent.endsWith(${JSON.stringify(recovered.text)})`));
    await evaluate("document.getElementById('raw').value='kan.'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    await evaluate("document.getElementById('keyboard-layout').value='colemak'; document.getElementById('keyboard-layout').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('raw').value"),'kan.');
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(captureA)}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'量到的 p95 latency 曾加了 11.6% 還在範圍之內');
    const islandTarget='量到的 p95 latency 增加了 11.6% 還在範圍之內';
    await evaluate(`[...document.querySelectorAll('#candidates button')].find(b=>b.textContent.slice(1)===${JSON.stringify(islandTarget)}).click(); document.getElementById('commit').click()`);
    assert.ok(await evaluate(`document.getElementById('committed').textContent.endsWith(${JSON.stringify(islandTarget)})`));
    await evaluate(`document.getElementById('raw').value=${JSON.stringify(captureB.replace('ep cuaigk','ep  cuaigk'))}; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.ok((await evaluate("document.getElementById('preedit').textContent")).includes('跟 claude 討論'));
    const islandReport=await evaluate("(async()=>{await document.getElementById('copy-debug').onclick();return JSON.parse(document.getElementById('debug-report').value)})()");
    assert.equal(islandReport.ranking,'scowl-context-v4+family-v1+island-v1');
    await evaluate("document.getElementById('raw').value='kan.'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true}))");
    // Capturing does not save until the expected output is reviewed. Later
    // typing must not silently change the captured input or options.
    await evaluate("document.getElementById('capture-case').click()");
    assert.equal(await evaluate("document.getElementById('case-raw').value"),'kan.');
    const capturedOptions=await evaluate("({layout:document.getElementById('keyboard-layout').value,english:document.getElementById('enable-english').checked,japanese:document.getElementById('enable-japanese').checked,zhuyin:document.getElementById('enable-zhuyin').checked})");
    await evaluate("document.getElementById('case-expected').value='My corrected output.'; document.getElementById('raw').value='different'; document.getElementById('raw').dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('case-form').requestSubmit()");
    const saved=await evaluate("JSON.parse(localStorage.getItem('polytype-test-cases-v1'))");
    assert.equal(saved.length,1);assert.equal(saved[0].raw,'kan.');assert.equal(saved[0].text,'My corrected output.');
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
    // Storage denial still leaves the case exportable in this session.
    const denied=await evaluate(`(()=>{
      document.getElementById('capture-case').click();document.getElementById('case-expected').value='session only';
      const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('denied')};
      try{document.getElementById('case-form').requestSubmit();return document.getElementById('case-status').textContent}
      finally{Storage.prototype.setItem=original}
    })()`);
    assert.match(denied,/session only/);
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
    // Access to the localStorage property itself can throw in restricted browsers.
    const blockedStorage=await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}})"});
    await reloadReady();
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:blockedStorage.identifier});
    assert.deepEqual(await readOptions(),defaults);
    assert.match(await evaluate("document.getElementById('settings-status').textContent"),/could not be loaded/);
    await evaluate("document.getElementById('enable-japanese').click(); document.getElementById('enable-zhuyin').click(); document.getElementById('clear').click()");
    for(const char of 'hello')await key(char,'Key'+char.toUpperCase());
    assert.equal(await evaluate("document.getElementById('preedit').textContent"),'hello');
    assert.match(await evaluate("document.getElementById('settings-status').textContent"),/session only/);
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
