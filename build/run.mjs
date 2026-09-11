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
} else if (mode === 'refresh') {
  if (!workspace) throw new Error('Use bazelisk run //:refresh_demo');
  await publish(join(root, 'Polytype-Demo.html'), join(workspace, 'Polytype-Demo.html'));
  await publish(join(root, 'web/dictionary-notices.txt'), join(workspace, 'web/dictionary-notices.txt'));
  console.log('Updated checked-in standalone demo and notices.');
} else if (mode === 'measure-evaluation') {
  run('scripts/evaluate.mjs', ['--timing', ...args.map(arg => resolve(caller, arg))]);
} else if (mode === 'evaluate-local') {
  if (args.length !== 1) throw new Error('Use bazelisk run //:evaluate_local -- PATH.jsonl');
  run('scripts/evaluate.mjs', [resolve(caller, args[0])]);
} else if (mode === 'benchmark') {
  run('scripts/benchmark-search.mjs', args.map(arg => resolve(caller, arg)));
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
        'verify-corpus': ['verify-corpus.mjs', ['eval/sources']],
        'experiment-islands': ['experiment-islands.mjs', ['eval/island-experiments.json']],
        'compare-search': ['compare-search.mjs', ['eval/diversity-report.md']],
      };
      const command = commands[mode];
      if (!command || !workspace) throw new Error(`Unknown command: ${mode}`);
      if (args.includes('--freeze')) throw new Error('Frozen migration evidence must not be overwritten.');
      run('scripts/' + command[0], args, work);
      for (const name of command[1]) await publish(join(work, name), join(workspace, name));
    }
  } finally {
    await rm(temporary, {recursive:true, force:true});
  }
}
