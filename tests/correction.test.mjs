import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine, encode, physicalKey, rawEncodingVersion} from '../web/engine.mjs';

const native = fileURLToPath(new URL('../target/debug/polytype-json', import.meta.url));
const normalize = value => JSON.parse(JSON.stringify(value, (key, value) => key === 'score' ? Math.round(value * 1e10) / 1e10 : value));

test('local choices immediately after converted first tone keep boundary evidence and scores', () => {
  const engine=createEngine(),requests=[],expected=[];
  const query=(op,input,options,constraints=[],fields={})=>{
    const value=op==='decode'?engine.decodeConstrained(input,constraints,options):engine.alternatives(input,fields,options,constraints);
    requests.push({version:1,op,input,options,constraints,...fields});expected.push(value);return value;
  };
  try {
    for(const layout of ['qwerty','colemak']) {
      const options={layout},roman=text=>layout==='colemak'?encode(text):text;
      for(const reading of ['ㄍㄤ','ㄨㄛˇ ㄍㄤ'])for(const spaces of ['', ' ', '  ']) {
        const stem=engine.readingKeys(reading).join(''),prefix=reading==='ㄍㄤ'?'剛':'我剛';
        for(const [word,text,lang]of [['call','call','EN'],['11/','11/','EN'],['v2','v2','EN'],['OK','OK','EN'],['gakkou','学校','JP'],['gakkou','がっこう','JP']]) {
          const input=stem+spaces+roman(word),start=stem.length+spaces.length;
          const locks=[{start:0,end:stem.length,text:prefix,lang:'TW'}];
          const page=query('alternatives',input,options,locks,{start,end:input.length});
          const choice=[...page.items,...page.actions].find(item=>item.commitText===text&&item.lang===lang);assert.ok(choice,`${layout} ${input} ${text}`);
          const result=query('decode',input,options,[...locks,choice.constraint]);
          const target=prefix+spaces+text;assert.equal(engine.commitCandidate(result[0]),target);
          const ordinary=engine.decode(input,options).find(candidate=>engine.commitCandidate(candidate)===target);
          if(ordinary)assert.ok(Math.abs(ordinary.score-result[0].score)<1e-9,`${input}: opening score`);
        }
      }
      const bare={start:0,end:2,text:'ㄅ',lang:'TW'},input='1 '+roman('call');
      assert.deepEqual(query('decode',input,options,[bare,{start:2,end:input.length,text:'call',lang:'EN'}]),[]);
      const separated='1  '+roman('call');
      assert.equal(query('decode',separated,options,[bare,{start:3,end:separated.length,text:'call',lang:'EN'}])[0].text,'ㄅ call');
    }
    const entries=[{reading:'ㄅ',text:'自訂'}];requests.push({version:1,op:'setCustomEntries',entries});expected.push(engine.setCustomEntries(entries));
    assert.equal(query('decode','1 call',{layout:'qwerty'},[{start:0,end:2,text:'自訂',lang:'TW'},{start:2,end:6,text:'call',lang:'EN'}])[0].text,'自訂call');
    const child=spawnSync(native,[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:32e6});
    assert.equal(child.status,0,child.stderr);const results=child.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(results.length,expected.length);
    results.forEach((result,index)=>assert.deepEqual(normalize(result.ok),normalize(expected[index]),JSON.stringify(requests[index])));
  } finally {engine.dispose()}
});

test('mapped punctuation has exactly two local choices with native/WASM parity', () => {
  const engine = createEngine(), requests = [], expected = [];
  const query = (op, input, options, constraints = [], fields = {}) => {
    const value = op === 'decode' ? engine.decodeConstrained(input, constraints, options)
      : op === 'segments' ? engine.segments(input, options, constraints)
        : engine.alternatives(input, fields, options, constraints);
    requests.push({version:1,op,input,options,constraints,...fields}); expected.push(value); return value;
  };
  try {
    for (const layout of ['colemak', 'qwerty']) {
      const pairs = [['<','，'],['>','。'],['?','？'],['!','！'],[':','：'],["'",'、'],['"','；'],['[','「'],[']','」'],['{','『'],['}','』'],['(','（'],[')','）']];
      if (layout === 'colemak') pairs.push(['P','：']);
      for (const [key,full] of pairs) for (const space of ['', ' ', '  ']) {
        const input = 'y94' + space + key, start = 3 + space.length;
        const locks = [{start:0,end:3,text:'再',lang:'TW'}], options = {layout};
        const view = query('segments', input, options, locks);
        assert.ok(view.units.some(unit => unit.lang === 'punct' && unit.start === start && unit.end === start + 1));
        const page = query('alternatives', input, options, locks, {start,end:start+1});
        const ascii = key === 'P' ? ':' : key;
        assert.deepEqual(page.items.map(item => item.commitText), [full, ascii]);
        assert.deepEqual(page.actions, []); assert.equal(page.truncated, false); assert.equal(page.searchBounded, false);
        for (const choice of page.items) {
          assert.equal(choice.constraint.lang, 'punct');
          const applied = [...locks,choice.constraint];
          const candidates = query('decode', input, options, applied);
          assert.ok(candidates.length);
          assert.ok(candidates.every(candidate => engine.commitCandidate(candidate) === '再' + space + choice.commitText));
          const locked = query('segments', input, options, applied);
          assert.ok(locked.units.some(unit => unit.start === start && unit.locked));
          const pasted = query('alternatives', 'y94' + space + full, options, locks, {start,end:start+1});
          assert.deepEqual(pasted.items.map(item => item.commitText), [full, ascii]);
        }
      }
      const initial = engine.alternatives('(', {start:0,end:1}, {layout});
      assert.deepEqual(initial.items.map(item => item.commitText), ['(', '（']);
      assert.equal(engine.decodeConstrained('(', [initial.items[1].constraint], {layout})[0].text, '（');
      const unpaired = query('segments', '%', {layout});
      assert.deepEqual(unpaired.spans, []);
      assert.throws(() => engine.alternatives('%', {start:0,end:1}, {layout}), /editable/);
      assert.throws(() => engine.decodeConstrained('%', [{start:0,end:1,text:'％',lang:'punct'}], {layout}), /pair/);
    }
    const child = spawnSync(native, [], {input:requests.map(request => JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:64*1024*1024});
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const results = child.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(results.length, expected.length);
    results.forEach((result, index) => assert.deepEqual(normalize(result.ok), normalize(expected[index]), JSON.stringify(requests[index])));
  } finally {engine.dispose()}
});

test('bare Zhuyin choices stay phonetic and Colemak spans use raw encoding version two', () => {
  const engine = createEngine(), requests = [], expected = [];
  const query = (op, input, options, constraints = [], fields = {}) => {
    const value = op === 'decode' ? engine.decodeConstrained(input, constraints, options)
      : op === 'segments' ? engine.segments(input, options, constraints)
        : engine.alternatives(input, fields, options, constraints);
    requests.push({version:1,op,input,options,constraints,...fields}); expected.push(value); return value;
  };
  try {
    for (const layout of ['colemak', 'qwerty']) {
      const options = {layout,english:false,japanese:false};
      for (const [input,text] of [['1 ','ㄅ'],['1q ','ㄆ'],['cc ','ㄏ'],['1m ','ㄅㄩˉ']]) {
        const page = query('alternatives', input, options, [], {start:0,end:input.length});
        const choice = page.items.find(item => item.commitText === text); assert.ok(choice, input);
        assert.equal(choice.score, engine.decode(input, options)[0].score);
        assert.equal(query('decode', input + '?', options, [choice.constraint])[0].text, text + '?');
      }
      const bare = query('alternatives', '1 ', options, [], {start:0,end:2}).items.find(item => item.commitText === 'ㄅ');
      assert.deepEqual(query('decode', '1 <', options, [bare.constraint]), []);
      assert.deepEqual(query('decode', '1 <', options, [bare.constraint,{start:2,end:3,text:'，',lang:'punct'}]), []);
      assert.equal(query('decode', '1 (? ', options, [bare.constraint,{start:2,end:3,text:'（',lang:'punct'}])[0].text, 'ㄅ（? ');
    }
    assert.equal(rawEncodingVersion, 2);
    assert.equal(physicalKey({code:'KeyP',shiftKey:true}, 'colemak'), 'P');
    assert.equal(physicalKey({code:'Semicolon',shiftKey:true}, 'colemak'), ':');
    for (const text of ['OK', 'TODO', 'iOS', "O'Neil", 'Ohio', 'a: b']) {
      const input = encode(text), options = {layout:'colemak',japanese:false,zhuyin:false};
      const view = query('segments', input, options);
      assert.equal(engine.commitCandidate(view.candidate), text);
      for (const unit of view.units) {
        const page = query('alternatives', input, options, [], {start:unit.start,end:unit.end});
        const choice = [...page.items,...page.actions].find(item => item.commitText === unit.text); assert.ok(choice, text);
        assert.equal(query('decode', input, options, [choice.constraint])[0].text, text);
      }
    }
    const child = spawnSync(native, [], {input:requests.map(request => JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024});
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const results = child.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(results.length, expected.length);
    results.forEach((result, index) => assert.deepEqual(normalize(result.ok), normalize(expected[index]), JSON.stringify(requests[index])));
  } finally {engine.dispose()}
});

test('isolated local alternatives reuse ordinary Chinese and Japanese scores', () => {
  const engine = createEngine(), requests = [], expected = [];
  const check = (input, options, lang) => {
    const candidates = engine.decode(input, options);
    const page = engine.alternatives(input, {start:0,end:input.length}, options);
    const alternatives = [...page.items, ...page.actions].filter(item => item.lang === lang);
    let matched = 0;
    for (const candidate of candidates) {
      const alternative = alternatives.filter(item => item.commitText === engine.commitCandidate(candidate)).sort((a,b) => b.score - a.score)[0];
      if (!alternative) continue;
      assert.ok(Math.abs(alternative.score - candidate.score) < 1e-10, `${input}: ${alternative.commitText}`);
      matched++;
    }
    assert.ok(matched, input);
    requests.push({version:1,op:'decode',input,options}, {version:1,op:'alternatives',input,start:0,end:input.length,options});
    expected.push(candidates, page);
  };
  try {
    for (const layout of ['colemak', 'qwerty']) {
      for (const input of ['y94', 'us3lc3', 'y/ ru8']) check(input, {layout,english:false,japanese:false}, 'TW');
      for (const text of ['gakkou', 'kan', 'Tanaka', 'xtsu']) {
        check(layout === 'colemak' ? encode(text) : text, {layout,english:false,zhuyin:false}, 'JP');
      }
    }
    const entries = [{reading:'ㄗㄞˋ',text:'自訂再'}, {reading:'ㄋㄧˇ ㄏㄠˇ',text:'自訂你好'}];
    requests.push({version:1,op:'setCustomEntries',entries}); expected.push(engine.setCustomEntries(entries));
    for (const input of ['y94', 'us3lc3']) check(input, {layout:'qwerty',english:false,japanese:false}, 'TW');
    const child = spawnSync(native, [], {input:requests.map(request => JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024});
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const results = child.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(results.length, expected.length);
    results.forEach((result, index) => assert.deepEqual(normalize(result.ok), normalize(expected[index]), JSON.stringify(requests[index])));
  } finally { engine.dispose(); }
});

test('empty constraints preserve every acceptance prefix in both layouts and profiles', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/acceptance.json', import.meta.url)));
  for (const dictionary of ['prototype', 'expanded']) {
    const engine = createEngine({dictionary});
    try {
      for (const layout of ['colemak', 'qwerty']) for (const fixture of fixtures) {
        const raw = fixture.raw ?? encode(fixture.roman);
        for (let end = 0; end <= raw.length; end++) {
          assert.deepEqual(engine.decodeConstrained(raw.slice(0, end), [], {layout}), engine.decode(raw.slice(0, end), {layout}));
        }
      }
      if (dictionary === 'prototype') {
        assert.throws(() => engine.segments('y94'), /prototype/);
        assert.throws(() => engine.decodeConstrained('y94', [{start:0,end:3,text:'再',lang:'TW'}]), /prototype/);
      }
    } finally { engine.dispose(); }
  }
});

test('locked punctuation keeps converted-Chinese gating with native/WASM parity', () => {
  const engine=createEngine(),requests=[],expected=[];
  const lock=(end,text,lang='TW')=>({start:0,end,text,lang});
  const query=(input,options,constraints)=>{
    const value=engine.decodeConstrained(input,constraints,options);
    requests.push({version:1,op:'decode',input,options,constraints});expected.push(value);return value;
  };
  try {
    for(const layout of ['colemak','qwerty']) {
      const options={layout};
      for(const [key,mark]of [['<','，'],['>','。'],['?','？'],['!','！'],[':','：'],["'",'、'],['"','；'],['[','「'],[']','」'],['{','『'],['}','』']]) {
        for(const space of ['', ' ', '  ']) {
          const result=query('y94'+space+key,options,[lock(3,'再')]);
          assert.equal(engine.commitCandidate(result[0]),'再'+space+mark);
          assert.ok(result.every(c=>c.parts[0].text==='再'));
          assert.ok(result.some(c=>engine.commitCandidate(c)==='再'+space+key));
        }
        const roman=layout==='colemak'?encode('hello'):'hello',input='y94'+key+roman,locks=[lock(3,'再')];
        const page=engine.alternatives(input,{start:4,end:9},options,locks);
        const english=page.actions.find(item=>item.kind==='english');assert.ok(english,`${layout} ${key}`);
        requests.push({version:1,op:'alternatives',input,start:4,end:9,options,constraints:locks});expected.push(page);
        assert.equal(engine.commitCandidate(query(input,options,[...locks,english.constraint])[0]),'再'+mark+'hello');
      }
      const view=engine.segments('y94?',options,[lock(3,'再')]);
      assert.equal(view.segments[0].locked,true);assert.equal(view.segments[1].lang,'punct');
      requests.push({version:1,op:'segments',input:'y94?',options,constraints:[lock(3,'再')]});expected.push(view);
      const suffix=layout==='colemak'?encode("'s priority"):"'s priority";
      assert.equal(engine.commitCandidate(query('y94'+suffix,options,[lock(3,'再')])[0]),"再's priority");
      assert.equal(engine.commitCandidate(query('us3lc3?',options,[lock(6,'us3lc3','RAW')])[0]),'us3lc3?');
      const fallbackRaw=engine.readingKeys('ㄋㄝ').join(''),chinese={layout,english:false,japanese:false};
      assert.equal(engine.commitCandidate(query(fallbackRaw+'?',chinese,[lock(fallbackRaw.length,'ㄋㄝˉ')])[0]),'ㄋㄝˉ?');
      assert.deepEqual(query(fallbackRaw+'<',chinese,[lock(fallbackRaw.length,'ㄋㄝˉ')]),[]);
      const roman=layout==='colemak'?encode('hello'):'hello';
      assert.deepEqual(query(fallbackRaw+'<'+roman,{...chinese,english:true},[lock(fallbackRaw.length,'ㄋㄝˉ'),{start:fallbackRaw.length+1,end:fallbackRaw.length+6,text:'hello',lang:'EN'}]),[]);
    }
    const entries=[{reading:'ㄋㄝ',text:'ㄋㄝ'}];
    requests.push({version:1,op:'setCustomEntries',entries});expected.push(engine.setCustomEntries(entries));
    for(const layout of ['colemak','qwerty']) {
      const raw=engine.readingKeys('ㄋㄝ').join('');
      assert.equal(engine.commitCandidate(query(raw+'<',{layout,english:false,japanese:false},[lock(raw.length,'ㄋㄝ')])[0]),'ㄋㄝ，');
    }
    const child=spawnSync(native,[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024});
    assert.equal(child.status,0,child.stderr);
    const results=child.stdout.trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(results.length,expected.length);
    results.forEach((result,index)=>assert.deepEqual(normalize(result.ok),normalize(expected[index]),JSON.stringify(requests[index])));
  } finally {engine.dispose()}
});

test('correction spans, alternatives and constraints agree in native and WASM in both layouts', () => {
  const engine = createEngine(), requests = [], expected = [];
  const query = (op, input, options, constraints = [], fields = {}) => {
    const value = op === 'decode' ? engine.decodeConstrained(input, constraints, options)
      : op === 'segments' ? engine.segments(input, options, constraints, fields.candidateIndex ?? 0)
        : engine.alternatives(input, {start:fields.start,end:fields.end}, options, constraints, fields.candidateIndex ?? 0);
    requests.push({version:1,op,input,options,constraints,...fields}); expected.push(value);
    return value;
  };
  try {
    for (const layout of ['colemak', 'qwerty']) {
      const options = {layout}, roman = text => layout === 'colemak' ? encode(text) : text;
      const raw = 'y94 y94 ' + roman('hello');
      const locks = [{start:0,end:3,text:'再',lang:'TW'},{start:4,end:7,text:'再',lang:'TW'}];
      const candidates = query('decode', raw, options, locks);
      assert.ok(candidates.length);
      assert.equal(engine.commitCandidate(candidates[0]), '再 再 hello');
      assert.ok(candidates.every(candidate => engine.commitCandidate(candidate).startsWith('再 再 ')));
      const view = query('segments', raw, options, locks);
      assert.deepEqual(view.segments.filter(segment => segment.locked).map(segment => [segment.start,segment.end]), [[0,3],[4,7]]);
      const menu = query('alternatives', raw, options, locks, {start:0,end:3});
      assert.ok(menu.items.some(item => item.constraint.text === '在'));
      const phrase = query('segments', 'us3lc3 ' + roman('hello'), options);
      assert.deepEqual(phrase.segments[0].splits, [{start:0,end:3},{start:3,end:6}]);
      const split = query('alternatives', 'us3lc3 ' + roman('hello'), options, [], {start:0,end:3});
      const ni = split.items.find(item => item.commitText === '妳');
      assert.ok(ni);
      assert.equal(query('decode', 'us3lc3 ' + roman('hello'), options, [ni.constraint])[0].text, '妳好 hello');
      const merge = query('segments', 'y/ ru8 xk7', options);
      assert.ok(merge.spans.some(span => span.start === 0 && span.end === 7));
      const choices = query('alternatives', 'y/ ru8 xk7', options, [], {start:0,end:7});
      const zengjia = choices.items.find(item => item.commitText === '增加');
      assert.ok(zengjia);
      assert.equal(query('decode', 'y/ ru8 xk7', options, [zengjia.constraint])[0].text, '增加了');
      const nameRaw = roman('gakkou tanaka hello');
      const nameMenu = query('alternatives', nameRaw, options, [], {start:7,end:13});
      const english = nameMenu.actions.find(item => item.kind === 'english');
      assert.equal(english.commitText, 'tanaka');
      assert.equal(query('decode', nameRaw, options, [english.constraint])[0].text, '学校 tanaka hello');
      const physical = nameMenu.actions.find(item => item.kind === 'raw');
      assert.equal(physical.commitText, nameRaw.slice(7,13));
      query('decode', nameRaw, options, [physical.constraint]);
      const pendingRaw = roman('hello kan');
      const pending = query('alternatives', pendingRaw, options, [], {start:6,end:9});
      const katakana = pending.actions.find(item => item.kind === 'katakana');
      assert.equal(katakana.text, 'カn'); assert.equal(katakana.commitText, 'カン');
      assert.equal(query('decode', pendingRaw, options, [katakana.constraint])[0].text, 'hello カン');
      query('decode', '/j5  ' + roman('hello'), options, [{start:0,end:4,text:'終',lang:'TW'}]);
      const unicode = query('segments', '😀 ' + roman('hello'), options);
      assert.equal(unicode.segments[0].end, 2);
    }
    const child = spawnSync(native, [], {input:requests.map(request => JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024});
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    const results = child.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(results.length, expected.length);
    results.forEach((result, index) => assert.deepEqual(normalize(result.ok), normalize(expected[index]), JSON.stringify(requests[index])));
  } finally { engine.dispose(); }
});

test('local menu caps conversion choices but preserves explicit languages and scripts', () => {
  const engine = createEngine();
  try {
    engine.setCustomEntries(Array.from({length:20}, (_, index) => ({reading:'ㄗㄞˋ',text:'選'+index})));
    const menu = engine.alternatives('y94', {start:0,end:3}, {layout:'qwerty'});
    assert.equal(menu.items.length, 9); assert.equal(menu.truncated, true);
    assert.ok(menu.actions.some(item => item.kind === 'english'));
    assert.ok(menu.actions.some(item => item.kind === 'raw'));
    const disabled = engine.alternatives('y94', {start:0,end:3}, {english:false,japanese:false});
    assert.ok(disabled.actions.every(item => item.lang === 'RAW'));
    assert.equal(engine.segments('y94', {english:false,japanese:false,zhuyin:false}).candidate, null);
    assert.throws(() => engine.alternatives('us3lc3', {start:1,end:3}), /editable/);
    assert.throws(() => engine.segments('y94', {}, [], -1));
    assert.throws(() => engine.decodeConstrained('y94', [{start:0,end:3,text:'假',lang:'TW'}]), /reachable/);
  } finally { engine.dispose(); }
});

test('raw edits rebase or release whole locks, with native/WASM parity', () => {
  const engine = createEngine(), requests = [], expected = [];
  const lock = (start, end, text, lang = 'TW') => ({start,end,text,lang});
  const query = (input, nextInput, constraints, edit, options = {layout:'qwerty'}) => {
    const result = engine.rebaseConstraints(input, nextInput, constraints, options, edit);
    requests.push({version:1,op:'rebaseConstraints',input,nextInput,constraints,options,...(edit ? {edit} : {})});
    expected.push(result); return result;
  };
  try {
    const raw = 'y94 y94 hello', locks = [lock(0,3,'再'),lock(4,7,'再')];
    assert.deepEqual(query(raw, 'us3 '+raw, locks, {start:0,end:0,inserted:'us3 '}).constraints.map(c => [c.start,c.end]), [[4,7],[8,11]]);
    assert.deepEqual(query(raw, 'y94 us3 y94 hello', locks, {start:4,end:4,inserted:'us3 '}).constraints.map(c => [c.start,c.end]), [[0,3],[8,11]]);
    assert.equal(query(raw, 'yu94 y94 hello', locks, {start:1,end:1,inserted:'u'}).removed.length, 1);
    assert.deepEqual(query(raw, 'y94lc3 y94 hello', locks, {start:3,end:3,inserted:'lc3'}).constraints.map(c => [c.start,c.end]), [[0,3],[7,10]]);
    assert.equal(query(raw, 'y9 y94 hello', locks, {start:2,end:3,inserted:''}).removed.length, 1);
    assert.equal(query(raw, 'hello', locks, {start:0,end:8,inserted:''}).removed.length, 2);
    assert.equal(query('hello', 'hellox', [lock(0,5,'hello','EN')], {start:5,end:5,inserted:'x'}).constraints.length, 0);
    assert.equal(query('hello', "hello's", [lock(0,5,'hello','EN')], {start:5,end:5,inserted:"'s"}).constraints.length, 0);
    assert.equal(query('hello', 'hello ', [lock(0,5,'hello','EN')], {start:5,end:5,inserted:' '}).constraints.length, 1);
    assert.equal(query('hello', 'hellox', [lock(0,5,'hello','RAW')], {start:5,end:5,inserted:'x'}).constraints.length, 1);
    assert.equal(query('us', 'us3', [lock(0,2,'ㄋㄧ')], {start:2,end:2,inserted:'3'}).constraints.length, 0);
    assert.equal(query('m/4', 'm/4us3', [lock(0,3,'用')], {start:3,end:3,inserted:'us3'}).constraints.length, 1);
    assert.equal(query('hello kan', 'hello kana', [lock(6,9,'カン','JP')], {start:9,end:9,inserted:'a'}).constraints.length, 0);
    assert.equal(query('hello kan', "hello kan'", [lock(6,9,'カン','JP')], {start:9,end:9,inserted:"'"}).constraints.length, 0);
    assert.equal(query('hello kan', 'hello kan ', [lock(6,9,'カン','JP')], {start:9,end:9,inserted:' '}).constraints.length, 1);
    assert.equal(query('y94 hello', 'y94hello', [lock(4,9,'hello','EN')], {start:3,end:4,inserted:''}).constraints.length, 0);
    assert.deepEqual(query('😀 y94', '🙂😀 y94', [lock(3,6,'再')], {start:0,end:0,inserted:'🙂'}).constraints.map(c => [c.start,c.end]), [[5,8]]);
    assert.deepEqual(query('😀 y94', ' y94', [lock(3,6,'再')]).constraints.map(c => [c.start,c.end]), [[1,4]]);
    assert.equal(query('y94 y94', 'y94 y94 y94', locks).removed.length, 2);
    assert.equal(query(raw, raw, locks).removed.length, 0);
    const colemak = {layout:'colemak'}, hello = encode('hello');
    assert.equal(query(hello, hello+encode('O'), [lock(0,5,'hello','EN')], {start:5,end:5,inserted:':'}, colemak).removed.length, 1);
    assert.equal(query(hello, hello+encode(':'), [lock(0,5,'hello','EN')], {start:5,end:5,inserted:'P'}, colemak).constraints.length, 1);
    const punct = [lock(3,4,'（','punct')];
    assert.deepEqual(query('y94(', 'y94 ', punct, {start:3,end:4,inserted:' '}).constraints, []);
    assert.deepEqual(query('y94(', 'us3 y94(', punct, {start:0,end:0,inserted:'us3 '}).constraints.map(c => [c.start,c.end]), [[7,8]]);
    assert.equal(query('1 ', '1  ', [lock(0,2,'ㄅ')], {start:2,end:2,inserted:' '}).constraints.length, 1);
    assert.equal(query('1 ', '2 ', [lock(0,2,'ㄅ')], {start:0,end:1,inserted:'2'}).removed.length, 1);
    assert.throws(() => query('😀 y94', ' y94', [lock(3,6,'再')], {start:1,end:2,inserted:''}), /range/);
    assert.throws(() => query(raw, 'hello', locks, {start:0,end:1,inserted:''}), /match/);
    const child = spawnSync(native, [], {input:requests.map(request => JSON.stringify(request)).join('\n')+'\n',encoding:'utf8',maxBuffer:4*1024*1024});
    assert.equal(child.status, 0, child.stderr);
    child.stdout.trim().split('\n').forEach((line, index) => assert.deepEqual(JSON.parse(line).ok, expected[index], JSON.stringify(requests[index])));
    engine.setCustomEntries([{reading:'ㄗㄞˋ',text:'自訂'}]);
    const custom = [lock(0,3,'自訂')];
    engine.setCustomEntries([]);
    assert.equal(engine.rebaseConstraints('y94', 'y94', custom).removed.length, 1);
  } finally { engine.dispose(); }
});

 test('Chinese local confidence is deterministic, bounded to editable unlocked segments and native/WASM equal', () => {
 const engine=createEngine(), options={layout:'qwerty',japanese:false};
 try {
  const before=engine.decode('y94 hello',options),view=engine.segments('y94 hello',options);
  const margin=view.segments[0].confidenceMargin;assert.equal(typeof margin,'number');
  assert.equal(view.segments[1].confidenceMargin,null);assert.equal(view.segments[2].confidenceMargin,null);
  assert.deepEqual(engine.segments('y94 hello',options),view);
  assert.deepEqual(engine.decodeConstrained('y94 hello',[],options),before);
  const lock=engine.alternatives('y94 hello',{start:0,end:3},options).items[1].constraint;
  assert.equal(engine.segments('y94 hello',options,[lock]).segments[0].confidenceMargin,null);
  const request={version:1,op:'segments',input:'y94 hello',options};
  const child=spawnSync(native,[],{input:JSON.stringify(request)+'\n',encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const normalized=value=>JSON.parse(JSON.stringify(value,(key,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v));
  assert.deepEqual(normalized(JSON.parse(child.stdout).ok),normalized(view));
 }finally {engine.dispose()}
 });

test('explicit English memory is atomic, per-engine, layout-aware and subordinate to explicit locks', () => {
 const engine=createEngine(),empty=createEngine(),requests=[],expected=[];
 const query=(op,fields)=>{const value=op==='setCustomEnglishEntries'?engine.setCustomEnglishEntries(fields.entries):op==='setCustomEntries'?engine.setCustomEntries(fields.entries):engine.decodeConstrained(fields.input,fields.constraints??[],fields.options);requests.push({version:1,op,...fields});expected.push(value);return value};
 try{
  for(const layout of ['qwerty','colemak']){
   const raw=layout==='qwerty'?'gakkou':encode('gakkou'),options={layout};
   query('setCustomEnglishEntries',{entries:[]});const ordinary=engine.decode(raw,options);assert.equal(ordinary[0].text,'学校');
   assert.deepEqual(query('decode',{input:raw,options,constraints:[]}),ordinary);
   query('setCustomEnglishEntries',{entries:['gakkou','Term_2',"O'Brien"]});
   assert.equal(query('decode',{input:raw,options})[0].text,'gakkou');
   assert.equal(query('decode',{input:raw+'.',options})[0].text,'gakkou.');
   assert.equal(query('decode',{input:'us3lc3 '+raw,options})[0].text,'你好 gakkou');
   assert.equal(query('decode',{input:engine.readingKeys('ㄍㄤ').join('')+raw,options})[0].text,'剛gakkou');
   assert.equal(empty.decode(raw,options)[0].text,'学校');
   assert.equal(query('decode',{input:raw,options:{...options,english:false}})[0].text,'学校');
   const choice=engine.alternatives(raw,{start:0,end:raw.length},options).items.find(c=>c.commitText==='学校');
   assert.ok(choice);assert.equal(query('decode',{input:raw,options,constraints:[choice.constraint]})[0].text,'学校');
   assert.throws(()=>engine.setCustomEnglishEntries(['valid','two words']));
   assert.equal(engine.dictionarySize().englishCustom,3);assert.equal(engine.decode(raw,options)[0].text,'gakkou');
   query('setCustomEntries',{entries:[{reading:'ㄗㄞˋ',text:'載'}]});assert.equal(engine.decode(raw,options)[0].text,'gakkou');
   query('setCustomEnglishEntries',{entries:[]});assert.equal(engine.decode('y94',{layout})[0].text,'載');
   assert.deepEqual(engine.decode(raw,options),empty.decode(raw,options));
  }
  const longest='a'.repeat(40);engine.setCustomEnglishEntries([longest]);assert.equal(engine.decode(longest+'.',{layout:'qwerty'}).length,1);
  engine.setCustomEnglishEntries(['gakkou']);assert.doesNotThrow(()=>engine.decode('a'.repeat(401)));
  assert.throws(()=>engine.setCustomEnglishEntries(Array(201).fill('word')));
  assert.throws(()=>engine.setCustomEnglishEntries(['中文']));
  const child=spawnSync(native,[],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8',maxBuffer:16e6});assert.equal(child.status,0,child.stderr);
  child.stdout.trim().split('\n').forEach((line,i)=>assert.deepEqual(normalize(JSON.parse(line).ok),normalize(expected[i]),JSON.stringify(requests[i])));
  const prototype=createEngine({dictionary:'prototype'});try{assert.throws(()=>prototype.setCustomEnglishEntries(['word']))}finally{prototype.dispose()}
 }finally {engine.dispose();empty.dispose()}
});

test('Remember metadata uses composed Chinese readings, including unordered/replaced slots and phrase tones', () => {
 const e=createEngine();try{
  for(const raw of ['y94','us3lc3','sujo/5 ','1 ']){
   const view=e.segments(raw,{layout:'qwerty'});for(const span of view.spans){const page=e.alternatives(raw,span,{layout:'qwerty'});for(const choice of page.items.filter(c=>c.lang==='TW')){assert.ok(choice.rememberReading);assert.ok(e.readingKeys(choice.rememberReading).length);}}
  }
  const page=e.alternatives('m/4',{start:0,end:3},{layout:'qwerty'});assert.equal(page.items.find(c=>c.text==='用').rememberReading,'ㄩㄥˋ');
  const partial=e.alternatives('u',{start:0,end:1},{layout:'qwerty'});assert.ok(partial.items.every(c=>c.rememberReading===null));
 }finally {e.dispose()}
});
