// Text-only diagnostics. These never affect decoding or exact-output scoring.
const han = /\p{Script=Han}/u;
const latin = /\p{Script=Latin}/u;
const letter = /\p{Letter}/u;
const englishIntrusion = /[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Bopomofo}]/u;
const chineseIntrusion = /[\p{Script=Latin}\p{Script_Extensions=Bopomofo}]/u;

export function distance(a, b) {
  a = [...a]; b = [...b]; let previous = Array.from({length:b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

export function normalizeBoundarySpaces(text) {
  return text.replace(/(?<=\p{Script=Han}) +(?=[\p{Script=Latin}0-9])|(?<=[\p{Script=Latin}0-9]) +(?=\p{Script=Han})/gu, '');
}

export const englishTokens = text => (text.match(/[A-Za-z0-9'_.-]+/g) ?? []).filter(token => /[A-Za-z0-9]/.test(token));
const hanText = text => [...text].filter(char => han.test(char)).join('');

// Maximum number of whole, unchanged tokens matched monotonically (LCS).
// Duplicates need distinct occurrences; missing an early token cannot hide later matches.
function orderedMatches(target, actual) {
  let previous = Array(actual.length + 1).fill(0);
  for (const token of target) {
    const current = [0];
    for (let j = 1; j <= actual.length; j++) current[j] = token === actual[j - 1]
      ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    previous = current;
  }
  return previous[actual.length];
}

export function singleLanguage(text) {
  const letters = [...text].filter(char => letter.test(char));
  if (!letters.length) return null;
  if (letters.every(char => latin.test(char))) return 'english';
  if (letters.every(char => han.test(char))) return 'chinese';
  return null;
}

export function caseMetrics(target, outputs) {
  const actual = outputs[0] ?? '', tokens = englishTokens(target);
  const language = singleLanguage(target), expectedHan = hanText(target);
  const normalizedRank = outputs.slice(0, 5).findIndex(output => normalizeBoundarySpaces(output) === normalizeBoundarySpaces(target)) + 1;
  return {
    spaceNormalizedRank:normalizedRank,
    englishMatches:orderedMatches(tokens, englishTokens(actual)), englishTokens:tokens.length,
    hanEdits:distance(expectedHan, hanText(actual)), hanCharacters:[...expectedHan].length,
    singleLanguage:language,
    wrongLanguage:language === null ? null : (language === 'english' ? englishIntrusion : chineseIntrusion).test(actual),
  };
}

export function summarizeMilestone(rows) {
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const englishMatches = sum('englishMatches'), tokens = sum('englishTokens');
  const hanEdits = sum('hanEdits'), hanCharacters = sum('hanCharacters');
  const singleLanguageCases = rows.filter(row => row.wrongLanguage !== null).length;
  const wrongLanguageCases = rows.filter(row => row.wrongLanguage === true).length;
  return {
    spaceNormalizedTop1:rows.filter(row => row.spaceNormalizedRank === 1).length,
    spaceNormalizedTop5:rows.filter(row => row.spaceNormalizedRank > 0).length,
    englishExact:tokens ? englishMatches / tokens : null, englishMatches, englishTokens:tokens,
    hanCER:hanCharacters ? hanEdits / hanCharacters : null, hanEdits, hanCharacters,
    wrongLanguage:singleLanguageCases ? wrongLanguageCases / singleLanguageCases : null,
    wrongLanguageCases, singleLanguageCases,
  };
}
