// Bazel supplies license texts from the checksum-locked dependency repositories.
import {readFile, writeFile} from 'node:fs/promises';
const licenses = await Promise.all(['LICENSE.txt','LIBTABE-NOTICE.txt'].map(name=>readFile(new URL('../data/sources/mcbopomofo/'+name,import.meta.url),'utf8')));
const englishLicense=await readFile(new URL('../data/sources/scowl/Copyright',import.meta.url),'utf8');
const mozcLicense=await readFile(new URL('../data/sources/mozc/LICENSE',import.meta.url),'utf8');
const mozcDictionaryNotice=await readFile(new URL('../data/sources/mozc/README.txt',import.meta.url),'utf8');
const projectLicense=await readFile(new URL('../LICENSE',import.meta.url),'utf8');
const packages = JSON.parse(await readFile(new URL('../dependency-notices.json', import.meta.url), 'utf8'));
const dependencyNotices = packages.sort((a,b)=>a.name.localeCompare(b.name,'en')).map(pkg =>
  `${pkg.name} ${pkg.version} — MIT${pkg.names.length>1?' AND Unicode-3.0':''}\n\n${pkg.texts.join('\n\n')}`);
await writeFile(new URL('../web/dictionary-notices.txt',import.meta.url),
  'Polytype — original code\n\n'+projectLicense+'\n\nPolytype Chinese dictionary subset derived from McBopomofo\nhttps://github.com/openvanilla/McBopomofo\nPinned source and transformations: data/chinese-source.json and scripts/import-chinese.mjs\n\n'+licenses.join('\n\n')+'\n\nPolytype modified SCOWL 2020.12.07 subset: lowercase ASCII English/American words and contractions through level 60.\nhttps://wordlist.aspell.net/\nSee data/english-source.json and scripts/import-english.mjs for pinned source and transformations.\n\n'+englishLicense+'\n\nMozc default romaji table and open-source dictionary subset\nhttps://github.com/google/mozc\nPinned sources and transformations: data/japanese-source.json and scripts/import-japanese.mjs. The dictionary subset is IPAdic-derived and includes Okinawa dictionary entries; their notices follow the Mozc license and in the upstream dictionary README.\n\n'+mozcLicense+'\n\n'+mozcDictionaryNotice+'\n\nCargo dependency notices (including build dependencies)\n\n'+dependencyNotices.join('\n\n'));
