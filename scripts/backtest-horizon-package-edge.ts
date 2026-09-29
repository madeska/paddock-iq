import {predictFantasyPrice} from '../src/lib/fantasy-price-model';

const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null;
};
type Hist={round:number;points:number;price:number};
type AssetProj={type:'DRIVER'|'CONSTRUCTOR';key:string;pred:number;actual:number};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ horizon package edge'}});
 if(!r.ok)throw Error('Round '+round+' failed '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}
function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i];if(Math.abs(d)<1e-10)return null;for(let k=i;k<=n;k++)M[i][k]/=d;for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k]}}
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

type Bin={n:number;wins:number;sumPred:number;sumActual:number};
const init=():Bin=>({n:0,wins:0,sumPred:0,sumActual:0});
const add=(b:Bin,pred:number,actual:number)=>{b.n++;if(actual>0)b.wins++;b.sumPred+=pred;b.sumActual+=actual};
const out=(name:string,b:Bin)=>({bin:name,n:b.n,hitRate:b.n?+(100*b.wins/b.n).toFixed(1):0,avgPred:b.n?+(b.sumPred/b.n).toFixed(2):0,avgActual:b.n?+(b.sumActual/b.n).toFixed(2):0});
const edgeBin=(x:number)=>x<5?'0–5':x<10?'5–10':x<15?'10–15':x<25?'15–25':'25+';

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 // Collect score/price history by stable asset key.
 const history=new Map<string,Hist[]>();
 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!){
   let key:string|null=null;
   if(row.PositionName==='DRIVER')key='D:'+String(row.DriverTLA??'').toUpperCase();
   else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null)key='C:'+String(row.PlayerId);
   if(!key)continue;
   const points=Number(row.GamedayPoints),price=Number(row.Value);
   if(!Number.isFinite(points)||!Number.isFinite(price))continue;
   const h=history.get(key)??[];h.push({round,points,price});history.set(key,h);
  }
 }

 for(const size of [1,2,3]){
  const bins=new Map<string,Bin>(['0–5','5–10','10–15','15–25','25+'].map(x=>[x,init()]));
  let sampled=0;

  for(let start=6;start<=13;start++){
   // Train the driver model only on rounds before the horizon start.
   const train:{x:number[];y:number}[]=[];
   for(const [key,h] of history){
    if(!key.startsWith('D:'))continue;
    for(let target=6;target<start;target++){
     const prior=h.filter(x=>x.round<target).sort((a,b)=>a.round-b.round);
     const targetRow=h.find(x=>x.round===target);
     if(prior.length<2||!targetRow)continue;
     train.push({x:driverFeatures(prior.map(x=>x.points),targetRow.price),y:targetRow.points});
    }
   }
   const driverModel=fitRidge(train,50);
   if(!driverModel)continue;

   const assets:AssetProj[]=[];
   for(const [key,h] of history){
    const type:keyof any = key.startsWith('D:')?'DRIVER':'CONSTRUCTOR';
    const prior=h.filter(x=>x.round<start).sort((a,b)=>a.round-b.round);
    const current=h.find(x=>x.round===start);
    const actualRows=[0,1,2].map(step=>h.find(x=>x.round===start+step));
    if(prior.length<2||!current||actualRows.some(x=>!x))continue;

    let projectedHistory=prior.map(x=>x.points);
    let projectedPrice=current.price;
    let pred=0;

    for(let step=0;step<3;step++){
     let p=type==='DRIVER'
       ?driverModel.predict(driverFeatures(projectedHistory,projectedPrice))
       :Math.max(-5,ewma(projectedHistory));
     pred+=p;

     const newest=[...projectedHistory].reverse();
     const model=newest.length>=2?predictFantasyPrice({
       currentPrice:projectedPrice,
       previousFantasyPoints:[newest[1],newest[0]],
       expectedPoints:p,
       pointsStdDev:std(newest.slice(0,5))
     }):null;
     projectedPrice=Math.max(3,projectedPrice+(model?.expectedDelta??0));
     projectedHistory.push(p);
    }

    const actual=actualRows.reduce((s,x)=>s+(x?.points??0),0);
    assets.push({type:type as 'DRIVER'|'CONSTRUCTOR',key,pred,actual});
   }

   const outCombos:number[][]=[];
   const choose=(from:number,acc:number[])=>{
    if(acc.length===size){outCombos.push([...acc]);return}
    for(let i=from;i<assets.length;i++)choose(i+1,[...acc,i]);
   };
   choose(0,[]);

   for(const outIdx of outCombos){
    const outs=outIdx.map(i=>assets[i]);
    const dNeed=outs.filter(x=>x.type==='DRIVER').length;
    const cNeed=size-dNeed;
    const pool=assets.filter((_,i)=>!outIdx.includes(i));

    const inCombos:number[][]=[];
    const chooseIn=(from:number,acc:number[])=>{
      if(acc.length===size){
        const ins=acc.map(i=>pool[i]);
        if(ins.filter(x=>x.type==='DRIVER').length===dNeed&&ins.filter(x=>x.type==='CONSTRUCTOR').length===cNeed)inCombos.push([...acc]);
        return;
      }
      for(let i=from;i<pool.length;i++)chooseIn(i+1,[...acc,i]);
    };
    chooseIn(0,[]);

    const stride=Math.max(1,Math.floor(inCombos.length/50));
    for(let k=0;k<inCombos.length;k+=stride){
      const ins=inCombos[k].map(i=>pool[i]);
      const pred=ins.reduce((s,x)=>s+x.pred,0)-outs.reduce((s,x)=>s+x.pred,0);
      if(pred<=0)continue;
      const actual=ins.reduce((s,x)=>s+x.actual,0)-outs.reduce((s,x)=>s+x.actual,0);
      add(bins.get(edgeBin(pred))!,pred,actual);sampled++;
    }
   }
  }

  console.log('\n3GP PACKAGE SIZE '+size);
  console.table([...bins.entries()].map(([name,b])=>out(name,b)));
  console.log('sampled',sampled);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
