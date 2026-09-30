import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6,END_ROUND=13;
const DRIVER_ALPHAS=[0,.25,.5,.75,1]; // 0=EWMA, 1=ridge
const CONSTRUCTOR_ALPHAS=[0,.5,1]; // 0=mean3, 1=EWMA
const SPRINT_ROUNDS=new Set([2,4,5,9,12,17]);
const SPRINT_CORRECTION={DRIVER:2.58,CONSTRUCTOR:3.70} as const;

type Row={PositionName?:string;DriverTLA?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};
type Hist={round:number;points:number;price:number};
type Type='DRIVER'|'CONSTRUCTOR';
type Variant={d:number;c:number;key:string};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const out=(m:M)=>({n:m.n,mae:m.n?m.ae/m.n:0,rmse:m.n?Math.sqrt(m.sq/m.n):0,bias:m.n?m.bias/m.n:0});

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};
const features=(h:number[],price:number)=>[ewma(h),mean(h),price];

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ horizon blend grid'}});
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
const variants:Variant[]=DRIVER_ALPHAS.flatMap(d=>CONSTRUCTOR_ALPHAS.map(c=>({d,c,key:`d${d}-c${c}`})));

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const history=new Map<string,Hist[]>(),types=new Map<string,Type>();
 for(let round=1;round<=15;round++)for(const row of feeds.get(round)!){
  let key:string|null=null,type:Type|null=null;
  if(row.PositionName==='DRIVER'){key='D:'+String(row.DriverTLA??'').toUpperCase();type='DRIVER'}
  else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){key='C:'+String(row.PlayerId);type='CONSTRUCTOR'}
  if(!key||!type)continue;
  const points=Number(row.GamedayPoints),price=Number(row.Value);if(!Number.isFinite(points)||!Number.isFinite(price))continue;
  const h=history.get(key)??[];h.push({round,points,price});history.set(key,h);types.set(key,type);
 }

 const metrics=new Map<string,{steps:[M,M,M];total:M;driver:[M,M,M];constructor:[M,M,M]}>();
 for(const v of variants)metrics.set(v.key,{steps:[init(),init(),init()],total:init(),driver:[init(),init(),init()],constructor:[init(),init(),init()]});

 for(let start=START_ROUND;start<=END_ROUND;start++){
  const train:{x:number[];y:number}[]=[];
  for(const [key,h] of history){if(types.get(key)!=='DRIVER')continue;for(let target=6;target<start;target++){
   const prior=h.filter(x=>x.round<target).sort((a,b)=>a.round-b.round),targetRow=h.find(x=>x.round===target);
   if(prior.length<2||!targetRow)continue;
   train.push({x:features(prior.map(x=>x.points),targetRow.price),y:targetRow.points});
  }}
  const model=fitRidge(train,50);if(!model)continue;

  for(const [key,h] of history){
   const type=types.get(key)!;
   const prior=h.filter(x=>x.round<start).sort((a,b)=>a.round-b.round),current=h.find(x=>x.round===start);
   const actuals=[0,1,2].map(step=>h.find(x=>x.round===start+step));
   if(prior.length<2||!current||actuals.some(x=>!x))continue;

   for(const v of variants){
    let projectedHistory=prior.map(x=>x.points),projectedPrice=current.price,totalPred=0,totalActual=0;
    for(let step=0;step<3;step++){
     const ridge=type==='DRIVER'?model.predict(features(projectedHistory,projectedPrice)):0;
     const e=ewma(projectedHistory),m3=mean(projectedHistory.slice(-3));
     let pred=type==='DRIVER'?v.d*ridge+(1-v.d)*e:v.c*e+(1-v.c)*m3;
     pred=Math.max(-5,pred)+(SPRINT_ROUNDS.has(start+step)?SPRINT_CORRECTION[type]:0);
     const actual=actuals[step]!.points;
     const m=metrics.get(v.key)!;
     add(m.steps[step],pred-actual);
     add(type==='DRIVER'?m.driver[step]:m.constructor[step],pred-actual);
     totalPred+=pred;totalActual+=actual;

     const newest=[...projectedHistory].reverse();
     const pm=newest.length>=2?predictFantasyPrice({
      currentPrice:projectedPrice,
      previousFantasyPoints:[newest[1],newest[0]],
      expectedPoints:pred,
      pointsStdDev:std(newest.slice(0,5))
     }):null;
     projectedPrice=Math.max(3,projectedPrice+(pm?.expectedDelta??0));
     projectedHistory.push(pred);
    }
    add(metrics.get(v.key)!.total,totalPred-totalActual);
   }
  }
 }

 const summary=variants.map(v=>{
  const m=metrics.get(v.key)!;
  const total=out(m.total);
  return {
   driverRidgeWeight:v.d,constructorEwmaWeight:v.c,
   total3GpMAE:+total.mae.toFixed(2),total3GpRMSE:+total.rmse.toFixed(2),total3GpBias:+total.bias.toFixed(2),
   h1MAE:+out(m.steps[0]).mae.toFixed(2),h2MAE:+out(m.steps[1]).mae.toFixed(2),h3MAE:+out(m.steps[2]).mae.toFixed(2)
  };
 }).sort((a,b)=>a.total3GpMAE-b.total3GpMAE);
 console.log('\nHORIZON xPTS BLEND GRID');
 console.table(summary);
 console.log('\nBEST',summary[0]);
 console.log('\nBASELINE ridge1 / constructorEWMA1',summary.find(x=>x.driverRidgeWeight===1&&x.constructorEwmaWeight===1));
 console.log('\nCURRENT ONE-GP CALIBRATED BLEND 0.5/0.5',summary.find(x=>x.driverRidgeWeight===.5&&x.constructorEwmaWeight===.5));
}
main().catch(e=>{console.error(e);process.exitCode=1});
