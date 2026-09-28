import {type Asset,type Mode,scoreProposal} from './optimizer';
import {transferAccounting} from './transfer-rules';
export type Scenario={out:string[];incoming:string[];transfers:number;penalty:number;netPointsGain:number;projectedValueGain:number;cashRemaining:number;projectedNextFreeTransfers:number;score:number};
export function optimizeTransfers(current:Asset[],market:Asset[],cash:number,freeTransfers:number,mode:Mode,weight=.6,penaltyPerExtra=10,maxChanges=3,locked:string[]=[]):Scenario[]{
 if(current.length!==7||current.filter(a=>a.type==='DRIVER').length!==5||current.filter(a=>a.type==='CONSTRUCTOR').length!==2)throw Error('Expected 5 drivers and 2 constructors');
 const valid=(a:Asset)=>typeof a.code==='string'&&a.code.length>0&&['DRIVER','CONSTRUCTOR'].includes(a.type)&&a.price>0&&[a.price,a.expectedPoints,a.expectedDelta].every(Number.isFinite);
 if(!current.every(valid)||!market.every(valid)||!Number.isFinite(cash)||cash<0||!Number.isInteger(freeTransfers)||freeTransfers<0)throw Error('Invalid inputs');
 if(!['points','balanced','budget','custom'].includes(mode)||!Number.isFinite(weight)||weight<0||weight>1||!Number.isFinite(penaltyPerExtra)||penaltyPerExtra<0||!Number.isInteger(maxChanges)||maxChanges<0||maxChanges>7||!Array.isArray(locked))throw Error('Invalid optimization settings');
 const all=[...current,...market];if(new Set(all.map(a=>a.code)).size!==all.length)throw Error('Duplicate asset code');
 const owned=new Set(current.map(a=>a.code));const candidates=market.filter(a=>!owned.has(a.code));
 const results:Scenario[]=[];
 function visit(start:number,outs:Asset[],ins:Asset[],spent:number,pts:number,delta:number){
  const count=outs.length;const accounting=transferAccounting(freeTransfers,count,penaltyPerExtra);const penalty=accounting.penalty;
  if(spent<=cash+1e-8){const remaining=Math.max(0,cash-spent);results.push({out:outs.map(a=>a.code),incoming:ins.map(a=>a.code),transfers:count,penalty,netPointsGain:pts-penalty,projectedValueGain:delta,cashRemaining:remaining,projectedNextFreeTransfers:accounting.projectedNext,score:scoreProposal(pts-penalty,delta,mode,weight)});}
  if(count>=Math.min(3,maxChanges))return;
  for(let i=start;i<current.length;i++){
   const out=current[i];if(locked.includes(out.code))continue;
   for(const incoming of candidates){
    if(incoming.type!==out.type||ins.some(a=>a.code===incoming.code))continue;
    const nextSpent=spent+incoming.price-out.price;
    // Transfers are simultaneous: a temporary intermediate deficit is permitted.
    // The final lineup is checked before it is emitted.
    visit(i+1,[...outs,out],[...ins,incoming],nextSpent,pts+incoming.expectedPoints-out.expectedPoints,delta+incoming.expectedDelta-out.expectedDelta);
   }
  }
 }
 visit(0,[],[],0,0,0);
 const unique=new Map<string,Scenario>();
 for(const r of results){
  const key=r.out.slice().sort().join('|')+'>'+r.incoming.slice().sort().join('|');
  const prev=unique.get(key);if(!prev||r.score>prev.score)unique.set(key,r);
 }
 return [...unique.values()].sort((a,b)=>b.score-a.score).slice(0,50);
}
