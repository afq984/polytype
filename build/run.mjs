import {spawn, execFileSync} from 'node:child_process';
import {cp, copyFile, mkdir, mkdtemp, readdir, rm, chmod, stat, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';

const [mode, directory, ...args] = process.argv.slice(2);
const root = resolve(directory);
const workspace = process.env.BUILD_WORKSPACE_DIRECTORY;
const caller = process.env.BUILD_WORKING_DIRECTORY || process.cwd();
const run = (script, argv = [], cwd = root) => execFileSync(process.execPath, [join(cwd, script), ...argv], {cwd, stdio:'inherit'});
function evaluationArgs(args) {
  return args.map(arg => arg.startsWith('--extra-cases=')
    ? '--extra-cases=' + resolve(caller, arg.slice('--extra-cases='.length))
    : arg.startsWith('--') ? arg : resolve(caller, arg));
}
async function makeWritable(path) {
  const info = await stat(path);
  await chmod(path, info.mode | (info.isDirectory() ? 0o700 : 0o200));
  if (info.isDirectory()) for (const name of await readdir(path)) await makeWritable(join(path, name));
}
async function publish(source, destination) {
  if ((await stat(source)).isDirectory()) {
    await mkdir(destination, {recursive:true});
    for (const name of await readdir(source)) await publish(join(source, name), join(destination, name));
  } else {
    await chmod(destination, 0o644).catch(error => {if (error.code !== 'ENOENT') throw error;});
    await writeFile(destination, await readFile(source), {mode:0o644});
  }
}

if (mode === 'test') {
  const tests = (await readdir(join(root, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort();
  execFileSync(process.execPath, ['--test', ...tests.map(name => join(root, 'tests', name))], {cwd:root, stdio:'inherit'});
} else if (mode === 'audit') {
  run('scripts/audit-public.mjs');
} else if (mode === 'reproduce') {
  run('build/reproduce.mjs');
} else if (mode === 'serve' || mode === 'preview') {
  run('scripts/serve.mjs', mode === 'preview' ? ['--pages', ...args] : args);
} else if (mode === 'browser') {
  const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--pages'], {cwd:root, env:{...process.env, PORT:'0'}, stdio:['ignore','pipe','inherit']});
  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
      let output = '';
      server.once('error', error => {clearTimeout(timeout); reject(error);});
      server.once('exit', () => {clearTimeout(timeout); reject(new Error('Preview exited before startup'));});
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/polytype\//);
        if (match) {clearTimeout(timeout); resolve(match[0]);}
      });
    });
    const browser = spawn(process.execPath, [join(root, 'scripts/browser-smoke.mjs')], {cwd:root, env:{...process.env, DEMO_URL:url}, stdio:'inherit'});
    const [code] = await once(browser, 'exit');
    if (code !== 0) throw new Error(`Browser smoke failed (${code})`);
  } finally {
    const stopped = once(server, 'exit');
    server.kill();
    if (server.exitCode === null) await stopped;
  }
} else if (mode === 'measure-evaluation') {
  run('scripts/evaluate.mjs', ['--timing', ...evaluationArgs(args)]);
} else if (mode === 'evaluate-local') {
  if (!args.length) throw new Error('Use bazelisk run //:evaluate_local -- [PATH.jsonl] [--extra-cases=PATH.mjs]');
  run('scripts/evaluate.mjs', evaluationArgs(args));
} else if (mode === 'corpus') {
  // Resolve user paths against the invoking directory, never the runfiles tree.
  const argv = [...args];
  if (argv[1]) argv[1] = resolve(caller, argv[1]);
  if (argv[0] === 'import' && argv[2]) argv[2] = resolve(caller, argv[2]);
  try {run('scripts/corpus.mjs', argv);}
  catch (error) {process.exitCode = error.status || 1;} // The tool already prints a text-free diagnostic.

} else if (mode === 'benchmark') {
  run('scripts/benchmark-search.mjs', args.map(arg => resolve(caller, arg)));
} else if (mode === 'confidence-diagnostics') {
  run('scripts/confidence-diagnostics.mjs', args);
} else if (mode === 'numbers-diagnostics') {
  run('scripts/numbers-diagnostics.mjs', args.map(arg => resolve(caller, arg)));
} else if (mode === 'diagnose') {
  run('scripts/search-diagnostics.mjs', args.map(arg => arg.startsWith('--') ? arg : resolve(caller, arg)));
} else {
  // Report generation and explicit network maintenance get writable copies.
  // Normal build/test inputs and the Bazel runfiles tree remain immutable.
  const temporary = await mkdtemp(join(process.env.TEST_TMPDIR || tmpdir(), 'polytype-run-'));
  try {
    const work = join(temporary, 'work');
    await cp(root, work, {recursive:true, dereference:true});
    await makeWritable(work);
    if (mode === 'evaluation-build') {
      const destination = resolve(args[0]);
      run('scripts/evaluate.mjs', [], work);
      await mkdir(destination, {recursive:true});
      for (const name of ['report.json', 'REPORT.md']) await copyFile(join(work, 'eval', name), join(destination, name));
    } else {
      const commands = {
        'import-chinese': ['import-chinese.mjs', ['data/chinese.tsv', 'data/chinese-source.json', 'data/sources/mcbopomofo/LICENSE.txt']],
        'import-english': ['import-english.mjs', ['data/english.tsv', 'data/english-source.json', 'data/sources/scowl/Copyright']],
        'import-english-frequency': ['import-english-frequency.mjs', ['data/english-frequency.bin', 'data/english-frequency-source.json', 'data/sources/ecdict/LICENSE']],
        'baseline-zh-en': ['baseline-zh-en.mjs', ['eval/zh-en/REPORT.md']],
        'import-zh-en': ['import-zh-en.mjs', ['eval/zh-en', 'eval/sources/ASCEND-README.md', 'eval/sources/UD_English-EWT-README.md', 'eval/sources/UD_English-EWT-LICENSE.txt', 'eval/sources/OpenCC-LICENSE.txt', 'eval/sources/CC-CEDICT-NOTICE.txt']],
        'verify-zh-en': ['import-zh-en.mjs', []],
        'import-japanese': ['import-japanese.mjs', ['data/japanese.tsv', 'data/japanese-source.json', 'data/sources/mozc/README.txt']],
        'verify-corpus': ['verify-corpus.mjs', ['eval/sources']],
        'experiment-islands': ['experiment-islands.mjs', ['eval/island-experiments.json']],
        'compare-search': ['compare-search.mjs', ['eval/diversity-report.md']],
      };
      const command = commands[mode];
      if (!command || !workspace) throw new Error(`Unknown command: ${mode}`);
      if (args.includes('--freeze')) throw new Error('Frozen migration evidence must not be overwritten.');
      const commandArgs = ['import-chinese','import-english-frequency'].includes(mode) ? args.map(arg=>{
        for (const flag of ['--from-dir=', '--output-dir=']) if (arg.startsWith(flag)) return flag+resolve(caller,arg.slice(flag.length));
        return arg;
      }) : mode === 'verify-zh-en' ? ['--verify', ...args] : args;
      run('scripts/' + command[0], commandArgs, work);
      // An experimental cut must not publish dictionary files into the checkout.
      if (!(['import-chinese','import-english-frequency'].includes(mode) && args.some(arg=>arg.startsWith('--output-dir=')))) {
        for (const name of command[1]) await publish(join(work, name), join(workspace, name));
      }
    }
  } finally {
    await rm(temporary, {recursive:true, force:true});
  }
}
