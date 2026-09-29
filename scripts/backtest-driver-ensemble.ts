const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={PositionName?:string;DriverTLA?:string;TeamId?:string|number;TeamName?:string;FUllName?:string;DisplayName?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};
const hybrid=(h:number[])=>{const e=ewma(h)??0;return .7*e+.3*mean(h)};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function features(h:number[],price:number){
 const e=ewma(h)??0,s=mean(h),last=h.at(-1)??s;
 return [e,s,last,mean(h.slice(-2)),mean(h.slice(-3)),std(h.slice(-5)),price];
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

type Ex={round:number;key:string;y:number;price:number;history:number[]};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(2),RMSE:+Math.sqrt(m.sq/m.n).toFixed(2),Bias:+(m.bias/m.n).toFixed(2)});

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const hist=new Map<string,number[]>();
 const examples:Ex[]=[];
 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!.filter(r=>r.PositionName==='DRIVER')){
   const key=String(row.DriverTLA??'').toUpperCase();
   const y=Number(row.GamedayPoints),price=Number(row.Value);
   if(!key||!Number.isFinite(y)||!Number.isFinite(price))continue;
   const h=hist.get(key)??[];
   if(h.length>=2)examples.push({round,key,y,price,history:[...h]});
   h.push(y);hist.set(key,h);
  }
 }

 const weights=[0,0.25,0.5,0.75,1];
 const names=weights.map(w=>'ridge_'+Math.round(w*100));
 const metrics=new Map(names.map(n=>[n,init()]));

 for(let round=6;round<=15;round++){
  const train=examples.filter(e=>e.round<round).map(e=>({x:features(e.history,e.price),y:e.y}));
  const model=fitRidge(train,50);
  if(!model)continue;

  for(const e of examples.filter(e=>e.round===round)){
   const r=model.predict(features(e.history,e.price));
   const h=hybrid(e.history);
   for(const w of weights){
    const p=w*r+(1-w)*h;
    add(metrics.get('ridge_'+Math.round(w*100))!,p-e.y);
   }
  }
 }

 console.log('\nDRIVER ENSEMBLE WALK-FORWARD');
 console.table(names.map(name=>({model:name,...fmt(metrics.get(name)!)})).sort((a,b)=>a.MAE-b.MAE));
}
main().catch(e=>{console.error(e);process.exitCode=1});
