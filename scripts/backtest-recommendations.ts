import {optimizeThreeGpHold,type HorizonAsset,type HorizonScenario} from '../src/lib/horizon-optimizer';
import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const BUDGET=130;
const FREE_TRANSFERS=2;
const PENALTY_PER_EXTRA=10;
const LINEUPS_PER_START=12;
const START_ROUND=6;
const END_ROUND=13;
const SPRINT_ROUNDS_2026=new Set([2,4,5,9,12,17]);
const SPRINT_CORRECTION={DRIVER:2.58,CONSTRUCTOR:3.70} as const;

type Row={
 PositionName?:string;DriverTLA?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null;
};
type Hist={round:number;points:number;price:number};
type AssetProjection={
 code:string;
 type:'DRIVER'|'CONSTRUCTOR';
 price:number;
 expectedDelta:number;
 horizonPoints:number[];
 actualPoints:number[];
};
type Sample={
 startRound:number;
 containsSprint:boolean;
 scenario:HorizonScenario;
 realizedGain:number;
};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const median=(xs:number[])=>{
 if(!xs.length)return 0;
 const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);
 return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const std=(xs:number[])=>{
 if(xs.length<2)return 0;
 const m=mean(xs);
 return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
};
const ewma=(h:number[],a=.25)=>{
 if(!h.length)return 0;
 let v=h[0];
 for(const x of h.slice(1))v=a*x+(1-a)*v;
 return v;
};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ recommendation backtest'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;
  for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i];
  if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){
   if(j===i)continue;
   const f=M[j][i];
   for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k];
  }
 }
 return M.map(r=>r[n]);
}

function fitRidge(rows:{x:number[];y:number}[],lambda=50){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){
  const vals=rows.map(r=>r.x[j]);
  means[j]=mean(vals);
  const s=std(vals);
  sds[j]=s>1e-8?s:1;
 }
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){
  b[a]+=X[i][a]*rows[i].y;
  for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c];
 }
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b);
 if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}

const driverFeatures=(h:number[],price:number)=>[ewma(h),mean(h),price];

function seeded(seed:number){
 let x=seed>>>0;
 return ()=>{
  x=(1664525*x+1013904223)>>>0;
  return x/4294967296;
 };
}

function shuffle<T>(xs:T[],rand:()=>number){
 const a=[...xs];
 for(let i=a.length-1;i>0;i--){
  const j=Math.floor(rand()*(i+1));
  [a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}

function makeLineups(assets:AssetProjection[],seed:number,count:number){
 const drivers=assets.filter(a=>a.type==='DRIVER');
 const constructors=assets.filter(a=>a.type==='CONSTRUCTOR');
 const rand=seeded(seed);
 const out:AssetProjection[][]=[];
 const seen=new Set<string>();
 let attempts=0;

 while(out.length<count&&attempts<count*300){
  attempts++;
  const ds=shuffle(drivers,rand).slice(0,5);
  const cs=shuffle(constructors,rand).slice(0,2);
  if(ds.length!==5||cs.length!==2)continue;
  const lineup=[...ds,...cs];
  const cost=lineup.reduce((s,a)=>s+a.price,0);
  if(cost>BUDGET+1e-9)continue;
  const key=lineup.map(a=>a.code).sort().join('|');
  if(seen.has(key))continue;
  seen.add(key);
  out.push(lineup);
 }

 return out;
}

function applyScenario(lineup:AssetProjection[],scenario:HorizonScenario,byCode:Map<string,AssetProjection>){
 const outgoing=new Set(scenario.out);
 const incoming=scenario.incoming.map(code=>byCode.get(code)).filter((x):x is AssetProjection=>Boolean(x));
 const kept=lineup.filter(a=>!outgoing.has(a.code));
 return [...kept,...incoming];
}

function bestBoostCode(lineup:AssetProjection[],step:number){
 const drivers=lineup.filter(a=>a.type==='DRIVER');
 if(!drivers.length)return null;
 return drivers.reduce((best,a)=>(a.horizonPoints[step]??-Infinity)>(best.horizonPoints[step]??-Infinity)?a:best).code;
}

function actualLineupTotal(lineup:AssetProjection[]){
 let total=0;
 for(let step=0;step<3;step++){
  total+=lineup.reduce((s,a)=>s+(a.actualPoints[step]??0),0);
  const boost=bestBoostCode(lineup,step);
  if(boost)total+=lineup.find(a=>a.code===boost)?.actualPoints[step]??0;
 }
 return total;
}

function summary(name:string,samples:Sample[]){
 const recommended=samples.filter(s=>s.scenario.transfers>0);
 const realized=recommended.map(s=>s.realizedGain);
 const wins=realized.filter(x=>x>0).length;
 const negatives=realized.filter(x=>x<0).length;
 return {
  group:name,
  samples:samples.length,
  recommendations:recommended.length,
  recommendationRate:samples.length?+(100*recommended.length/samples.length).toFixed(1):0,
  hitRate:recommended.length?+(100*wins/recommended.length).toFixed(1):0,
  avgPredictedGain:recommended.length?+mean(recommended.map(s=>s.scenario.netPointsGain)).toFixed(2):0,
  avgRealizedGain:realized.length?+mean(realized).toFixed(2):0,
  medianRealizedGain:realized.length?+median(realized).toFixed(2):0,
  negativeRate:recommended.length?+(100*negatives/recommended.length).toFixed(1):0
 };
}

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const history=new Map<string,Hist[]>();
 const types=new Map<string,'DRIVER'|'CONSTRUCTOR'>();

 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!){
   let code:string|null=null,type:'DRIVER'|'CONSTRUCTOR'|null=null;
   if(row.PositionName==='DRIVER'){
    code='D:'+String(row.DriverTLA??'').toUpperCase();
    type='DRIVER';
   }else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){
    code='C:'+String(row.PlayerId);
    type='CONSTRUCTOR';
   }
   if(!code||!type)continue;
   const points=Number(row.GamedayPoints),price=Number(row.Value);
   if(!Number.isFinite(points)||!Number.isFinite(price))continue;
   const h=history.get(code)??[];
   h.push({round,points,price});
   history.set(code,h);
   types.set(code,type);
  }
 }

 const samples:Sample[]=[];

 for(let start=START_ROUND;start<=END_ROUND;start++){
  const train:{x:number[];y:number}[]=[];
  for(const [code,h] of history){
   if(types.get(code)!=='DRIVER')continue;
   for(let target=6;target<start;target++){
    const prior=h.filter(x=>x.round<target).sort((a,b)=>a.round-b.round);
    const targetRow=h.find(x=>x.round===target);
    if(prior.length<2||!targetRow)continue;
    train.push({x:driverFeatures(prior.map(x=>x.points),targetRow.price),y:targetRow.points});
   }
  }
  const driverModel=fitRidge(train,50);
  if(!driverModel)continue;

  const assets:AssetProjection[]=[];
  for(const [code,h] of history){
   const type=types.get(code)!;
   const prior=h.filter(x=>x.round<start).sort((a,b)=>a.round-b.round);
   const current=h.find(x=>x.round===start);
   const actualRows=[0,1,2].map(step=>h.find(x=>x.round===start+step));
   if(prior.length<2||!current||actualRows.some(x=>!x))continue;

   const projectedHistory=prior.map(x=>x.points);
   let projectedPrice=current.price;
   const horizonPoints:number[]=[];

   for(let step=0;step<3;step++){
    const round=start+step;
    const raw=type==='DRIVER'
      ?driverModel.predict(driverFeatures(projectedHistory,projectedPrice))
      :Math.max(-5,ewma(projectedHistory));
    const expectedPoints=raw+(SPRINT_ROUNDS_2026.has(round)?SPRINT_CORRECTION[type]:0);
    horizonPoints.push(expectedPoints);

    const newest=[...projectedHistory].reverse();
    const priceModel=newest.length>=2?predictFantasyPrice({
     currentPrice:projectedPrice,
     previousFantasyPoints:[newest[1],newest[0]],
     expectedPoints,
     pointsStdDev:std(newest.slice(0,5))
    }):null;
    projectedPrice=Math.max(3,projectedPrice+(priceModel?.expectedDelta??0));
    projectedHistory.push(expectedPoints);
   }

   assets.push({
    code,type,price:current.price,
    expectedDelta:projectedPrice-current.price,
    horizonPoints,
    actualPoints:actualRows.map(x=>x!.points)
   });
  }

  const lineups=makeLineups(assets,202600+start,LINEUPS_PER_START);
  const byCode=new Map(assets.map(a=>[a.code,a]));
  for(const lineup of lineups){
   const cost=lineup.reduce((s,a)=>s+a.price,0);
   const current:HorizonAsset[]=lineup.map(a=>({
    code:a.code,type:a.type,price:a.price,expectedDelta:a.expectedDelta,
    horizonPoints:a.horizonPoints,
    isDoubled:a.type==='DRIVER'&&a.code===bestBoostCode(lineup,0)
   }));
   const market:HorizonAsset[]=assets.map(a=>({
    code:a.code,type:a.type,price:a.price,expectedDelta:a.expectedDelta,horizonPoints:a.horizonPoints
   }));
   const scenarios=optimizeThreeGpHold(current,market,BUDGET-cost,FREE_TRANSFERS,PENALTY_PER_EXTRA,3,[]);
   const scenario=scenarios[0];
   if(!scenario)continue;

   const changed=applyScenario(lineup,scenario,byCode);
   const baselineActual=actualLineupTotal(lineup);
   const changedActual=actualLineupTotal(changed)-scenario.penalty;
   samples.push({
    startRound:start,
    containsSprint:[0,1,2].some(step=>SPRINT_ROUNDS_2026.has(start+step)),
    scenario,
    realizedGain:changedActual-baselineActual
   });
  }
 }

 console.log('\nRECOMMENDATION BACKTEST — 3 GP HOLD');
 console.log('Synthetic feasible lineups use a fixed $'+BUDGET+'M cap, '+FREE_TRANSFERS+' free transfers, and no hindsight in boost selection.');
 console.table([summary('ALL',samples)]);

 console.log('\nBY TRANSFER COUNT');
 console.table([0,1,2,3].map(n=>summary(String(n)+' transfers',samples.filter(s=>s.scenario.transfers===n))));

 console.log('\nBY START WEEKEND');
 console.table([
  summary('start = sprint',samples.filter(s=>SPRINT_ROUNDS_2026.has(s.startRound))),
  summary('start = normal',samples.filter(s=>!SPRINT_ROUNDS_2026.has(s.startRound))),
  summary('3GP window contains sprint',samples.filter(s=>s.containsSprint)),
  summary('3GP window no sprint',samples.filter(s=>!s.containsSprint))
 ]);

 const confidenceRows=['LOW','MEDIUM','HIGH'].map(label=>{
  const rows=samples.filter(s=>s.scenario.transfers>0&&s.scenario.transferConfidence===label);
  const hit=rows.filter(s=>s.realizedGain>0).length;
  const avgClaimed=rows.length?mean(rows.map(s=>s.scenario.empiricalHitRate??0))*100:0;
  return {
   confidence:label,
   n:rows.length,
   claimedHitRate:+avgClaimed.toFixed(1),
   observedHitRate:rows.length?+(100*hit/rows.length).toFixed(1):0,
   calibrationGap:rows.length?+(100*hit/rows.length-avgClaimed).toFixed(1):0,
   avgRealizedGain:rows.length?+mean(rows.map(s=>s.realizedGain)).toFixed(2):0
  };
 });

 console.log('\nCONFIDENCE CALIBRATION');
 console.table(confidenceRows);

 const byRound=[...new Set(samples.map(s=>s.startRound))].sort((a,b)=>a-b).map(round=>summary('R'+round,samples.filter(s=>s.startRound===round)));
 console.log('\nBY START ROUND');
 console.table(byRound);
}

main().catch(e=>{console.error(e);process.exitCode=1});
