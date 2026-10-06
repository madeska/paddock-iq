import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const START_ROUND=6,END_ROUND=13;
const BUDGETS=[120,125,130,135];
const SPRINT_ROUNDS=new Set([2,4,5,9,12,17]);
const SPRINT_CORRECTION={DRIVER:2.58,CONSTRUCTOR:3.70} as const;
const GAP_BINS=[5,10,20,40,Infinity];

type Row={PositionName?:string;DriverTLA?:string;PlayerId?:string|number;GamedayPoints?:string|number|null;Value?:string|number|null};
type Hist={round:number;points:number;price:number};
type Type='DRIVER'|'CONSTRUCTOR';
type Asset={
 code:string;type:Type;price:number;
 pred:number[];actual:number[];
};
type Team={price:number;predicted:number;actual:number};
type Obs={start:number;budget:number;predictedGap:number;actualGap:number;hit:boolean};

const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};
const features=(h:number[],price:number)=>[ewma(h),mean(h),price];

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ horizon lineup confidence'}});
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

function teamScore(drivers:Asset[],constructors:Asset[],field:'pred'|'actual'){
 let total=0;
 for(let step=0;step<3;step++){
  total+=constructors.reduce((s,a)=>s+a[field][step],0);
  total+=drivers.reduce((s,a)=>s+a[field][step],0);
  total+=Math.max(...drivers.map(a=>a[field][step]));
 }
 return total;
}

function enumerateTeams(assets:Asset[],maxBudget:number){
 const ds=assets.filter(a=>a.type==='DRIVER'),cs=assets.filter(a=>a.type==='CONSTRUCTOR'),teams:Team[]=[];
 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructors=[cs[a],cs[b]],cp=constructors[0].price+constructors[1].price;if(cp>maxBudget)continue;
  for(let i=0;i<ds.length-4;i++)for(let j=i+1;j<ds.length-3;j++)for(let k=j+1;k<ds.length-2;k++)for(let l=k+1;l<ds.length-1;l++)for(let m=l+1;m<ds.length;m++){
   const drivers=[ds[i],ds[j],ds[k],ds[l],ds[m]];
   const price=cp+drivers.reduce((s,x)=>s+x.price,0);if(price>maxBudget+1e-9)continue;
   teams.push({price,predicted:teamScore(drivers,constructors,'pred'),actual:teamScore(drivers,constructors,'actual')});
  }
 }
 return teams;
}

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const history=new Map<string,Hist[]>(),types=new Map<string,Type>();
 for(let round=1;round<=15;round++)for(const row of feeds.get(round)!){
  let code:string|null=null,type:Type|null=null;
  if(row.PositionName==='DRIVER'){code='D:'+String(row.DriverTLA??'').toUpperCase();type='DRIVER'}
  else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){code='C:'+String(row.PlayerId);type='CONSTRUCTOR'}
  if(!code||!type)continue;
  const points=Number(row.GamedayPoints),price=Number(row.Value);if(!Number.isFinite(points)||!Number.isFinite(price)||price<=0)continue;
  const h=history.get(code)??[];h.push({round,points,price});history.set(code,h);types.set(code,type);
 }

 const observations:Obs[]=[];
 const scenarioSummary:any[]=[];

 for(let start=START_ROUND;start<=END_ROUND;start++){
  const train:{x:number[];y:number}[]=[];
  for(const [code,h] of history){if(types.get(code)!=='DRIVER')continue;
   for(let target=3;target<start;target++){
    const prior=h.filter(x=>x.round<target).sort((a,b)=>a.round-b.round),targetRow=h.find(x=>x.round===target);
    if(prior.length<2||!targetRow)continue;
    train.push({x:features(prior.map(x=>x.points),targetRow.price),y:targetRow.points});
   }
  }
  const model=fitRidge(train,50);if(!model)continue;

  const assets:Asset[]=[];
  for(const [code,h] of history){
   const type=types.get(code)!;
   const prior=h.filter(x=>x.round<start).sort((a,b)=>a.round-b.round);
   const startRow=h.find(x=>x.round===start);
   const actualRows=[0,1,2].map(step=>h.find(x=>x.round===start+step));
   if(prior.length<2||!startRow||actualRows.some(x=>!x))continue;

   let projectedHistory=prior.map(x=>x.points),projectedPrice=startRow.price;
   const pred:number[]=[];
   for(let step=0;step<3;step++){
    const e=ewma(projectedHistory);
    let p=type==='DRIVER'
      ?(.25*(model.predict(features(projectedHistory,projectedPrice)))+.75*e)
      :Math.max(-5,e);
    p=Math.max(-5,p)+(SPRINT_ROUNDS.has(start+step)?SPRINT_CORRECTION[type]:0);
    pred.push(p);
    const newest=[...projectedHistory].reverse();
    const pm=predictFantasyPrice({
      currentPrice:projectedPrice,
      previousFantasyPoints:newest.slice(0,2).reverse(),
      expectedPoints:p,
      pointsStdDev:std(newest.slice(0,5))
    });
    projectedPrice=Math.max(3,projectedPrice+pm.expectedDelta);
    projectedHistory.push(p);
   }
   assets.push({code,type,price:startRow.price,pred,actual:actualRows.map(x=>x!.points)});
  }

  const allTeams=enumerateTeams(assets,Math.max(...BUDGETS));
  for(const budget of BUDGETS){
   const teams=allTeams.filter(t=>t.price<=budget+1e-9).sort((a,b)=>b.predicted-a.predicted);
   const top=teams.slice(0,25);if(top.length<2)continue;
   let hits=0,pairs=0;
   for(let i=0;i<top.length-1;i++)for(let j=i+1;j<top.length;j++){
    const predictedGap=top[i].predicted-top[j].predicted;
    const actualGap=top[i].actual-top[j].actual;
    observations.push({start,budget,predictedGap,actualGap,hit:actualGap>0});
    hits+=actualGap>0?1:0;pairs++;
   }
   scenarioSummary.push({start,budget,teams:teams.length,top1Pred:+top[0].predicted.toFixed(1),top1Actual:+top[0].actual.toFixed(1),pairwiseHitRate:+(100*hits/pairs).toFixed(1)});
  }
 }

 console.log('\n3GP LINEUP CONFIDENCE CALIBRATION');
 console.log('Hit = higher predicted 3GP lineup actually scores more over the same three GPs, including optimal x2 each round.');
 console.table(scenarioSummary);

 let low=0;
 const out=[] as any[];
 for(const upper of GAP_BINS){
  const bucket=observations.filter(x=>x.predictedGap>=low&&x.predictedGap<upper);
  out.push({
   predictedGap:upper===Infinity?'>= '+low:low+'–'+upper,
   n:bucket.length,
   hitRate:bucket.length?+(100*bucket.filter(x=>x.hit).length/bucket.length).toFixed(1):null,
   avgActualGap:bucket.length?+mean(bucket.map(x=>x.actualGap)).toFixed(1):null
  });
  low=upper;
 }
 console.log('\nPAIRWISE CONFIDENCE BY 3GP xPTS GAP');
 console.table(out);
}
main().catch(e=>{console.error(e);process.exitCode=1});
