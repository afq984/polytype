import {readFileSync} from 'node:fs';
import {encodeMixedInput} from './cases.mjs';
export const controls=JSON.parse(readFileSync(new URL('./diversity-controls.json',import.meta.url)));
export const diversityCases=controls.cases.flatMap(row=>['colemak','qwerty'].flatMap(layout=>(row.chunks?[true]:[true,false]).map(zhuyin=>({
  ...row,id:`diversity-${row.id}-${layout}-${zhuyin?'all':'en-jp'}`,
  group:`diversity-${row.group}`,
  raw:(row.chunks??[{roman:row.input}]).map(chunk=>chunk.keys??(layout==='colemak'?encodeMixedInput(chunk.roman):chunk.roman)).join(''),
  options:{layout,english:true,japanese:true,zhuyin},
}))));
