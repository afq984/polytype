import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile, realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {join, dirname} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Rust panic locations can otherwise include the builder's absolute paths,
// including paths embedded through dependency metadata. Use encoded flags so
// paths with spaces are not split by a shell. Later/more-specific mappings win.
const env={...process.env};
const flags=env.CARGO_ENCODED_RUSTFLAGS?.split('\x1f') ?? (env.RUSTFLAGS?.trim().split(/\s+/).filter(Boolean) ?? []);
const sysroot=execFileSync('rustc',['--print','sysroot'],{cwd:root,encoding:'utf8'}).trim();
for(const [path,label] of [[homedir(),'/build-home'],[process.env.CARGO_HOME||join(homedir(),'.cargo'),'/cargo-home'],[sysroot,'/rust-sysroot'],[root,'/polytype']]) {
  const resolved=await realpath(path).catch(()=>path);
  flags.push(`--remap-path-prefix=${path.replace(/[\\/]+$/,'')}=${label}`);
  if(resolved!==path)flags.push(`--remap-path-prefix=${resolved.replace(/[\\/]+$/,'')}=${label}`);
}
env.CARGO_ENCODED_RUSTFLAGS=flags.join('\x1f');delete env.RUSTFLAGS;
const run = (command, args) => execFileSync(command, args, {cwd: root, stdio: 'inherit',env});
let bindgen = process.env.WASM_BINDGEN || 'wasm-bindgen';
try { execFileSync(bindgen, ['--version'], {stdio:'pipe'}); }
catch (error) {
  if (process.env.WASM_BINDGEN || error.code !== 'ENOENT') throw error;
  bindgen = join(process.env.CARGO_HOME || join(homedir(), '.cargo'), 'bin', process.platform === 'win32' ? 'wasm-bindgen.exe' : 'wasm-bindgen');
}
const version = execFileSync(bindgen, ['--version'], {encoding:'utf8'}).trim();
if (version !== 'wasm-bindgen 0.2.128') throw new Error('Install the matching CLI: cargo install wasm-bindgen-cli --version 0.2.128 --locked');
run('cargo', ['build', '--locked', '--release', '-p', 'polytype-wasm', '--target', 'wasm32-unknown-unknown']);
await mkdir(new URL('../web/pkg/', import.meta.url), {recursive: true});
run(bindgen, ['target/wasm32-unknown-unknown/release/polytype_wasm.wasm', '--target', 'web', '--out-dir', 'web/pkg', '--out-name', 'polytype']);
const licenses = await Promise.all(['LICENSE.txt','LIBTABE-NOTICE.txt'].map(name=>readFile(new URL('../data/sources/mcbopomofo/'+name,import.meta.url),'utf8')));
const englishLicense=await readFile(new URL('../data/sources/scowl/Copyright',import.meta.url),'utf8');
const mozcLicense=await readFile(new URL('../data/sources/mozc/LICENSE',import.meta.url),'utf8');
const projectLicense=await readFile(new URL('../LICENSE',import.meta.url),'utf8');
const metadata=JSON.parse(execFileSync('cargo',['metadata','--locked','--format-version','1'],{cwd:root,encoding:'utf8',env}));
const dependencyNotices=[];
for(const pkg of metadata.packages.filter(pkg=>!metadata.workspace_members.includes(pkg.id)).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
  if(!['MIT','MIT OR Apache-2.0','Unlicense OR MIT','(MIT OR Apache-2.0) AND Unicode-3.0'].includes(pkg.license)) {
    throw new Error(`Review changed dependency license: ${pkg.name}`);
  }
  const names=['LICENSE-MIT',...(pkg.license.includes('Unicode-3.0')?['LICENSE-UNICODE']:[])];
  const texts=await Promise.all(names.map(name=>readFile(join(dirname(pkg.manifest_path),name),'utf8')));
  dependencyNotices.push(`${pkg.name} ${pkg.version} — MIT${names.length>1?' AND Unicode-3.0':''}\n\n${texts.join('\n\n')}`);
}
await writeFile(new URL('../web/dictionary-notices.txt',import.meta.url),
  'Polytype — original code\n\n'+projectLicense+'\n\nPolytype Chinese dictionary subset derived from McBopomofo\nhttps://github.com/openvanilla/McBopomofo\nPinned source and transformations: data/chinese-source.json and scripts/import-chinese.mjs\n\n'+licenses.join('\n\n')+'\n\nPolytype modified SCOWL 2020.12.07 subset: lowercase ASCII English/American words and contractions through level 60.\nhttps://wordlist.aspell.net/\nSee data/english-source.json and scripts/import-english.mjs for pinned source and transformations.\n\n'+englishLicense+'\n\nMozc default romaji table\nhttps://github.com/google/mozc\nPinned source: data/japanese-source.json. Only the romaji table is imported, not the dictionaries covered by additional notices below.\n\n'+mozcLicense+'\n\nCargo dependency notices (including build dependencies)\n\n'+dependencyNotices.join('\n\n'));
