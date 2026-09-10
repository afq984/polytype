import {readingKeys,encode} from '../web/engine.mjs';
const tw=reading=>readingKeys(reading).join('');
export const captureA='xu;62l42k7 r95 uafkjco y/ ru8 xk7 11.6% c96y94z04jo65 so4';
export const captureB='ji3vu;31j62l4c96dk3u3hk4gp6ak7 su3gji gjji vu84ek7 drsljf ul4e04a86187 cji4g4m/4 hksgs ep cuaigk wl3xjp4';
export const islandCases=[
  {id:'capture-a',raw:captureA,options:{layout:'colemak'},island:'p95 latency'},
  {id:'capture-b',raw:captureB,options:{layout:'colemak'},island:'claude',boundary:true},
  {id:'capture-b-separated',raw:captureB.replace('ep cuaigk','ep  cuaigk'),options:{layout:'colemak'},island:'claude'},
  ...['qwerty','colemak'].flatMap(layout=>{
    const roman=s=>layout==='colemak'?encode(s):s;
    const islands=['deadline','sync','case','point','care','p99 throughput','v2 release','abc123 report','r2 update'];
    return [
      ...islands.map((s,i)=>({id:`island-${layout}-${i}`,raw:tw('ㄗ ㄌㄧㄠˋ')+' '+roman(s)+' '+tw('ㄏㄣˇ ㄏㄠˇ'),options:{layout},island:s})),
      ...['sake','hi','me','shinyou',"shin'you",'shinnyou','checkshite','hellosakura','apo','purezen','check k7','the k7'].map((s,i)=>({id:`probe-${layout}-${i}`,raw:roman(s),options:{layout}})),
      ...['ㄓㄨㄥ ㄋㄟˋ','ㄕㄨㄛ ㄕㄨㄛ','ㄊㄧㄢ ㄑㄧˋ','ㄍㄣ ㄋㄧˇ','ㄗ ㄌㄧㄠˋ ㄎㄨˋ'].map((reading,i)=>({id:`chinese-${layout}-${i}`,raw:tw(reading),options:{layout},chinese:true})),
      ...['/j5 ','sujo/5 ','us3lc3','m/4','gjji ','uafkjco '].map((raw,i)=>({id:`slots-${layout}-${i}`,raw,options:{layout},chinese:true})),
      {id:`tone-boundary-${layout}`,raw:tw('ㄍㄣ')+roman('claude')+' '+tw('ㄊㄠˇ ㄌㄨㄣˋ'),options:{layout},island:'claude',boundary:true},
    ];
  }),
  ...['OK','NG','DM','RT'].map(raw=>({id:`abbreviation-${raw}`,raw,options:{layout:'qwerty'}})),
];
