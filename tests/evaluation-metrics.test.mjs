import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {caseMetrics, summarizeMilestone, normalizeBoundarySpaces, englishTokens, singleLanguage} from '../scripts/evaluation-metrics.mjs';
import {loadEvaluationCases} from '../scripts/evaluation-cases.mjs';

test('space normalization changes only literal Han/Latin or Han/digit boundaries', () => {
  assert.equal(normalizeBoundarySpaces('我  用 Python  3 寫 É 字'), '我  用Python  3寫É字');
  assert.equal(normalizeBoundarySpaces('𠀀 a 中 4文'), '𠀀a中4文');
  for (const text of ['hello world', 'hello  world', '中 文', '中 かな', '中\tA', '中\nA', '中　A', '中 .A', ' A ']) assert.equal(normalizeBoundarySpaces(text), text);
  assert.equal(caseMetrics('我用Python寫', ['我用 Python 寫']).spaceNormalizedRank, 1);
  assert.equal(caseMetrics('我用Python寫', ['我用python寫', '我用 Python 寫']).spaceNormalizedRank, 2);
  assert.equal(caseMetrics('我用Python寫', ['我 用 Python 寫']).spaceNormalizedRank, 0);
  assert.equal(caseMetrics('hello world', ['helloworld']).spaceNormalizedRank, 0);
  assert.equal(caseMetrics('我用Python寫', Array(5).fill('x').concat('我用Python寫')).spaceNormalizedRank, 0);
});

test('English exact matches whole unchanged ASCII tokens monotonically and counts duplicates', () => {
  assert.deepEqual(englishTokens("我用Python3 foo_bar v1.2 can't re-base _. - ."), ['Python3', 'foo_bar', 'v1.2', "can't", 're-base']);
  const measure = (target, actual) => caseMetrics(target, [actual]);
  assert.equal(measure('a b c', 'b c a').englishMatches, 2);
  assert.equal(measure('a a b', 'a b').englishMatches, 2);
  assert.equal(measure('a b', 'b a').englishMatches, 1);
  assert.equal(measure('hello', 'shelloworld').englishMatches, 0);
  assert.equal(measure('Python', 'python').englishMatches, 0);
  assert.equal(measure('v1.2 foo_bar', 'v1.2 foo-bar').englishMatches, 1);
  assert.equal(measure('hello.', 'hello').englishMatches, 0);
  assert.equal(measure('我用Python寫', '我 用 Python 寫').englishMatches, 1);
});

test('Han CER aligns only Han code points and retains insertions, deletions and substitutions', () => {
  const measure = (target, actual) => caseMetrics(target, [actual]);
  assert.deepEqual([measure('你A好！', '你 B 好').hanEdits, measure('你A好！', '你 B 好').hanCharacters], [0, 2]);
  assert.equal(measure('你好', '妳好').hanEdits, 1);
  assert.equal(measure('你好', '你好嗎').hanEdits, 1);
  assert.equal(measure('你好', '你').hanEdits, 1);
  assert.equal(measure('𠀀', '𠀀').hanCharacters, 1);
  assert.equal(measure('中', '你好嗎').hanEdits, 3);
  assert.equal(summarizeMilestone([measure('中', '你好嗎')]).hanCER, 3);
});

test('wrong-language rate includes only single-script targets and the specified intrusions', () => {
  assert.equal(singleLanguage('Hello, 42!'), 'english');
  assert.equal(singleLanguage('你好，42！'), 'chinese');
  for (const text of ['你好 hello', 'かな', '中文かな', '42', '...']) assert.equal(singleLanguage(text), null);
  for (const actual of ['Hello漢', 'Helloかな', 'Helloカナ', 'Helloー', 'Helloㄅ']) assert.equal(caseMetrics('Hello!', [actual]).wrongLanguage, true);
  for (const actual of ['你A好', '你ㄅ好']) assert.equal(caseMetrics('你好！', [actual]).wrongLanguage, true);
  for (const actual of ['你好', '你好42', '你好かな']) assert.equal(caseMetrics('你好！', [actual]).wrongLanguage, false);
  assert.equal(caseMetrics('你好 Hello', ['ㄅ']).wrongLanguage, null);
  const summary = summarizeMilestone([
    caseMetrics('Hello!', ['Hello漢']), caseMetrics('你好！', ['你好42']), caseMetrics('你好 Hello', ['ㄅ']),
  ]);
  assert.equal(summary.wrongLanguage, 1 / 2); assert.equal(summary.singleLanguageCases, 2);
});

test('milestone rates pool denominators and mark inapplicable groups null', () => {
  const summary = summarizeMilestone([caseMetrics('a b c', ['a b']), caseMetrics('d', ['x'])]);
  assert.equal(summary.englishExact, 2 / 4); assert.equal(summary.englishTokens, 4);
  assert.equal(summary.hanCER, null);
  const mixed = summarizeMilestone([caseMetrics('我用Python寫', ['我用 Python 寫'])]);
  assert.equal(mixed.spaceNormalizedTop1, 1); assert.equal(mixed.spaceNormalizedTop5, 1);
  assert.equal(mixed.englishExact, 1); assert.equal(mixed.hanCER, 0); assert.equal(mixed.wrongLanguage, null);
  const empty = summarizeMilestone([]);
  for (const key of ['englishExact', 'hanCER', 'wrongLanguage']) assert.equal(empty[key], null);
  const noOutput = summarizeMilestone([caseMetrics('你好', [])]);
  assert.equal(noOutput.spaceNormalizedTop5, 0); assert.equal(noOutput.hanCER, 1);
});

test('extra modules and JSONL preserve groups/options/segments and split configuration metrics', async t => {
  const root = await mkdtemp(join(process.env.TEST_TMPDIR || tmpdir(), 'polytype-evaluation-test-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const options = {layout:'colemak', english:true, japanese:false, zhuyin:false};
  const base = {id:'base', group:'fixture', raw:'42', text:'42', options};
  const extra = {id:'extra', group:'fixture', raw:'42', text:'42', options:{...options, layout:'qwerty'}, segments:[{text:'42', language:'en'}]};
  const path = join(root, 'base.jsonl'), module = join(root, 'extra.mjs');
  await writeFile(path, JSON.stringify(base) + '\n');
  await writeFile(module, 'export const cases = ' + JSON.stringify([extra]) + ';\n');
  const loaded = await loadEvaluationCases([path, '--extra-cases=' + module], []);
  assert.deepEqual(loaded.cases, [base, extra]);
  assert.deepEqual((await loadEvaluationCases(['--extra-cases', module], [base])).cases, [base, extra]);
  await assert.rejects(loadEvaluationCases(['--extra-cases'], []), /module path/);
  const invalid = join(root, 'invalid.mjs'); await writeFile(invalid, 'export const cases = null;\n');
  await assert.rejects(loadEvaluationCases(['--extra-cases=' + invalid], []), /array/);
  const reportPath = new URL('../eval/report.json', import.meta.url);
  const before = await readFile(reportPath);
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/evaluate.mjs', import.meta.url)), path, '--extra-cases=' + module], {encoding:'utf8'});
  assert.equal(child.status, 0, child.stderr);
  const report = JSON.parse(child.stdout);
  assert.equal(report.extraCaseModules, 1);
  for (const profile of Object.values(report.profiles)) {
    assert.equal(profile.groups.fixture.cases, 2);
    assert.equal(profile.groups.fixture.top1, 2); assert.equal(profile.groups.fixture.englishExact, 1);
    const groups = Object.values(profile.configurationGroups);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map(group => group.options.layout), ['colemak', 'qwerty']);
    for (const group of groups) {assert.equal(group.cases, 1); assert.equal(group.top1, 1);}
  }
  assert.deepEqual(await readFile(reportPath), before);
});
