const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null;
};
type AssetPred={type:'DRIVER'|'CONSTRUCTOR';key:string;pred:number;y:number};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let v=h[0];for(const x of h.slice(1))v=a*x+(1-a)*v;return v};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ package edge'}});
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
const f=(h:number[],price:number)=>[ewma(h),mean(h),price];

type Bin={n:number;wins:number;sumPred:number;sumActual:number};
const init=():Bin=>({n:0,wins:0,sumPred:0,sumActual:0});
const add=(b:Bin,pred:number,actual:number)=>{b.n++;if(actual>0)b.wins++;b.sumPred+=pred;b.sumActual+=actual};
const out=(name:string,b:Bin)=>({bin:name,n:b.n,hitRate:b.n?+(100*b.wins/b.n).toFixed(1):0,avgPred:b.n?+(b.sumPred/b.n).toFixed(2):0,avgActual:b.n?+(b.sumActual/b.n).toFixed(2):0});
const edgeBin=(x:number)=>x<2?'0–2':x<5?'2–5':x<10?'5–10':x<15?'10–15':'15+';

async function main(){
 const feeds=new Map<number,Row[]>();for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));
 const dh=new Map<string,number[]>(),ch=new Map<string,number[]>();
 const dex:{round:number;key:string;y:number;price:number;history:number[]}[]=[];
 const cex:{round:number;key:string;y:number;history:number[]}[]=[];
 for(let round=1;round<=15;round++){
  for(const row of feeds.get(round)!){
   const y=Number(row.GamedayPoints);if(!Number.isFinite(y))continue;
   if(row.PositionName==='DRIVER'){
    const key=String(row.DriverTLA??'').toUpperCase(),price=Number(row.Value);if(!key||!Number.isFinite(price))continue;
    const h=dh.get(key)??[];if(h.length>=2)dex.push({round,key,y,price,history:[...h]});h.push(y);dh.set(key,h);
   }else if(row.PositionName==='CONSTRUCTOR'&&row.PlayerId!=null){
    const key=String(row.PlayerId),h=ch.get(key)??[];if(h.length>=2)cex.push({round,key,y,history:[...h]});h.push(y);ch.set(key,h);
   }
  }
 }

 const byRound=new Map<number,AssetPred[]>();
 for(let round=6;round<=15;round++){
  const model=fitRidge(dex.filter(e=>e.round<round).map(e=>({x:f(e.history,e.price),y:e.y})),50);
  const arr:AssetPred[]=[];
  for(const e of dex.filter(e=>e.round===round))if(model)arr.push({type:'DRIVER',key:e.key,pred:model.predict(f(e.history,e.price)),y:e.y});
  for(const e of cex.filter(e=>e.round===round))arr.push({type:'CONSTRUCTOR',key:e.key,pred:Math.max(-5,ewma(e.history)),y:e.y});
  byRound.set(round,arr);
 }

 for(const size of [1,2,3]){
  const bins=new Map<string,Bin>(['0–2','2–5','5–10','10–15','15+'].map(x=>[x,init()]));
  let sampled=0;
  for(let round=6;round<=15;round++){
   const rows=byRound.get(round)??[];
   // Enumerate package swaps while preserving type counts. To keep CI bounded,
   // sample deterministic combinations by index spacing.
   const outgoingCombos:number[][]=[];
   const choose=(start:number,pick:number,acc:number[])=>{
    if(acc.length===pick){outgoingCombos.push([...acc]);return}
    for(let i=start;i<rows.length;i++)choose(i+1,pick,[...acc,i]);
   };
   choose(0,size,[]);
   for(const outsIdx of outgoingCombos){
    const outs=outsIdx.map(i=>rows[i]);
    const needed={DRIVER:outs.filter(x=>x.type==='DRIVER').length,CONSTRUCTOR:outs.filter(x=>x.type==='CONSTRUCTOR').length};
    const candidates=rows.filter((_,i)=>!outsIdx.includes(i));
    const insCombos:number[][]=[];
    const pickIns=(start:number,acc:number[])=>{
     if(acc.length===size){
      const ins=acc.map(i=>candidates[i]);
      if(ins.filter(x=>x.type==='DRIVER').length===needed.DRIVER&&ins.filter(x=>x.type==='CONSTRUCTOR').length===needed.CONSTRUCTOR)insCombos.push([...acc]);
      return;
     }
     for(let i=start;i<candidates.length;i++)pickIns(i+1,[...acc,i]);
    };
    pickIns(0,[]);
    for(let k=0;k<insCombos.length;k+=Math.max(1,Math.floor(insCombos.length/60))){
     const ins=insCombos[k].map(i=>candidates[i]);
     const pred=ins.reduce((s,x)=>s+x.pred,0)-outs.reduce((s,x)=>s+x.pred,0);
     if(pred<=0)continue;
     const actual=ins.reduce((s,x)=>s+x.y,0)-outs.reduce((s,x)=>s+x.y,0);
     add(bins.get(edgeBin(pred))!,pred,actual);sampled++;
    }
   }
  }
  console.log('\nPACKAGE SIZE '+size);
  console.table([...bins.entries()].map(([name,b])=>out(name,b)));
  console.log('sampled',sampled);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
