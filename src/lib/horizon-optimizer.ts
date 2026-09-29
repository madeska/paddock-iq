import {transferAccounting} from './transfer-rules';

export type HorizonAsset={
 code:string;
 type:'DRIVER'|'CONSTRUCTOR';
 price:number;
 expectedDelta:number;
 horizonPoints:number[];
 isDoubled?:boolean;
};

export type HorizonScenario={
 out:string[];
 incoming:string[];
 transfers:number;
 penalty:number;
 transferPointsGain:number;
 boostGain:number;
 netPointsGain:number;
 projectedValueGain:number;
 perRoundGain:number[];
 cashRemaining:number;
 projectedNextFreeTransfers:number;
 currentBoost:string|null;
 recommendedBoost:string|null;
 score:number;
};

const rawTotal=(lineup:HorizonAsset[],steps:number)=>Array.from({length:steps},(_,i)=>lineup.reduce((s,a)=>s+(a.horizonPoints[i]??0),0));
const bestDriver=(lineup:HorizonAsset[],step:number)=>{
 const drivers=lineup.filter(a=>a.type==='DRIVER');
 if(!drivers.length)return null;
 return drivers.reduce((best,a)=>(a.horizonPoints[step]??-Infinity)>(best.horizonPoints[step]??-Infinity)?a:best);
};

export function optimizeThreeGpHold(
 current:HorizonAsset[],
 market:HorizonAsset[],
 cash:number,
 freeTransfers:number,
 penaltyPerExtra=10,
 maxChanges=3,
 locked:string[]=[]
):HorizonScenario[]{
 if(current.length!==7||current.filter(a=>a.type==='DRIVER').length!==5||current.filter(a=>a.type==='CONSTRUCTOR').length!==2)throw Error('Expected 5 drivers and 2 constructors');
 const steps=Math.min(3,...current.map(a=>a.horizonPoints.length),...market.map(a=>a.horizonPoints.length));
 if(steps<1)throw Error('Missing horizon points');

 const owned=new Set(current.map(a=>a.code));
 const candidates=market.filter(a=>!owned.has(a.code));
 const currentBoost=current.find(a=>a.type==='DRIVER'&&a.isDoubled)??bestDriver(current,0);
 const baselineRaw=rawTotal(current,steps).reduce((a,b)=>a+b,0);
 const baselineBoost=Array.from({length:steps},(_,i)=>{
  const b=i===0?currentBoost:bestDriver(current,i);
  return b?.horizonPoints[i]??0;
 }).reduce((a,b)=>a+b,0);

 const results:HorizonScenario[]=[];

 function emit(lineup:HorizonAsset[],outs:HorizonAsset[],ins:HorizonAsset[],spent:number,valueDelta:number){
  if(spent>cash+1e-8)return;
  const accounting=transferAccounting(freeTransfers,outs.length,penaltyPerExtra);
  const finalRawByRound=rawTotal(lineup,steps);
  const finalRaw=finalRawByRound.reduce((a,b)=>a+b,0);
  const boosts=Array.from({length:steps},(_,i)=>bestDriver(lineup,i));
  const finalBoostByRound=boosts.map((b,i)=>b?.horizonPoints[i]??0);
  const finalBoost=finalBoostByRound.reduce((a,b)=>a+b,0);
  const perRoundGain=Array.from({length:steps},(_,i)=>(finalRawByRound[i]+finalBoostByRound[i])-(baselineRawByRound[i]+baselineBoostByRound[i]));
  const transferPointsGain=finalRaw-baselineRaw;
  const boostGain=finalBoost-baselineBoost;
  const netPointsGain=transferPointsGain+boostGain-accounting.penalty;
  results.push({
   out:outs.map(a=>a.code),
   incoming:ins.map(a=>a.code),
   transfers:outs.length,
   penalty:accounting.penalty,
   transferPointsGain,
   boostGain,
   netPointsGain,
   projectedValueGain:valueDelta,
   perRoundGain,
   cashRemaining:Math.max(0,cash-spent),
   projectedNextFreeTransfers:accounting.projectedNext,
   currentBoost:currentBoost?.code??null,
   recommendedBoost:boosts[0]?.code??null,
   score:netPointsGain
  });
 }

 function visit(start:number,lineup:HorizonAsset[],outs:HorizonAsset[],ins:HorizonAsset[],spent:number,valueDelta:number){
  emit(lineup,outs,ins,spent,valueDelta);
  if(outs.length>=Math.min(3,maxChanges))return;
  for(let i=start;i<current.length;i++){
   const out=current[i];
   if(locked.includes(out.code))continue;
   const idx=lineup.findIndex(a=>a.code===out.code);
   if(idx<0)continue;
   for(const incoming of candidates){
    if(incoming.type!==out.type||ins.some(a=>a.code===incoming.code)||lineup.some(a=>a.code===incoming.code))continue;
    const next=[...lineup];next[idx]=incoming;
    visit(i+1,next,[...outs,out],[...ins,incoming],spent+incoming.price-out.price,valueDelta+incoming.expectedDelta-out.expectedDelta);
   }
  }
 }

 visit(0,[...current],[],[],0,0);

 const unique=new Map<string,HorizonScenario>();
 for(const r of results){
  const key=r.out.slice().sort().join('|')+'>'+r.incoming.slice().sort().join('|')+'@'+(r.recommendedBoost??'');
  const prev=unique.get(key);
  if(!prev||r.score>prev.score)unique.set(key,r);
 }
 return [...unique.values()]
  .sort((a,b)=>b.score-a.score||b.projectedNextFreeTransfers-a.projectedNextFreeTransfers||b.projectedValueGain-a.projectedValueGain)
  .slice(0,50);
}
