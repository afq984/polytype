import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function loadEvaluationCases(args, bundled) {
  let external, timing = false, correction = false;
  const modules = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--timing') timing = true;
    else if (arg === '--correction') correction = true;
    else if (arg === '--extra-cases' || arg.startsWith('--extra-cases=')) {
      const path = arg === '--extra-cases' ? args[++i] : arg.slice('--extra-cases='.length);
      if (!path || path.startsWith('--')) throw new Error('Provide a case module path after --extra-cases');
      modules.push(path);
    } else if (arg.startsWith('--') || external) throw new Error('Use [PATH.jsonl] [--extra-cases=PATH.mjs] [--timing] [--correction]');
    else external = arg;
  }
  let cases = bundled;
  if (external) cases = (await readFile(external, 'utf8')).split('\n').filter(line => line.trim()).map((line, i) => {
    const entry = JSON.parse(line);
    return {...entry, id:entry.id ?? `local-${i + 1}`, group:entry.group ?? 'local'};
  });
  for (const path of modules) {
    const module = await import(pathToFileURL(resolve(path)).href);
    const extra = module.cases ?? module.default;
    if (!Array.isArray(extra)) throw new Error('Case modules must export an array named cases or a default array');
    cases = [...cases, ...extra];
  }
  if (!cases.length) throw new Error('Empty evaluation corpus');
  for (const [i, entry] of cases.entries()) {
    if (!entry || typeof entry.raw !== 'string' || typeof entry.text !== 'string' || entry.raw.length > 400
      || (entry.group !== undefined && typeof entry.group !== 'string')) throw new Error(`Invalid evaluation row ${i + 1}`);
  }
  return {cases:cases.map(entry => ({...entry, group:entry.group ?? 'local'})), external, timing, correction, extraModules:modules.length};
}
