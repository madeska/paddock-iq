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

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(h:number[],a=.25)=>{if(!h.length)return 0;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};

function constructorCode(row:Row,driverTeamMap:Map<string,string>){
 const n=String(row.TeamName??row.FUllName??row.DisplayName??'').toUpperCase();
 return driverTeamMap.get(String(row.PlayerId??''))??C[n]??null;
}
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

function fitRidge(rows:{x:number[];y:number}[],lambda:number){
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

function ownFeatures(h:number[],price:number){
 return [ewma(h),mean(h),h.at(-1)??0,mean(h.slice(-2)),mean(h.slice(-3)),std(h.slice(-5)),price];
}
function driverFormFeatures(histories:number[][]){
 const hs=histories.filter(h=>h.length);
 if(!hs.length)return [0,0,0,0,0,0];
 const e=hs.map(ewma);
 const s=hs.map(mean);
 const last=hs.map(h=>h.at(-1)??0);
 return [e.reduce((a,b)=>a+b,0),mean(e),s.reduce((a,b)=>a+b,0),mean(s),last.reduce((a,b)=>a+b,0),mean(last)];
}

type Ex={round:number;team:string;y:number;price:number;own:number[];drivers:number[][]};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(2),RMSE:+Math.sqrt(m.sq/m.n).toFixed(2),Bias:+(m.bias/m.n).toFixed(2)});

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

 const constructorHist=new Map<string,number[]>();
 const driverHist=new Map<string,number[]>();
 const teamDrivers=new Map<string,string[]>();
 const examples:Ex[]=[];

 for(let round=1;round<=15;round++){
  const rows=feeds.get(round)!;
  const teamMap=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const team=C[String(row.TeamName??'').toUpperCase()];
   if(!team)continue;
   teamMap.set(String(row.TeamId),team);
   const code=String(row.DriverTLA??'').toUpperCase();
   if(code){
    const list=teamDrivers.get(team)??[];
    if(!list.includes(code))teamDrivers.set(team,[...list,code]);
   }
  }

  for(const row of rows.filter(r=>r.PositionName==='CONSTRUCTOR')){
   const team=constructorCode(row,teamMap);if(!team)continue;
   const y=Number(row.GamedayPoints),price=Number(row.Value);
   if(!Number.isFinite(y)||!Number.isFinite(price))continue;
   const own=constructorHist.get(team)??[];
   const drivers=(teamDrivers.get(team)??[]).map(code=>driverHist.get(code)??[]);
   if(own.length>=2&&drivers.some(h=>h.length>=2))examples.push({round,team,y,price,own:[...own],drivers:drivers.map(h=>[...h])});
  }

  for(const row of rows){
   const y=Number(row.GamedayPoints);if(!Number.isFinite(y))continue;
   if(row.PositionName==='DRIVER'){
    const code=String(row.DriverTLA??'').toUpperCase();if(!code)continue;
    const h=driverHist.get(code)??[];h.push(y);driverHist.set(code,h);
   }else if(row.PositionName==='CONSTRUCTOR'){
    const team=constructorCode(row,teamMap);if(!team)continue;
    const h=constructorHist.get(team)??[];h.push(y);constructorHist.set(team,h);
   }
  }
 }

 const lambdas=[1,10,50,100,250];
 const names=['hybrid',...lambdas.map(l=>'ridge_own_'+l),...lambdas.map(l=>'ridge_driverform_'+l)];
 const metrics=new Map(names.map(n=>[n,init()]));

 for(let round=6;round<=15;round++){
  const train=examples.filter(e=>e.round<round);
  const test=examples.filter(e=>e.round===round);
  if(train.length<20||!test.length)continue;

  const ownModels=new Map(lambdas.map(l=>[l,fitRidge(train.map(e=>({x:ownFeatures(e.own,e.price),y:e.y})),l)]));
  const driverModels=new Map(lambdas.map(l=>[l,fitRidge(train.map(e=>({x:[...ownFeatures(e.own,e.price),...driverFormFeatures(e.drivers)],y:e.y})),l)]));

  for(const e of test){
   const preds:[string,number][]=[['hybrid',Math.max(-5,ewma(e.own))]];
   for(const l of lambdas){
    const a=ownModels.get(l);if(a)preds.push(['ridge_own_'+l,a.predict(ownFeatures(e.own,e.price))]);
    const b=driverModels.get(l);if(b)preds.push(['ridge_driverform_'+l,b.predict([...ownFeatures(e.own,e.price),...driverFormFeatures(e.drivers)])]);
   }
   for(const [name,p] of preds)add(metrics.get(name)!,p-e.y);
  }
 }

 console.log('\nCONSTRUCTOR WALK-FORWARD');
 console.table(names.map(name=>({model:name,...fmt(metrics.get(name)!)})).sort((a,b)=>a.MAE-b.MAE));
}

main().catch(e=>{console.error(e);process.exitCode=1});
