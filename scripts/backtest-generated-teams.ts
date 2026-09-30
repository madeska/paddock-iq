import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6;
const END_ROUND=15;
const BUDGETS=[120,125,130,135];
const MODES=[
 {name:'points',weight:1},
 {name:'balanced',weight:.7},
 {name:'budget',weight:.3},
] as const;

type Row={
 PositionName?:string;
 DriverTLA?:string;
 PlayerId?:string|number;
 GamedayPoints?:string|number|null;
 Value?:string|number|null;
};
type Hist={round:number;points:number;price:number};
type Asset={
 code:string;
 type:'DRIVER'|'CONSTRUCTOR';
 price:number;
 expectedPoints:number;
 expectedDelta:number;
 actualPoints:number;
 actualDelta:number;
};
type Team={
 drivers:Asset[];
 constructors:Asset[];
 boost:Asset;
 price:number;
 predictedPoints:number;
 predictedDelta:number;
 actualPoints:number;
 actualDelta:number;
 actualBestBoostPoints:number;
};

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
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
const utility=(points:number,delta:number,weight:number)=>weight*(points/20)+(1-weight)*delta;

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ generated team backtest'}});
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
const features=(h:number[],price:number)=>[ewma(h),mean(h),price];

function enumerateTeams(assets:Asset[],budget:number){
 const ds=assets.filter(a=>a.type==='DRIVER');
 const cs=assets.filter(a=>a.type==='CONSTRUCTOR');
 const teams:Team[]=[];
 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructors=[cs[a],cs[b]];
  const cp=constructors[0].price+constructors[1].price;
  if(cp>budget)continue;
  for(let i=0;i<ds.length-4;i++)
   for(let j=i+1;j<ds.length-3;j++)
    for(let k=j+1;k<ds.length-2;k++)
     for(let l=k+1;l<ds.length-1;l++)
      for(let m=l+1;m<ds.length;m++){
       const drivers=[ds[i],ds[j],ds[k],ds[l],ds[m]];
       const price=cp+drivers.reduce((s,x)=>s+x.price,0);
       if(price>budget+1e-9)continue;
       const boost=drivers.reduce((best,x)=>x.expectedPoints>best.expectedPoints?x:best);
       const all=[...constructors,...drivers];
       const predictedPoints=all.reduce((s,x)=>s+x.expectedPoints,0)+boost.expectedPoints;
       const predictedDelta=all.reduce((s,x)=>s+x.expectedDelta,0);
       const actualPoints=all.reduce((s,x)=>s+x.actualPoints,0)+boost.actualPoints;
       const actualDelta=all.reduce((s,x)=>s+x.actualDelta,0);
       const actualBestBoostPoints=Math.max(...drivers.map(x=>x.actualPoints));
       teams.push({
        drivers,constructors,boost,price,predictedPoints,predictedDelta,actualPoints,actualDelta,actualBestBoostPoints
       });
      }
 }
 return teams;
}

type Obs={
 round:number;
 budget:number;
 mode:string;
 top1Actual:number;
 top3BestActual:number;
 top5BestActual:number;
 oracleActual:number;
 top1Regret:number;
 top3Regret:number;
 top5Regret:number;
 boostHit:boolean;
 boostRegret:number;
 rankOfOracle:number;
};

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=END_ROUND;r++)feeds.set(r,await fetchRound(r));

 const history=new Map<string,Hist[]>();
 const types=new Map<string,'DRIVER'|'CONSTRUCTOR'>();

 for(let round=1;round<=END_ROUND;round++){
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

 const observations:Obs[]=[];

 for(let round=START_ROUND;round<=END_ROUND;round++){
  const train:{x:number[];y:number}[]=[];
  for(const [code,h] of history){
   if(types.get(code)!=='DRIVER')continue;
   for(const target of h){
    if(target.round>=round||target.round<3)continue;
    const prior=h.filter(x=>x.round<target.round).sort((a,b)=>a.round-b.round);
    if(prior.length<2)continue;
    const before=prior[prior.length-1];
    train.push({x:features(prior.map(x=>x.points),before.price),y:target.points});
   }
  }
  const driverModel=fitRidge(train,50);
  if(!driverModel)continue;

  const assets:Asset[]=[];
  for(const [code,h] of history){
   const type=types.get(code)!;
   const prior=h.filter(x=>x.round<round).sort((a,b)=>a.round-b.round);
   const actual=h.find(x=>x.round===round);
   if(prior.length<2||!actual)continue;
   const before=prior[prior.length-1];
   const histPoints=prior.map(x=>x.points);
   const expectedPoints=type==='DRIVER'
    ?driverModel.predict(features(histPoints,before.price))
    :Math.max(-5,ewma(histPoints));

   const newest=[...histPoints].reverse();
   const priceModel=newest.length>=2?predictFantasyPrice({
    currentPrice:before.price,
    previousFantasyPoints:[newest[1],newest[0]],
    expectedPoints,
    pointsStdDev:std(newest.slice(0,5))
   }):null;

   assets.push({
    code,type,price:before.price,
    expectedPoints,
    expectedDelta:priceModel?.expectedDelta??0,
    actualPoints:actual.points,
    actualDelta:actual.price-before.price
   });
  }

  for(const budget of BUDGETS){
   const teams=enumerateTeams(assets,budget);
   if(!teams.length)continue;
   for(const mode of MODES){
    const predicted=[...teams].sort((a,b)=>utility(b.predictedPoints,b.predictedDelta,mode.weight)-utility(a.predictedPoints,a.predictedDelta,mode.weight));
    const actual=[...teams].sort((a,b)=>utility(b.actualPoints,b.actualDelta,mode.weight)-utility(a.actualPoints,a.actualDelta,mode.weight));
    const top1=predicted[0];
    const top3=predicted.slice(0,3);
    const top5=predicted.slice(0,5);
    const oracle=actual[0];
    const actualScore=(t:Team)=>utility(t.actualPoints,t.actualDelta,mode.weight);
    const oracleScore=actualScore(oracle);
    const top1Score=actualScore(top1);
    const top3Best=Math.max(...top3.map(actualScore));
    const top5Best=Math.max(...top5.map(actualScore));
    const boostActualBest=top1.drivers.reduce((best,x)=>x.actualPoints>best.actualPoints?x:best);
    const oracleKey=[...oracle.constructors,...oracle.drivers].map(x=>x.code).sort().join('|');
    const rankOfOracle=predicted.findIndex(t=>[...t.constructors,...t.drivers].map(x=>x.code).sort().join('|')===oracleKey)+1;
    observations.push({
     round,budget,mode:mode.name,
     top1Actual:top1Score,
     top3BestActual:top3Best,
     top5BestActual:top5Best,
     oracleActual:oracleScore,
     top1Regret:oracleScore-top1Score,
     top3Regret:oracleScore-top3Best,
     top5Regret:oracleScore-top5Best,
     boostHit:top1.boost.code===boostActualBest.code,
     boostRegret:boostActualBest.actualPoints-top1.boost.actualPoints,
     rankOfOracle
    });
   }
  }
 }

 const summarize=(mode:string)=>{
  const rows=observations.filter(x=>x.mode===mode);
  return {
   mode,
   n:rows.length,
   avgTop1Regret:+mean(rows.map(x=>x.top1Regret)).toFixed(3),
   medianTop1Regret:+median(rows.map(x=>x.top1Regret)).toFixed(3),
   avgTop3Regret:+mean(rows.map(x=>x.top3Regret)).toFixed(3),
   avgTop5Regret:+mean(rows.map(x=>x.top5Regret)).toFixed(3),
   top1Within5Pct:+(100*rows.filter(x=>x.top1Regret<=.25).length/rows.length).toFixed(1),
   oracleInTop5Pct:+(100*rows.filter(x=>x.rankOfOracle>0&&x.rankOfOracle<=5).length/rows.length).toFixed(1),
   boostHitRate:+(100*rows.filter(x=>x.boostHit).length/rows.length).toFixed(1),
   avgBoostRegret:+mean(rows.map(x=>x.boostRegret)).toFixed(2),
   medianBoostRegret:+median(rows.map(x=>x.boostRegret)).toFixed(2),
  };
 };

 console.log('\nGENERATED TEAM QUALITY — SUMMARY');
 console.table(MODES.map(m=>summarize(m.name)));

 console.log('\nBY BUDGET');
 const budgetRows=[];
 for(const mode of MODES)for(const budget of BUDGETS){
  const rows=observations.filter(x=>x.mode===mode.name&&x.budget===budget);
  budgetRows.push({
   mode:mode.name,budget,n:rows.length,
   avgTop1Regret:+mean(rows.map(x=>x.top1Regret)).toFixed(3),
   avgTop5Regret:+mean(rows.map(x=>x.top5Regret)).toFixed(3),
   boostHitRate:+(100*rows.filter(x=>x.boostHit).length/rows.length).toFixed(1),
   avgBoostRegret:+mean(rows.map(x=>x.boostRegret)).toFixed(2)
  });
 }
 console.table(budgetRows);

 console.log('\nPOINTS MODE — RAW FANTASY POINTS');
 const pointRows=observations.filter(x=>x.mode==='points');
 console.table([{
  n:pointRows.length,
  avgTop1Points:+mean(pointRows.map(x=>x.top1Actual*20)).toFixed(1),
  avgTop3BestPoints:+mean(pointRows.map(x=>x.top3BestActual*20)).toFixed(1),
  avgTop5BestPoints:+mean(pointRows.map(x=>x.top5BestActual*20)).toFixed(1),
  avgOraclePoints:+mean(pointRows.map(x=>x.oracleActual*20)).toFixed(1),
  avgTop1PointRegret:+mean(pointRows.map(x=>x.top1Regret*20)).toFixed(1),
  avgTop5PointRegret:+mean(pointRows.map(x=>x.top5Regret*20)).toFixed(1),
  boostHitRate:+(100*pointRows.filter(x=>x.boostHit).length/pointRows.length).toFixed(1),
  avgBoostPointRegret:+mean(pointRows.map(x=>x.boostRegret)).toFixed(2)
 }]);

 console.log('\nWORST TOP-1 MISSES');
 console.table([...observations].sort((a,b)=>b.top1Regret-a.top1Regret).slice(0,12).map(x=>({
  round:x.round,budget:x.budget,mode:x.mode,
  regret:+x.top1Regret.toFixed(2),
  boostHit:x.boostHit,
  boostRegret:+x.boostRegret.toFixed(1),
  oracleRank:x.rankOfOracle
 })));
}

main().catch(e=>{console.error(e);process.exitCode=1});
