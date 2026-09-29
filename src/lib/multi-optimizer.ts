import {type Asset,type Mode,scoreProposal} from './optimizer';
import {transferAccounting} from './transfer-rules';

export type Scenario={
 out:string[];
 incoming:string[];
 transfers:number;
 penalty:number;
 projectedPointsGain:number;
 transferPointsGain:number;
 boostGain:number;
 netPointsGain:number;
 projectedValueGain:number;
 cashRemaining:number;
 projectedNextFreeTransfers:number;
 currentBoost:string|null;
 recommendedBoost:string|null;
 score:number;
};

const rawPoints=(lineup:Asset[])=>lineup.reduce((sum,a)=>sum+a.expectedPoints,0);
const currentBoostAsset=(lineup:Asset[])=>lineup.find(a=>a.type==='DRIVER'&&a.isDoubled)??null;
const bestBoostAsset=(lineup:Asset[])=>{
 const drivers=lineup.filter(a=>a.type==='DRIVER');
 if(!drivers.length)return null;
 return drivers.reduce((best,a)=>a.expectedPoints>best.expectedPoints?a:best);
};
const lineupPoints=(lineup:Asset[],boost:Asset|null)=>rawPoints(lineup)+(boost?.expectedPoints??0);

export function optimizeTransfers(current:Asset[],market:Asset[],cash:number,freeTransfers:number,mode:Mode,weight=.6,penaltyPerExtra=10,maxChanges=3,locked:string[]=[]):Scenario[]{
 if(current.length!==7||current.filter(a=>a.type==='DRIVER').length!==5||current.filter(a=>a.type==='CONSTRUCTOR').length!==2)throw Error('Expected 5 drivers and 2 constructors');
 const valid=(a:Asset)=>typeof a.code==='string'&&a.code.length>0&&['DRIVER','CONSTRUCTOR'].includes(a.type)&&a.price>0&&[a.price,a.expectedPoints,a.expectedDelta].every(Number.isFinite);
 if(!current.every(valid)||!market.every(valid)||!Number.isFinite(cash)||cash<0||!Number.isInteger(freeTransfers)||freeTransfers<0)throw Error('Invalid inputs');
 if(!['points','balanced','budget','custom'].includes(mode)||!Number.isFinite(weight)||weight<0||weight>1||!Number.isFinite(penaltyPerExtra)||penaltyPerExtra<0||!Number.isInteger(maxChanges)||maxChanges<0||maxChanges>7||!Array.isArray(locked))throw Error('Invalid optimization settings');
 const all=[...current,...market];if(new Set(all.map(a=>a.code)).size!==all.length)throw Error('Duplicate asset code');

 const owned=new Set(current.map(a=>a.code));
 const candidates=market.filter(a=>!owned.has(a.code));
 const results:Scenario[]=[];

 const selectedBoost=currentBoostAsset(current)??bestBoostAsset(current);
 const baselinePoints=lineupPoints(current,selectedBoost);

 function emit(lineup:Asset[],outs:Asset[],ins:Asset[],spent:number,delta:number){
  const count=outs.length;
  const accounting=transferAccounting(freeTransfers,count,penaltyPerExtra);
  const penalty=accounting.penalty;
  if(spent>cash+1e-8)return;

  const recommendedBoost=bestBoostAsset(lineup);
  const finalPoints=lineupPoints(lineup,recommendedBoost);
  const boostGain=(recommendedBoost?.expectedPoints??0)-(selectedBoost?.expectedPoints??0);
  const transferPointsGain=(rawPoints(lineup)-rawPoints(current));
  const projectedPointsGain=transferPointsGain+boostGain;
  const remaining=Math.max(0,cash-spent);
  const netPointsGain=projectedPointsGain-penalty;

  results.push({
   out:outs.map(a=>a.code),
   incoming:ins.map(a=>a.code),
   transfers:count,
   penalty,
   projectedPointsGain,
   transferPointsGain,
   boostGain,
   netPointsGain,
   projectedValueGain:delta,
   cashRemaining:remaining,
   projectedNextFreeTransfers:accounting.projectedNext,
   currentBoost:selectedBoost?.code??null,
   recommendedBoost:recommendedBoost?.code??null,
   score:scoreProposal(netPointsGain,delta,mode,weight)
  });
 }

 function visit(start:number,lineup:Asset[],outs:Asset[],ins:Asset[],spent:number,delta:number){
  emit(lineup,outs,ins,spent,delta);
  const count=outs.length;
  if(count>=Math.min(3,maxChanges))return;

  for(let i=start;i<current.length;i++){
   const out=current[i];
   if(locked.includes(out.code))continue;
   const lineupIndex=lineup.findIndex(a=>a.code===out.code);
   if(lineupIndex<0)continue;

   for(const incoming of candidates){
    if(incoming.type!==out.type||ins.some(a=>a.code===incoming.code)||lineup.some(a=>a.code===incoming.code))continue;
    const nextSpent=spent+incoming.price-out.price;
    const next=[...lineup];
    next[lineupIndex]=incoming;
    visit(i+1,next,[...outs,out],[...ins,incoming],nextSpent,delta+incoming.expectedDelta-out.expectedDelta);
   }
  }
 }

 visit(0,[...current],[],[],0,0);

 const unique=new Map<string,Scenario>();
 for(const r of results){
  const key=r.out.slice().sort().join('|')+'>'+r.incoming.slice().sort().join('|')+'@'+(r.recommendedBoost??'');
  const prev=unique.get(key);
  if(!prev||r.score>prev.score)unique.set(key,r);
 }

 return [...unique.values()].sort((a,b)=>b.score-a.score).slice(0,50);
}
