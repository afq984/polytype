import {readFile, writeFile} from 'node:fs/promises';
const load = name => readFile(new URL('../web/' + name, import.meta.url), 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const [html, css, glue, keyboard, engine, app, bootstrap, wasm] = await Promise.all([
  ...['index.html', 'style.css', 'pkg/polytype.js', 'keyboard.mjs', 'engine.mjs', 'app.mjs', 'bootstrap.mjs'].map(load),
  readFile(new URL('../web/pkg/polytype_bg.wasm', import.meta.url)),
]);
// Embed the real WASM and its ES modules; no alternate JavaScript decoder.
// Data URLs keep this file runnable offline, without file-URL fetch permissions.
const engineUrl = moduleUrl(engine
  .replace("'./pkg/polytype.js'", JSON.stringify(moduleUrl(glue)))
  .replace("'./keyboard.mjs'", JSON.stringify(moduleUrl(keyboard)))
  .replace("new URL('./pkg/polytype_bg.wasm', import.meta.url)", JSON.stringify('data:application/wasm;base64,' + wasm.toString('base64'))));
const appUrl = moduleUrl(app.replace("'./engine.mjs'", JSON.stringify(engineUrl)));
const startup = bootstrap.replace("'./app.mjs'", JSON.stringify(appUrl));
const notices=await load('dictionary-notices.txt');
const escaped=notices.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const output = html
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + css + '</style>')
  .replace('<script type="module" src="bootstrap.mjs"></script>', () => '<script type="module">' + startup + '</script>')
  .replace('<a href="dictionary-notices.txt">Dictionary sources and licenses</a>',()=>'<details><summary>Dictionary sources and licenses</summary><pre style="white-space:pre-wrap">'+escaped+'</pre></details>');
await writeFile(new URL('../Polytype-Demo.html', import.meta.url), output);
console.log('Wrote Polytype-Demo.html with embedded Rust/WASM');
