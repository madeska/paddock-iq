export type Asset = {code:string; type:'DRIVER'|'CONSTRUCTOR'; price:number; expectedPoints:number; boostExpectedPoints?:number; expectedDelta:number; isDoubled?:boolean};
export type Mode = 'points'|'balanced'|'budget'|'custom';
export type Proposal = {out:string; incoming:string; projectedPointsGain:number; projectedValueGain:number; penalty:number; netPointsGain:number; score:number};
export function scoreProposal(pointsGain:number,valueGain:number,mode:Mode,customPointsWeight=0.6){
 const w=mode==='points'?1:mode==='budget'?0.3:mode==='balanced'?0.7:Math.max(0,Math.min(1,customPointsWeight));
 // Explicit reference scales: 20 fantasy points and $1m, not raw unit addition.
 return w*(pointsGain/20)+(1-w)*(valueGain/1);
}
export function optimizeOneTransfer(current:Asset[],market:Asset[],cash:number,freeTransfers:number,mode:Mode,customPointsWeight=0.6,penaltyPerExtra=10):Proposal[]{
 const owned=new Set(current.map(a=>a.code)); const penalty=freeTransfers>0?0:penaltyPerExtra;
 const results:Proposal[]=[];
 for(const out of current) for(const incoming of market){
  if(out.type!==incoming.type||owned.has(incoming.code)||incoming.price>out.price+cash+1e-8)continue;
  const projectedPointsGain=incoming.expectedPoints-out.expectedPoints;
  const projectedValueGain=incoming.expectedDelta-out.expectedDelta;
  const netPointsGain=projectedPointsGain-penalty;
  results.push({out:out.code,incoming:incoming.code,projectedPointsGain,projectedValueGain,penalty,netPointsGain,score:scoreProposal(netPointsGain,projectedValueGain,mode,customPointsWeight)});
 }
 return results.sort((a,b)=>b.score-a.score);
}
