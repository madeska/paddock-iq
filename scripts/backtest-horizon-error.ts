const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;TeamId?:string|number;TeamName?:string;
 FUllName?:string;DisplayName?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null
};

const C:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'
};

function keyFor(r:Row,map:Map<string,string>){
 if(r.PositionName==='DRIVER')return 'DRIVER:'+String(r.DriverTLA??'').toUpperCase();
 if(r.PositionName==='CONSTRUCTOR'){
  const n=String(r.TeamName??r.FUllName??r.DisplayName??'').toUpperCase();
  const code=map.get(String(r.PlayerId??''))??C[n];
  return code?'CONSTRUCTOR:'+code:null;
 }
 return null;
}

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};
const constructorPred=(h:number[])=>Math.max(-5,ewma(h)??0);

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

type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(2),RMSE:+Math.sqrt(m.sq/m.n).toFixed(2),Bias:+(m.bias/m.n).toFixed(2)});

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const scoreHistory=new Map<string,Map<number,number>>();
 const priceHistory=new Map<string,Map<number,number>>();
 const types=new Map<string,'DRIVER'|'CONSTRUCTOR'>();

 for(let round=1;round<=15;round++){
  const rows=feeds.get(round)!;
  const tm=new Map<string,string>();
  for(const r of rows)if(r.PositionName==='DRIVER'&&r.TeamId!=null){const c=C[String(r.TeamName??'').toUpperCase()];if(c)tm.set(String(r.TeamId),c)}
  for(const r of rows){
   const key=keyFor(r,tm);if(!key)continue;
   const y=Number(r.GamedayPoints),price=Number(r.Value);
   if(!Number.isFinite(y)||!Number.isFinite(price))continue;
   if(!scoreHistory.has(key))scoreHistory.set(key,new Map());
   if(!priceHistory.has(key))priceHistory.set(key,new Map());
   scoreHistory.get(key)!.set(round,y);
   priceHistory.get(key)!.set(round,price);
   types.set(key,key.startsWith('DRIVER:')?'DRIVER':'CONSTRUCTOR');
  }
 }

 const metrics=[init(),init(),init()];
 const driverMetrics=[init(),init(),init()];
 const constructorMetrics=[init(),init(),init()];

 for(let start=6;start<=13;start++){
  const train:{x:number[];y:number}[]=[];
  for(const [key,scores] of scoreHistory){
   if(types.get(key)!=='DRIVER')continue;
   const prices=priceHistory.get(key)!;
   for(let target=6;target<start;target++){
    const hist=[...scores.entries()].filter(([r])=>r<target).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
    const y=scores.get(target),price=prices.get(target);
    if(hist.length<2||y==null||price==null)continue;
    train.push({x:features(hist,price),y});
   }
  }
  const driverModel=fitRidge(train,50);

  for(const [key,scores] of scoreHistory){
   const type=types.get(key)!;
   const prices=priceHistory.get(key)!;
   const initial=[...scores.entries()].filter(([r])=>r<start).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
   const price0=prices.get(start);
   if(initial.length<2||price0==null)continue;

   const projected=[...initial];
   let price=price0;
   for(let h=0;h<3;h++){
    const target=start+h;
    const actual=scores.get(target);
    if(actual==null)break;

    const pred=type==='DRIVER'
      ?(driverModel?.predict(features(projected,price))??(.7*(ewma(projected)??0)+.3*mean(projected)))
      :constructorPred(projected);

    const e=pred-actual;
    add(metrics[h],e);
    add(type==='DRIVER'?driverMetrics[h]:constructorMetrics[h],e);

    projected.push(pred);
    const nextPrice=prices.get(target+1);
    if(nextPrice!=null)price=nextPrice;
   }
  }
 }

 const rows=(ms:M[])=>ms.map((m,i)=>({horizon:i+1,...fmt(m)}));
 console.log('\nOVERALL');console.table(rows(metrics));
 console.log('\nDRIVERS');console.table(rows(driverMetrics));
 console.log('\nCONSTRUCTORS');console.table(rows(constructorMetrics));
}

main().catch(e=>{console.error(e);process.exitCode=1});
