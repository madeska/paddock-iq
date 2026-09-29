const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null;
};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ transfer edge'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i];if(Math.abs(d)<1e-10)return null;
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
const driverFeatures=(h:number[],price:number)=>[ewma(h),mean(h),price];

type AssetRound={round:number;type:'DRIVER'|'CONSTRUCTOR';key:string;y:number;pred:number};
type Bin={n:number;wins:number;sumPred:number;sumActual:number;sumAbsErr:number};
const init=():Bin=>({n:0,wins:0,sumPred:0,sumActual:0,sumAbsErr:0});
function add(b:Bin,pred:number,actual:number){
 b.n++;if(actual>0)b.wins++;b.sumPred+=pred;b.sumActual+=actual;b.sumAbsErr+=Math.abs(pred-actual);
}
function out(name:string,b:Bin){
 return {
  bin:name,n:b.n,
  hitRate:b.n?+(100*b.wins/b.n).toFixed(1):0,
  avgPred:b.n?+(b.sumPred/b.n).toFixed(2):0,
  avgActual:b.n?+(b.sumActual/b.n).toFixed(2):0,
  edgeMAE:b.n?+(b.sumAbsErr/b.n).toFixed(2):0
 };
}
const edgeBin=(x:number)=>x<2?'0–2':x<5?'2–5':x<10?'5–10':x<15?'10–15':'15+';

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const driverHist=new Map<string,number[]>();
 const constructorHist=new Map<string,number[]>();
 const driverExamples:{round:number;key:string;y:number;price:number;history:number[]}[]=[];
 const constructorExamples:{round:number;key:string;y:number;history:number[]}[]=[];

 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!){
   const y=Number(row.GamedayPoints);if(!Number.isFinite(y))continue;
   if(row.PositionName==='DRIVER'){
    const key=String(row.DriverTLA??'').toUpperCase(),price=Number(row.Value);
    if(!key||!Number.isFinite(price))continue;
    const h=driverHist.get(key)??[];
    if(h.length>=2)driverExamples.push({round,key,y,price,history:[...h]});
    h.push(y);driverHist.set(key,h);
   }else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){
    const key=String(row.PlayerId),h=constructorHist.get(key)??[];
    if(h.length>=2)constructorExamples.push({round,key,y,history:[...h]});
    h.push(y);constructorHist.set(key,h);
   }
  }
 }

 const predicted:AssetRound[]=[];
 for(let round=6;round<=15;round++){
  const dTrain=driverExamples.filter(e=>e.round<round).map(e=>({x:driverFeatures(e.history,e.price),y:e.y}));
  const dModel=fitRidge(dTrain,50);
  for(const e of driverExamples.filter(e=>e.round===round)){
   if(dModel)predicted.push({round,type:'DRIVER',key:e.key,y:e.y,pred:dModel.predict(driverFeatures(e.history,e.price))});
  }
  for(const e of constructorExamples.filter(e=>e.round===round)){
   predicted.push({round,type:'CONSTRUCTOR',key:e.key,y:e.y,pred:Math.max(-5,ewma(e.history))});
  }
 }

 for(const type of ['DRIVER','CONSTRUCTOR'] as const){
  const bins=new Map<string,Bin>(['0–2','2–5','5–10','10–15','15+'].map(x=>[x,init()]));
  const thresholds=[0,2,5,10,15].map(t=>({threshold:t,b:init()}));

  for(let round=6;round<=15;round++){
   const rows=predicted.filter(x=>x.type===type&&x.round===round);
   for(let i=0;i<rows.length;i++)for(let j=0;j<rows.length;j++){
    if(i===j)continue;
    const sell=rows[i],buy=rows[j];
    const pred=buy.pred-sell.pred;
    if(pred<=0)continue;
    const actual=buy.y-sell.y;
    add(bins.get(edgeBin(pred))!,pred,actual);
    for(const t of thresholds)if(pred>=t.threshold)add(t.b,pred,actual);
   }
  }

  console.log('\n'+type+' POSITIVE PREDICTED SWAPS — EDGE BINS');
  console.table([...bins.entries()].map(([name,b])=>out(name,b)));

  console.log('\n'+type+' MINIMUM EDGE THRESHOLDS');
  console.table(thresholds.map(t=>({minPredictedEdge:t.threshold,...out('',t.b)})).map(({bin,...x})=>x));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
