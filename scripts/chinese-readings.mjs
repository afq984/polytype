// McBopomofo's pinned main_compiler.py operates on base-10 log frequencies,
// despite using ln(2) as its secondary/tertiary subtraction constant.
export const heterophonyDefaultLog=-6.8;
export const heterophonyStep=0.69314718055994;
export function heterophonyList(text) {
  // Upstream dictionaries use the last row for duplicate character keys.
  return new Map(text.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#')).map(line=>line.trim().split(/\s+/)));
}
export function upstreamNormalization(occurrence,exclusion) {
  const counts=new Map(occurrence);
  const exclusions=new Map();
  for(const line of exclusion.split(/\r?\n/)) {
    if(!line.trim()||line.startsWith('#'))continue;
    const [key,value]=line.trim().split(/\s+/);
    if(value.includes(key)) {
      if(!exclusions.has(key))exclusions.set(key,[]);
      exclusions.get(key).push(value);
    }
  }
  for(const [key,values] of exclusions)for(const value of values)if(counts.has(key)&&counts.has(value))counts.set(key,counts.get(key)-counts.get(value));
  let norm=0;
  for(const [text,count] of counts)norm+=2.7**([...text].length-1)*count;
  return norm;
}
export function readingCounter(lists,norm) {
  const [primary,secondary,tertiary]=lists.map(heterophonyList);
  const floor=norm*10**heterophonyDefaultLog;
  return (text,reading,count)=>{
    if([...text].length!==1||!primary.has(text)||primary.get(text)===reading)return count;
    if(!secondary.has(text))return floor;
    if(secondary.get(text)===reading)return Math.max(floor,count*10**-heterophonyStep);
    if(!tertiary.has(text))return floor;
    if(tertiary.get(text)===reading)return Math.max(floor,count*10**(-2*heterophonyStep));
    return floor;
  };
}
