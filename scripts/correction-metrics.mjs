// Bounded recovery through the real Rust/WASM correction API, without retyping.
export const correctionLimits = {maxDepth:2,stateBudget:2000};
const keyFor = constraints => JSON.stringify([...constraints].sort((a,b)=>a.start-b.start));

export function correctionEdits(engine, entry, {maxDepth=2,stateBudget=2000} = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 2 || !Number.isInteger(stateBudget) || stateBudget < 1 || stateBudget > 2000) throw new Error('Correction bounds must be depth <=2 and states <=2000');
  const {raw,options,text:target} = entry;
  const initial = engine.decode(raw, options);
  const base = {bounded:true,maxDepth,stateBudget,wholeCandidateTop5:initial.some(candidate=>engine.commitCandidate(candidate)===target)};
  let statesVisited=1, menuTruncated=false;
  const result = (edits,path,budgetExhausted=false) => ({...base,edits,path,statesVisited,menuTruncated,budgetExhausted});
  if (initial[0] && engine.commitCandidate(initial[0])===target) return result(0,[]);
  if (!initial.length || !maxDepth) return result(null,[]);
  const queue = [{constraints:[],path:[],depth:0}], seen = new Set([keyFor([])]);
  const visit = (constraints,state,action) => {
    const key=keyFor(constraints);
    if(seen.has(key))return;
    if(statesVisited>=stateBudget)return result(null,[],true);
    seen.add(key);statesVisited++;
    let candidates;
    try{candidates=engine.decodeConstrained(raw,constraints,options)}catch{return}
    if(!candidates.length)return;
    const depth=state.depth+1,path=[...state.path,action];
    if(engine.commitCandidate(candidates[0])===target)return result(depth,path);
    if(depth<maxDepth)queue.push({constraints,path,depth});
  };
  for(let at=0;at<queue.length;at++){
    const state=queue[at];
    const view=engine.segments(raw,options,state.constraints,0);
    for(const span of view.spans){
      const page=engine.alternatives(raw,span,options,state.constraints,0);
      menuTruncated ||= page.truncated;
      for(const choice of [...page.items,...page.actions]){
        const constraints=[...state.constraints.filter(c=>c.start!==span.start||c.end!==span.end),choice.constraint].sort((a,b)=>a.start-b.start);
        const found=visit(constraints,state,{op:'choose',constraint:choice.constraint});
        if(found)return found;
      }
    }
    for(const lock of state.constraints){
      const found=visit(state.constraints.filter(c=>c!==lock),state,{op:'unlock',start:lock.start,end:lock.end});
      if(found)return found;
    }
  }
  return result(null,[]);
}

export function summarizeCorrections(rows) {
  const corrections=rows.map(row=>row.correction).filter(Boolean);
  return {bounded:true,...correctionLimits,cases:corrections.length,
    zero:corrections.filter(row=>row.edits===0).length,
    atMostOne:corrections.filter(row=>row.edits!==null&&row.edits<=1).length,
    atMostTwo:corrections.filter(row=>row.edits!==null&&row.edits<=2).length,
    unresolved:corrections.filter(row=>row.edits===null).length,
    budgetExhausted:corrections.filter(row=>row.budgetExhausted).length,
    menuTruncated:corrections.filter(row=>row.menuTruncated).length,
    wholeCandidateTop5:corrections.filter(row=>row.wholeCandidateTop5).length};
}
