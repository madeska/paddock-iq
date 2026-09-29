const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={PositionName?:string;DriverTLA?:string;GamedayPoints?:string|number|null;Value?:string|number|null};
type Tags={street:boolean;speed:0|1|2};

// Objective coarse circuit descriptors for the completed 2026 rounds.
// speed: 0=low, 1=medium/mixed, 2=high.  Street denotes temporary/street-style layouts.
const TRACK:Record<number,Tags>={
  1:{street:false,speed:1}, // Melbourne
  2:{street:false,speed:1}, // Shanghai
  3:{street:false,speed:2}, // Suzuka
  4:{street:true, speed:1}, // Miami
  5:{street:true, speed:2}, // Montreal
  6:{street:true, speed:0}, // Monaco
  7:{street:false,speed:1}, // Barcelona
  8:{street:false,speed:1}, // Spielberg
  9:{street:false,speed:2}, // Silverstone
 10:{street:false,speed:2}, // Spa
 11:{street:false,speed:0}, // Budapest
 12:{street:false,speed:1}, // Zandvoort
 13:{street:false,speed:2}, // Monza
 14:{street:true, speed:1}, // Madrid
 15:{street:true, speed:2}, // Baku
};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
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

type HistPoint={round:number;points:number};
type Ex={round:number;code:string;y:number;price:number;history:HistPoint[]};

function baseFeatures(h:HistPoint[],price:number){
 const pts=h.map(x=>x.points);
 return [ewma(pts)??0,mean(pts),price];
}
function circuitFeatures(h:HistPoint[],targetRound:number){
 const target=TRACK[targetRound];
 const overall=h.map(x=>x.points);
 const street=h.filter(x=>TRACK[x.round]?.street===target.street).map(x=>x.points);
 const speed=h.filter(x=>TRACK[x.round]?.speed===target.speed).map(x=>x.points);
 const both=h.filter(x=>{
   const t=TRACK[x.round]; return t && t.street===target.street && t.speed===target.speed;
 }).map(x=>x.points);

 // shrink similarity means toward the driver's overall mean so sparse buckets do not explode.
 const overallMean=mean(overall);
 const shrink=(xs:number[],k:number)=>xs.length?(xs.reduce((a,b)=>a+b,0)+k*overallMean)/(xs.length+k):overallMean;
 return [
   shrink(street,2)-overallMean,
   shrink(speed,2)-overallMean,
   shrink(both,3)-overallMean,
   Math.min(street.length,4),
   Math.min(speed.length,4),
 ];
}

type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(3),RMSE:+Math.sqrt(m.sq/m.n).toFixed(3),Bias:+(m.bias/m.n).toFixed(3)});

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const hist=new Map<string,HistPoint[]>();
 const examples:Ex[]=[];
 for(let round=1;round<=15;round++){
   for(const row of feeds.get(round)!.filter(r=>r.PositionName==='DRIVER')){
     const code=String(row.DriverTLA??'').toUpperCase();
     const y=Number(row.GamedayPoints),price=Number(row.Value);
     if(!code||!Number.isFinite(y)||!Number.isFinite(price))continue;
     const h=hist.get(code)??[];
     if(h.length>=2)examples.push({round,code,y,price,history:h.map(x=>({...x}))});
     h.push({round,points:y});hist.set(code,h);
   }
 }

 const variants=[
   {name:'baseline_ridge3', extra:false, lambda:50},
   {name:'circuit_l10',extra:true,lambda:10},
   {name:'circuit_l25',extra:true,lambda:25},
   {name:'circuit_l50',extra:true,lambda:50},
   {name:'circuit_l100',extra:true,lambda:100},
   {name:'circuit_l250',extra:true,lambda:250},
 ];
 const metrics=new Map(variants.map(v=>[v.name,init()]));

 for(let round=6;round<=15;round++){
   const trainBase=examples.filter(e=>e.round<round);
   const test=examples.filter(e=>e.round===round);
   for(const v of variants){
     const train=trainBase.map(e=>({
       x:v.extra?[...baseFeatures(e.history,e.price),...circuitFeatures(e.history,e.round)]:baseFeatures(e.history,e.price),
       y:e.y
     }));
     const model=fitRidge(train,v.lambda); if(!model)continue;
     for(const e of test){
       const x=v.extra?[...baseFeatures(e.history,e.price),...circuitFeatures(e.history,e.round)]:baseFeatures(e.history,e.price);
       add(metrics.get(v.name)!,model.predict(x)-e.y);
     }
   }
 }


 // Second experiment: keep production ridge3 intact and use only previously observed
 // out-of-sample residuals as a small circuit-specific correction.
 const residualVariants=['resid_a25','resid_a50','resid_a75'];
 const residualMetrics=new Map(residualVariants.map(n=>[n,init()]));
 const pastResiduals:{round:number;code:string;err:number}[]=[];

 for(let round=6;round<=15;round++){
   const train=examples.filter(e=>e.round<round).map(e=>({x:baseFeatures(e.history,e.price),y:e.y}));
   const model=fitRidge(train,50); if(!model)continue;

   for(const e of examples.filter(e=>e.round===round)){
     const base=model.predict(baseFeatures(e.history,e.price));
     const target=TRACK[round];
     const relevant=pastResiduals.filter(r=>{
       if(r.code!==e.code)return false;
       const t=TRACK[r.round];
       return !!t && (t.speed===target.speed || t.street===target.street);
     });

     // Weight exact speed+street matches more than one-attribute matches,
     // then shrink toward zero with 3 pseudo-observations.
     let num=0,den=3;
     for(const r of relevant){
       const t=TRACK[r.round];
       const w=(t.speed===target.speed && t.street===target.street)?2:1;
       num+=w*r.err; den+=w;
     }
     const correction=num/den;

     for(const [name,alpha] of [['resid_a25',.25],['resid_a50',.50],['resid_a75',.75]] as const){
       // err = prediction - actual, so subtract positive historical residual.
       add(residualMetrics.get(name)!, (base-alpha*correction)-e.y);
     }

     // Store this round's true out-of-sample baseline residual only after predicting it.
     pastResiduals.push({round,code:e.code,err:base-e.y});
   }
 }

 console.log('\nCIRCUIT RESIDUAL CORRECTION');
 console.table(residualVariants.map(name=>({model:name,...fmt(residualMetrics.get(name)!)})).sort((a,b)=>a.MAE-b.MAE));

 console.log('\nCIRCUIT-AWARE DRIVER WALK-FORWARD');
 console.table(variants.map(v=>({model:v.name,...fmt(metrics.get(v.name)!)})).sort((a,b)=>a.MAE-b.MAE));
}
main().catch(e=>{console.error(e);process.exitCode=1});
