const FANTASY='https://fantasy.formula1.com/feeds/drivers';
const OPEN='https://api.openf1.org/v1';

type FantasyRow={PositionName?:string;DriverTLA?:string;TeamId?:string|number;PlayerId?:string|number;TeamName?:string;FUllName?:string;DisplayName?:string;GamedayPoints?:string|number|null;Value?:string|number|null};
type Session={meeting_key:number;session_key:number;session_name:string;session_type:string;date_start:string;date_end:string};
type Driver={driver_number:number;name_acronym:string;team_name?:string};
type Result={driver_number:number;position:number};

const TEAM:Record<string,string>={
 'MCLAREN':'MCL','RED BULL RACING':'RBR','RED BULL':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS F1 TEAM':'HAS','HAAS':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'
};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const ewma=(h:number[],a=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=a*v+(1-a)*x;return x};

async function get<T>(url:string):Promise<T|null>{
 for(let attempt=0;attempt<5;attempt++){
  const r=await fetch(url,{headers:{'user-agent':'Paddock-IQ constructor backtest'}});
  if(r.ok)return r.json() as Promise<T>;
  if(r.status===404)return null;
  if(r.status===429||r.status>=500){await new Promise(res=>setTimeout(res,900*(attempt+1)));continue;}
  throw Error(url+' -> '+r.status+' '+await r.text());
 }
 return null;
}
async function fantasy(round:number){
 const j=await get<any>(FANTASY+'/'+round+'_en.json?buster='+Date.now());
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as FantasyRow[];
}
function constructorCode(r:FantasyRow){
 const n=String(r.TeamName??r.FUllName??r.DisplayName??'').toUpperCase();
 return TEAM[n]??null;
}
type Weekend={avgPos:number;bestPos:number;worstPos:number;spread:number;isSprint:number};
type Ex={round:number;team:string;y:number;price:number;history:number[];weekend:Weekend};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(3),RMSE:+Math.sqrt(m.sq/m.n).toFixed(3),Bias:+(m.bias/m.n).toFixed(3)});

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
 for(let j=0;j<d;j++){
  const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);
  const m=means[j],sd=Math.sqrt(vals.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,vals.length-1));
  sds[j]=sd>1e-8?sd:1;
 }
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b);if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}
const base=(h:number[])=>Math.max(-5,ewma(h)??0);

async function main(){
 const feeds=new Map<number,FantasyRow[]>();
 for(let r=1;r<=15;r++)feeds.set(r,(await fantasy(r))??[]);

 const sessions=(await get<Session[]>(OPEN+'/sessions?year=2026'))??[];
 const groups=new Map<number,Session[]>();
 for(const s of sessions){const a=groups.get(s.meeting_key)??[];a.push(s);groups.set(s.meeting_key,a)}
 const meetings=[...groups.entries()]
  .filter(([,ss])=>ss.some(s=>s.session_name==='Race'))
  .sort((a,b)=>+new Date(a[1].find(s=>s.session_name==='Race')!.date_start)-+new Date(b[1].find(s=>s.session_name==='Race')!.date_start))
  .slice(0,15);

 const weekendByRound=new Map<number,Map<string,Weekend>>();
 for(let i=0;i<meetings.length;i++){
  const round=i+1,[meetingKey,ss]=meetings[i];
  const isSprint=ss.some(s=>(s.session_name||'').toLowerCase().includes('sprint')||(s.session_type||'').toLowerCase().includes('sprint'));
  const practices=ss.filter(s=>{
   const n=(s.session_name||'').toLowerCase(),t=(s.session_type||'').toLowerCase();
   return n.startsWith('practice')||t==='practice';
  }).sort((a,b)=>+new Date(b.date_start)-+new Date(a.date_start));

  let chosen:Session|null=null,results:Result[]|null=null;
  for(const p of practices){
   const r=await get<Result[]>(OPEN+'/session_result?session_key='+p.session_key);
   if(r?.length){chosen=p;results=r;break}
  }
  if(!chosen||!results){console.log('round',round,'skip practice');continue}

  let drivers=await get<Driver[]>(OPEN+'/drivers?meeting_key='+meetingKey);
  if(!drivers?.length)drivers=await get<Driver[]>(OPEN+'/drivers?session_key='+chosen.session_key);
  if(!drivers?.length)continue;

  // Official Fantasy linkage: driver.TeamId matches constructor.PlayerId.
  const constructorByPlayerId=new Map<string,string>();
  for(const fr of feeds.get(round)!.filter(x=>x.PositionName==='CONSTRUCTOR')){
    const team=constructorCode(fr);
    if(team&&fr.PlayerId!=null)constructorByPlayerId.set(String(fr.PlayerId),team);
  }
  const fantasyDriverTeam=new Map<string,string>();
  for(const fr of feeds.get(round)!.filter(x=>x.PositionName==='DRIVER')){
    const code=String(fr.DriverTLA??'').toUpperCase();
    const team=fr.TeamId!=null?constructorByPlayerId.get(String(fr.TeamId)):null;
    if(code&&team)fantasyDriverTeam.set(code,team);
  }
  const codeByNum=new Map(drivers.map(d=>[d.driver_number,String(d.name_acronym??'').toUpperCase()]));

  const posByTeam=new Map<string,number[]>();
  for(const r of results){
   const driverCode=codeByNum.get(r.driver_number);
   const t=driverCode?fantasyDriverTeam.get(driverCode):null;
   if(!t||!Number.isFinite(r.position))continue;
   const a=posByTeam.get(t)??[];a.push(r.position);posByTeam.set(t,a);
  }
  const out=new Map<string,Weekend>();
  for(const [team,pos] of posByTeam){
   if(pos.length<2)continue;
   pos.sort((a,b)=>a-b);
   out.set(team,{avgPos:mean(pos),bestPos:pos[0],worstPos:pos.at(-1)!,spread:pos.at(-1)!-pos[0],isSprint:isSprint?1:0});
  }
  weekendByRound.set(round,out);
  console.log('round',round,'teams',out.size,'practice',chosen.session_name,'sprint',isSprint);
 }

 const hist=new Map<string,number[]>();
 const examples:Ex[]=[];
 for(let round=1;round<=15;round++){
  for(const r of feeds.get(round)!.filter(x=>x.PositionName==='CONSTRUCTOR')){
   const team=constructorCode(r),y=Number(r.GamedayPoints),price=Number(r.Value);
   if(!team||!Number.isFinite(y)||!Number.isFinite(price))continue;
   const h=hist.get(team)??[],w=weekendByRound.get(round)?.get(team);
   if(h.length>=2&&w)examples.push({round,team,y,price,history:[...h],weekend:w});
   h.push(y);hist.set(team,h);
  }
 }

 const defs=[
  {name:'baseline',kind:'baseline',lambda:0},
  {name:'avgpos_l10',kind:'avg',lambda:10},
  {name:'avgpos_l25',kind:'avg',lambda:25},
  {name:'avgpos_l50',kind:'avg',lambda:50},
  {name:'bothpos_l25',kind:'both',lambda:25},
  {name:'bothpos_l50',kind:'both',lambda:50},
  {name:'full_l25',kind:'full',lambda:25},
  {name:'full_l50',kind:'full',lambda:50},
 ] as const;
 const metrics=new Map(defs.map(d=>[d.name,init()]));
 const normal=new Map(defs.map(d=>[d.name,init()]));
 const sprint=new Map(defs.map(d=>[d.name,init()]));

 const feat=(e:Ex,kind:string)=>{
  const basef=[ewma(e.history)??0,mean(e.history),e.price];
  if(kind==='avg')return [...basef,e.weekend.avgPos];
  if(kind==='both')return [...basef,e.weekend.bestPos,e.weekend.worstPos];
  if(kind==='full')return [...basef,e.weekend.avgPos,e.weekend.bestPos,e.weekend.worstPos,e.weekend.spread];
  return basef;
 };

 for(let round=6;round<=15;round++){
  const train=examples.filter(e=>e.round<round),test=examples.filter(e=>e.round===round);
  for(const d of defs){
   let model:any=null;
   if(d.kind!=='baseline')model=fitRidge(train.map(e=>({x:feat(e,d.kind),y:e.y})),d.lambda);
   for(const e of test){
    const p=d.kind==='baseline'?base(e.history):(model?.predict(feat(e,d.kind))??base(e.history));
    const err=p-e.y;add(metrics.get(d.name)!,err);add((e.weekend.isSprint?sprint:normal).get(d.name)!,err);
   }
  }
 }

 const table=(m:Map<string,M>)=>defs.map(d=>({model:d.name,...fmt(m.get(d.name)!)})).sort((a,b)=>a.MAE-b.MAE);
 console.log('\nCONSTRUCTOR WEEKEND-AWARE');console.table(table(metrics));
 console.log('\nNORMAL');console.table(table(normal));
 console.log('\nSPRINT');console.table(table(sprint));
}
main().catch(e=>{console.error(e);process.exitCode=1});
