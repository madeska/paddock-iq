const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;TeamId?:string|number;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null;
};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ constructor blend'}});
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
function driverFeatures(h:number[],price:number){return [ewma(h),mean(h),price]}

type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(3),RMSE:+Math.sqrt(m.sq/m.n).toFixed(3),Bias:+(m.bias/m.n).toFixed(3)});

type CEx={round:number;key:string;y:number;baseline:number;pairSum:number};

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const driverHist=new Map<string,number[]>();
 const constructorHist=new Map<string,number[]>();
 const driverExamples:{round:number;code:string;y:number;price:number;history:number[]}[]=[];

 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!.filter(r=>r.PositionName==='DRIVER')){
   const code=String(row.DriverTLA??'').toUpperCase(),y=Number(row.GamedayPoints),price=Number(row.Value);
   if(!code||!Number.isFinite(y)||!Number.isFinite(price))continue;
   const h=driverHist.get(code)??[];
   if(h.length>=2)driverExamples.push({round,code,y,price,history:[...h]});
   h.push(y);driverHist.set(code,h);
  }
 }

 const driverPredByRound=new Map<number,Map<string,number>>();
 for(let round=6;round<=15;round++){
  const train=driverExamples.filter(e=>e.round<round).map(e=>({x:driverFeatures(e.history,e.price),y:e.y}));
  const model=fitRidge(train,50);if(!model)continue;
  const map=new Map<string,number>();
  for(const e of driverExamples.filter(e=>e.round===round)){
   map.set(e.code,model.predict(driverFeatures(e.history,e.price)));
  }
  driverPredByRound.set(round,map);
 }

 const cExamples:CEx[]=[];
 for(let round=1;round<=15;round++){
  const feed=feeds.get(round)!;
  const constructorIds=new Set(feed.filter(r=>r.PositionName==='CONSTRUCTOR'&&r.PlayerId!=null).map(r=>String(r.PlayerId)));
  const driversByConstructor=new Map<string,string[]>();
  for(const d of feed.filter(r=>r.PositionName==='DRIVER'&&r.TeamId!=null)){
   const cid=String(d.TeamId);if(!constructorIds.has(cid))continue;
   const code=String(d.DriverTLA??'').toUpperCase();
   const arr=driversByConstructor.get(cid)??[];if(code)arr.push(code);driversByConstructor.set(cid,arr);
  }

  for(const row of feed.filter(r=>r.PositionName==='CONSTRUCTOR'&&r.PlayerId!=null)){
   const key=String(row.PlayerId),y=Number(row.GamedayPoints);
   if(!Number.isFinite(y))continue;
   const h=constructorHist.get(key)??[];
   if(round>=6&&h.length>=2){
    const preds=driversByConstructor.get(key)?.map(code=>driverPredByRound.get(round)?.get(code)).filter((x):x is number=>x!=null)??[];
    if(preds.length>=2)cExamples.push({round,key,y,baseline:Math.max(-5,ewma(h)),pairSum:preds[0]+preds[1]});
   }
   h.push(y);constructorHist.set(key,h);
  }
 }

 const weights=[0,.1,.25,.5,.75,1];
 const metrics=new Map(weights.map(w=>['w'+w,init()]));

 for(let round=7;round<=15;round++){
  const prior=cExamples.filter(e=>e.round<round);
  const test=cExamples.filter(e=>e.round===round);
  if(prior.length<10)continue;

  // leakage-safe linear calibration from predicted driver-pair sum -> constructor score.
  const xs=prior.map(e=>e.pairSum),ys=prior.map(e=>e.y);
  const mx=mean(xs),my=mean(ys);
  const denom=xs.reduce((s,x)=>s+(x-mx)**2,0);
  const slope=denom>1e-8?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/denom:0;
  const intercept=my-slope*mx;

  for(const e of test){
   const pairPred=intercept+slope*e.pairSum;
   for(const w of weights){
    const p=(1-w)*e.baseline+w*pairPred;
    add(metrics.get('w'+w)!,p-e.y);
   }
  }
 }

 console.log('\nCONSTRUCTOR DRIVER-PAIR BLEND');
 console.table(weights.map(w=>({driverPairWeight:w,...fmt(metrics.get('w'+w)!)})).sort((a,b)=>a.MAE-b.MAE));
}
main().catch(e=>{console.error(e);process.exitCode=1});
