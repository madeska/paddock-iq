import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6, END_ROUND=15;
const BUDGETS=[120,125,130,135];
const MODES=[
 {name:'points',weight:1},
 {name:'balanced',weight:.7},
 {name:'budget',weight:.3},
] as const;
const GAP_BINS=[.15,.35,.75,1.5,Infinity];

type Row={PositionName?:string;DriverTLA?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};
type Hist={round:number;points:number;price:number};
type Asset={
 code:string;type:'DRIVER'|'CONSTRUCTOR';price:number;
 ridge:number;ewma:number;mean3:number;expectedDelta:number;
 actualPoints:number;actualDelta:number;
};
type Team={
 drivers:Asset[];constructors:Asset[];boost:Asset;price:number;
 predictedPoints:number;predictedDelta:number;actualPoints:number;actualDelta:number;
};
type Obs={
 mode:string;round:number;budget:number;predictedGap:number;
 actualGap:number;hit:boolean;
};

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};
const mean3=(h:number[])=>mean(h.slice(-3));
const utility=(points:number,delta:number,weight:number)=>weight*(points/20)+(1-weight)*delta;
const driverTeamPred=(a:Asset)=>.5*a.ridge+.5*a.ewma;
const constructorPred=(a:Asset)=>.5*a.ewma+.5*a.mean3;
const boostPred=(a:Asset)=>a.ridge;

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ team confidence calibration'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}
function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];const d=M[i][i];if(Math.abs(d)<1e-10)return null;
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
 const beta=solve(A,b);if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}
const features=(h:number[],price:number)=>[ewma(h),mean(h),price];

function enumerateTeams(assets:Asset[],budget:number){
 const ds=assets.filter(a=>a.type==='DRIVER'),cs=assets.filter(a=>a.type==='CONSTRUCTOR'),teams:Team[]=[];
 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructors=[cs[a],cs[b]],cp=constructors.reduce((s,x)=>s+x.price,0);if(cp>budget)continue;
  for(let i=0;i<ds.length-4;i++)for(let j=i+1;j<ds.length-3;j++)for(let k=j+1;k<ds.length-2;k++)for(let l=k+1;l<ds.length-1;l++)for(let m=l+1;m<ds.length;m++){
   const drivers=[ds[i],ds[j],ds[k],ds[l],ds[m]],price=cp+drivers.reduce((s,x)=>s+x.price,0);if(price>budget+1e-9)continue;
   const boost=drivers.reduce((best,x)=>boostPred(x)>boostPred(best)?x:best);
   const predictedPoints=constructors.reduce((s,x)=>s+constructorPred(x),0)+drivers.reduce((s,x)=>s+driverTeamPred(x),0)+boostPred(boost);
   const predictedDelta=[...constructors,...drivers].reduce((s,x)=>s+x.expectedDelta,0);
   const actualPoints=[...constructors,...drivers].reduce((s,x)=>s+x.actualPoints,0)+boost.actualPoints;
   const actualDelta=[...constructors,...drivers].reduce((s,x)=>s+x.actualDelta,0);
   teams.push({drivers,constructors,boost,price,predictedPoints,predictedDelta,actualPoints,actualDelta});
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

 const observations:Obs[]=[];
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
   const before=prior[prior.length-1],hist=prior.map(x=>x.points),e=ewma(hist),m3=mean3(hist);
   const ridge=type==='DRIVER'?model.predict(features(hist,before.price)):e;
   const expectedForPrice=type==='DRIVER'?.5*ridge+.5*e:.5*e+.5*m3;
   const newest=[...hist].reverse();
   const pm=newest.length>=2?predictFantasyPrice({currentPrice:before.price,previousFantasyPoints:[newest[1],newest[0]],expectedPoints:expectedForPrice,pointsStdDev:std(hist.slice(-5))}):null;
   assets.push({code,type,price:before.price,ridge,ewma:e,mean3:m3,expectedDelta:pm?.expectedDelta??0,actualPoints:actual.points,actualDelta:actual.price-before.price});
  }

  for(const budget of BUDGETS){
   const teams=enumerateTeams(assets,budget);if(!teams.length)continue;
   for(const mode of MODES){
    const pred=[...teams].sort((a,b)=>utility(b.predictedPoints,b.predictedDelta,mode.weight)-utility(a.predictedPoints,a.predictedDelta,mode.weight));
    const top=pred.slice(0,25);
    for(let i=0;i<top.length-1;i++)for(let j=i+1;j<top.length;j++){
     const better=top[i],worse=top[j];
     const predictedGap=utility(better.predictedPoints,better.predictedDelta,mode.weight)-utility(worse.predictedPoints,worse.predictedDelta,mode.weight);
     const actualGap=utility(better.actualPoints,better.actualDelta,mode.weight)-utility(worse.actualPoints,worse.actualDelta,mode.weight);
     observations.push({
      mode:mode.name,round,budget,
      predictedGap:Math.max(0,predictedGap),
      actualGap,
      hit:actualGap>0
     });
    }
   }
  }
 }

 console.log('\nTEAM BUILDER CONFIDENCE CALIBRATION');
 console.log('Hit = the higher-ranked predicted lineup actually beat the lower-ranked lineup.');
 console.log('Confidence is pairwise ordering accuracy, bucketed by predicted utility gap.');

 for(const mode of MODES){
  const rows=observations.filter(x=>x.mode===mode.name);
  console.log('\nMODE',mode.name,'n=',rows.length);
  let low=0;
  const out=[] as any[];
  for(const upper of GAP_BINS){
   const bucket=rows.filter(x=>x.predictedGap>=low&&x.predictedGap<upper);
   out.push({
    predictedGap:upper===Infinity?'>= '+low.toFixed(2):low.toFixed(2)+'–'+upper.toFixed(2),
    n:bucket.length,
    hitRate:bucket.length?+(100*bucket.filter(x=>x.hit).length/bucket.length).toFixed(1):null,
    avgActualGap:bucket.length?+mean(bucket.map(x=>x.actualGap)).toFixed(2):null
   });
   low=upper;
  }
  console.table(out);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
