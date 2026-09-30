import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6, END_ROUND=15;
const BUDGETS=[120,125,130,135];
const LAMBDAS=[0,.1,.2,.3,.4,.5,.75,1];

type Row={PositionName?:string;DriverTLA?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};
type Hist={round:number;points:number;price:number};
type Asset={code:string;type:'DRIVER'|'CONSTRUCTOR';price:number;expectedPoints:number;expectedDelta:number;uncertainty:number;actualPoints:number;actualDelta:number};
type Team={drivers:Asset[];constructors:Asset[];boost:Asset;price:number;predictedPoints:number;predictedDelta:number;teamSigma:number;actualPoints:number;actualDelta:number};

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const median=(xs:number[])=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ risk adjusted team backtest'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i]; if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k]}
 }
 return M.map(r=>r[n]);
}
function fitRidge(rows:{x:number[];y:number}[],lambda=50){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);const s=std(vals);sds[j]=s>1e-8?s:1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b); if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}
const features=(h:number[],price:number)=>[ewma(h),mean(h),price];

function enumerateTeams(assets:Asset[],budget:number){
 const ds=assets.filter(a=>a.type==='DRIVER'),cs=assets.filter(a=>a.type==='CONSTRUCTOR'),teams:Team[]=[];
 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructors=[cs[a],cs[b]],cp=constructors[0].price+constructors[1].price;if(cp>budget)continue;
  for(let i=0;i<ds.length-4;i++)for(let j=i+1;j<ds.length-3;j++)for(let k=j+1;k<ds.length-2;k++)for(let l=k+1;l<ds.length-1;l++)for(let m=l+1;m<ds.length;m++){
   const drivers=[ds[i],ds[j],ds[k],ds[l],ds[m]],price=cp+drivers.reduce((s,x)=>s+x.price,0);if(price>budget+1e-9)continue;
   const boost=drivers.reduce((best,x)=>x.expectedPoints>best.expectedPoints?x:best);
   const all=[...constructors,...drivers];
   const predictedPoints=all.reduce((s,x)=>s+x.expectedPoints,0)+boost.expectedPoints;
   const predictedDelta=all.reduce((s,x)=>s+x.expectedDelta,0);
   const teamSigma=Math.sqrt(all.reduce((s,x)=>s+x.uncertainty*x.uncertainty,0)+boost.uncertainty*boost.uncertainty);
   const actualPoints=all.reduce((s,x)=>s+x.actualPoints,0)+boost.actualPoints;
   const actualDelta=all.reduce((s,x)=>s+x.actualDelta,0);
   teams.push({drivers,constructors,boost,price,predictedPoints,predictedDelta,teamSigma,actualPoints,actualDelta});
  }
 }
 return teams;
}

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=END_ROUND;r++)feeds.set(r,await fetchRound(r));

 const history=new Map<string,Hist[]>(),types=new Map<string,'DRIVER'|'CONSTRUCTOR'>();
 for(let round=1;round<=END_ROUND;round++)for(const row of feeds.get(round)!){
  let code:string|null=null,type:'DRIVER'|'CONSTRUCTOR'|null=null;
  if(row.PositionName==='DRIVER'){code='D:'+String(row.DriverTLA??'').toUpperCase();type='DRIVER'}
  else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){code='C:'+String(row.PlayerId);type='CONSTRUCTOR'}
  if(!code||!type)continue;
  const points=Number(row.GamedayPoints),price=Number(row.Value);if(!Number.isFinite(points)||!Number.isFinite(price))continue;
  const h=history.get(code)??[];h.push({round,points,price});history.set(code,h);types.set(code,type);
 }

 const rows:{lambda:number;actualPoints:number;regret:number;boostHit:boolean;boostRegret:number;round:number;budget:number}[]=[];
 for(let round=START_ROUND;round<=END_ROUND;round++){
  const train:{x:number[];y:number}[]=[];
  for(const [code,h] of history){if(types.get(code)!=='DRIVER')continue;for(const target of h){
   if(target.round>=round||target.round<3)continue;
   const prior=h.filter(x=>x.round<target.round).sort((a,b)=>a.round-b.round);if(prior.length<2)continue;
   train.push({x:features(prior.map(x=>x.points),prior[prior.length-1].price),y:target.points});
  }}
  const model=fitRidge(train,50);if(!model)continue;

  const assets:Asset[]=[];
  for(const [code,h] of history){
   const type=types.get(code)!;
   const prior=h.filter(x=>x.round<round).sort((a,b)=>a.round-b.round),actual=h.find(x=>x.round===round);
   if(prior.length<2||!actual)continue;
   const before=prior[prior.length-1],histPoints=prior.map(x=>x.points),recent=histPoints.slice(-5);
   const expectedPoints=type==='DRIVER'?model.predict(features(histPoints,before.price)):Math.max(-5,ewma(histPoints));
   const newest=[...histPoints].reverse();
   const priceModel=newest.length>=2?predictFantasyPrice({currentPrice:before.price,previousFantasyPoints:[newest[1],newest[0]],expectedPoints,pointsStdDev:std(recent)}):null;
   const uncertainty=Math.max(type==='DRIVER'?6:10,std(recent));
   assets.push({code,type,price:before.price,expectedPoints,expectedDelta:priceModel?.expectedDelta??0,uncertainty,actualPoints:actual.points,actualDelta:actual.price-before.price});
  }

  for(const budget of BUDGETS){
   const teams=enumerateTeams(assets,budget);if(!teams.length)continue;
   const oracle=[...teams].sort((a,b)=>b.actualPoints-a.actualPoints)[0];
   for(const lambda of LAMBDAS){
    const ranked=[...teams].sort((a,b)=>(b.predictedPoints-lambda*b.teamSigma)-(a.predictedPoints-lambda*a.teamSigma));
    const top=ranked[0];
    const actualBestBoost=top.drivers.reduce((best,x)=>x.actualPoints>best.actualPoints?x:best);
    rows.push({
     lambda,actualPoints:top.actualPoints,regret:oracle.actualPoints-top.actualPoints,
     boostHit:top.boost.code===actualBestBoost.code,boostRegret:actualBestBoost.actualPoints-top.boost.actualPoints,
     round,budget
    });
   }
  }
 }

 const summary=LAMBDAS.map(lambda=>{
  const r=rows.filter(x=>x.lambda===lambda);
  return {
   lambda,n:r.length,
   avgActualPoints:+mean(r.map(x=>x.actualPoints)).toFixed(1),
   avgRegret:+mean(r.map(x=>x.regret)).toFixed(1),
   medianRegret:+median(r.map(x=>x.regret)).toFixed(1),
   boostHitRate:+(100*r.filter(x=>x.boostHit).length/r.length).toFixed(1),
   avgBoostRegret:+mean(r.map(x=>x.boostRegret)).toFixed(2)
  };
 });
 console.log('\nRISK-ADJUSTED TEAM RANKING — POINTS MODE');
 console.table(summary);
 const best=[...summary].sort((a,b)=>a.avgRegret-b.avgRegret)[0];
 console.log('\nBEST LAMBDA',best);

 console.log('\nBEST LAMBDA BY BUDGET');
 console.table(BUDGETS.map(budget=>{
  const candidates=LAMBDAS.map(lambda=>{
   const r=rows.filter(x=>x.lambda===lambda&&x.budget===budget);
   return {lambda,avgRegret:mean(r.map(x=>x.regret)),avgPoints:mean(r.map(x=>x.actualPoints))};
  }).sort((a,b)=>a.avgRegret-b.avgRegret);
  return {budget,lambda:candidates[0].lambda,avgRegret:+candidates[0].avgRegret.toFixed(1),avgPoints:+candidates[0].avgPoints.toFixed(1)};
 }));
}
main().catch(e=>{console.error(e);process.exitCode=1});
