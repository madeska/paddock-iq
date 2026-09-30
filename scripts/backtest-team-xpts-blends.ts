import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6, END_ROUND=15;
const BUDGETS=[120,125,130,135];
const DRIVER_ALPHAS=[0,.25,.5,.75,1]; // 0=EWMA, 1=ridge
const CONSTRUCTOR_ALPHAS=[0,.5,1]; // 0=mean3, 1=EWMA

type Row={PositionName?:string;DriverTLA?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};
type Hist={round:number;points:number;price:number};
type Asset={
 code:string;type:'DRIVER'|'CONSTRUCTOR';price:number;
 ridge:number;ewma:number;mean3:number;expectedDelta:number;
 actualPoints:number;actualDelta:number;
};
type Variant={d:number;c:number;key:string};
type Pick={pred:number;actual:number;boostHit:boolean;boostRegret:number}|null;

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewmaFn=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ xPts blend team backtest'}});
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
const features=(h:number[],price:number)=>[ewmaFn(h),mean(h),price];
const variants:Variant[]=DRIVER_ALPHAS.flatMap(d=>CONSTRUCTOR_ALPHAS.map(c=>({d,c,key:`d${d}-c${c}`})));

function driverPred(a:Asset,v:Variant){return v.d*a.ridge+(1-v.d)*a.ewma}
function constructorPred(a:Asset,v:Variant){return v.c*a.ewma+(1-v.c)*a.mean3}

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

 const observations:{key:string;round:number;budget:number;actual:number;boostHit:boolean;boostRegret:number}[]=[];
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
   const before=prior[prior.length-1],hist=prior.map(x=>x.points),recent=hist.slice(-3);
   const ridge=type==='DRIVER'?model.predict(features(hist,before.price)):ewmaFn(hist);
   const e=ewmaFn(hist),m3=mean(recent);
   const newest=[...hist].reverse();
   const expectedForPrice=type==='DRIVER'?ridge:e;
   const pm=newest.length>=2?predictFantasyPrice({currentPrice:before.price,previousFantasyPoints:[newest[1],newest[0]],expectedPoints:expectedForPrice,pointsStdDev:std(hist.slice(-5))}):null;
   assets.push({code,type,price:before.price,ridge,ewma:e,mean3:m3,expectedDelta:pm?.expectedDelta??0,actualPoints:actual.points,actualDelta:actual.price-before.price});
  }

  const ds=assets.filter(a=>a.type==='DRIVER'),cs=assets.filter(a=>a.type==='CONSTRUCTOR');
  for(const budget of BUDGETS){
   const best=new Map<string,Pick>(variants.map(v=>[v.key,null]));
   for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
    const constructors=[cs[a],cs[b]],cp=constructors[0].price+constructors[1].price;if(cp>budget)continue;
    for(let i=0;i<ds.length-4;i++)for(let j=i+1;j<ds.length-3;j++)for(let k=j+1;k<ds.length-2;k++)for(let l=k+1;l<ds.length-1;l++)for(let m=l+1;m<ds.length;m++){
     const drivers=[ds[i],ds[j],ds[k],ds[l],ds[m]],price=cp+drivers.reduce((s,x)=>s+x.price,0);if(price>budget+1e-9)continue;
     for(const v of variants){
      const boost=drivers.reduce((cur,x)=>driverPred(x,v)>driverPred(cur,v)?x:cur);
      const pred=constructors.reduce((s,x)=>s+constructorPred(x,v),0)+drivers.reduce((s,x)=>s+driverPred(x,v),0)+driverPred(boost,v);
      const cur=best.get(v.key);
      if(cur&&cur.pred>=pred)continue;
      const actualBase=[...constructors,...drivers].reduce((s,x)=>s+x.actualPoints,0);
      const actual=actualBase+boost.actualPoints;
      const bestActualBoost=drivers.reduce((cur,x)=>x.actualPoints>cur.actualPoints?x:cur);
      best.set(v.key,{pred,actual,boostHit:boost.code===bestActualBoost.code,boostRegret:bestActualBoost.actualPoints-boost.actualPoints});
     }
    }
   }
   for(const v of variants){
    const pick=best.get(v.key);if(!pick)continue;
    observations.push({key:v.key,round,budget,actual:pick.actual,boostHit:pick.boostHit,boostRegret:pick.boostRegret});
   }
  }
 }

 const summary=variants.map(v=>{
  const rows=observations.filter(x=>x.key===v.key);
  return {
   driverRidgeWeight:v.d,constructorEwmaWeight:v.c,n:rows.length,
   avgActualPoints:+mean(rows.map(x=>x.actual)).toFixed(1),
   boostHitRate:+(100*rows.filter(x=>x.boostHit).length/rows.length).toFixed(1),
   avgBoostRegret:+mean(rows.map(x=>x.boostRegret)).toFixed(2)
  };
 }).sort((a,b)=>b.avgActualPoints-a.avgActualPoints);
 console.log('\nTEAM xPTS BLEND GRID — POINTS MODE');
 console.table(summary);
 console.log('\nBEST',summary[0]);
 console.log('\nBASELINE ridge1 / constructorEWMA1',summary.find(x=>x.driverRidgeWeight===1&&x.constructorEwmaWeight===1));
}
main().catch(e=>{console.error(e);process.exitCode=1});
