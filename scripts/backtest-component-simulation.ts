import {simulateComponentWeekend} from '../src/lib/component-simulation';

const BASE='https://fantasy.formula1.com/feeds/drivers';
const TARGET_ROUNDS=[6,7,8,9,10,11,12,13,14,15,16];
const SPRINT_ROUNDS=new Set([2,4,5,9,12,17]);
const OVERTAKE_GRID=[1.2,1.8,2.4,3.0];
const BLEND_GRID=[0,.25,.5,.75,1];

type Row={
 PositionName?:string;
 DriverTLA?:string;
 TeamId?:string|number;
 TeamName?:string;
 PlayerId?:string|number;
 FUllName?:string;
 DisplayName?:string;
 GamedayPoints?:string|number|null;
 Value?:string|number|null;
};
type Hist={round:number;points:number;price:number};
type PredRow={round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';actual:number;baseline:number;component:number};

const TEAM_CODES:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD',
};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(xs:number[],a=.25)=>{if(!xs.length)return 0;let v=xs[0];for(const x of xs.slice(1))v=a*x+(1-a)*v;return v};
const rmse=(xs:number[])=>Math.sqrt(mean(xs.map(x=>x*x)));
const mae=(xs:number[])=>mean(xs.map(Math.abs));

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ component backtest'}});
 if(!r.ok)throw new Error('Round '+round+' failed: '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function constructorCode(row:Row,teamIdToCode:Map<string,string>){
 return teamIdToCode.get(String(row.PlayerId??''))??
  TEAM_CODES[String(row.TeamName??'').trim().toUpperCase()]??
  TEAM_CODES[String(row.FUllName??'').trim().toUpperCase()]??
  TEAM_CODES[String(row.DisplayName??'').trim().toUpperCase()]??null;
}

function ridgeFit(rows:{x:number[];y:number}[],lambda=50){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);sds[j]=std(vals)||1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<p;i++){
  let pivot=i;for(let j=i+1;j<p;j++)if(Math.abs(M[j][i])>Math.abs(M[pivot][i]))pivot=j;
  [M[i],M[pivot]]=[M[pivot],M[i]];const div=M[i][i];if(Math.abs(div)<1e-9)return null;
  for(let k=i;k<=p;k++)M[i][k]/=div;
  for(let j=0;j<p;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=p;k++)M[j][k]-=f*M[i][k]}
 }
 const beta=M.map(r=>r[p]);
 return (x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0);
}

function driverFeatures(history:number[],price:number){return [ewma(history),mean(history),price]}

async function main(){
 const feeds=new Map<number,Row[]>();
 for(let r=1;r<=16;r++)feeds.set(r,await fetchRound(r));

 const histories=new Map<string,Hist[]>();
 const typeByKey=new Map<string,'DRIVER'|'CONSTRUCTOR'>();
 const teamByDriverRound=new Map<string,string>();

 for(let round=1;round<=16;round++){
  const rows=feeds.get(round)!;
  const teamIdToCode=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const team=TEAM_CODES[String(row.TeamName??'').trim().toUpperCase()];
   if(team)teamIdToCode.set(String(row.TeamId),team);
  }
  for(const row of rows){
   let key:string|null=null,type:'DRIVER'|'CONSTRUCTOR'|null=null;
   if(row.PositionName==='DRIVER'){
    const code=String(row.DriverTLA??'').trim().toUpperCase();if(!code)continue;
    key='D:'+code;type='DRIVER';
    const team=TEAM_CODES[String(row.TeamName??'').trim().toUpperCase()];
    if(team)teamByDriverRound.set(round+':'+code,team);
   }else if(row.PositionName==='CONSTRUCTOR'){
    const code=constructorCode(row,teamIdToCode);if(!code)continue;
    key='C:'+code;type='CONSTRUCTOR';
   }
   if(!key||!type)continue;
   const points=Number(row.GamedayPoints),price=Number(row.Value);
   if(!Number.isFinite(points)||!Number.isFinite(price)||price<=0)continue;
   const h=histories.get(key)??[];h.push({round,points,price});histories.set(key,h);typeByKey.set(key,type);
  }
 }

 for(const overtakeIntensity of OVERTAKE_GRID){
  const predictions:PredRow[]=[];
  for(const target of TARGET_ROUNDS){
   const train:{x:number[];y:number}[]=[];
   for(const [key,h] of histories){
    if(typeByKey.get(key)!=='DRIVER')continue;
    for(let t=3;t<target;t++){
      const prior=h.filter(x=>x.round<t).sort((a,b)=>a.round-b.round),actual=h.find(x=>x.round===t);
      if(prior.length<2||!actual)continue;
      train.push({x:driverFeatures(prior.map(x=>x.points),actual.price),y:actual.points});
    }
   }
   const ridge=ridgeFit(train,50);

   const drivers:any[]=[];
   const constructors:any[]=[];
   const actualByKey=new Map<string,number>();
   const baselineByKey=new Map<string,number>();

   for(const [key,h] of histories){
    const actual=h.find(x=>x.round===target);if(!actual)continue;
    const prior=h.filter(x=>x.round<target).sort((a,b)=>a.round-b.round);if(prior.length<2)continue;
    const scores=prior.map(x=>x.points),type=typeByKey.get(key)!;
    let baseline:number;
    if(type==='DRIVER'){
      const e=ewma(scores),r=ridge?.(driverFeatures(scores,actual.price));
      baseline=r==null?e:.5*r+.5*e;
      const code=key.slice(2),team=teamByDriverRound.get(target+':'+code);
      if(!team)continue;
      drivers.push({code,team,baselineXPts:baseline,recentScores:scores.slice(-5)});
    }else{
      baseline=.5*ewma(scores)+.5*mean(scores.slice(-3));
      constructors.push({code:key.slice(2),baselineXPts:baseline});
    }
    actualByKey.set(key,actual.points);baselineByKey.set(key,baseline);
   }

   const completeTeams=new Set(constructors.map(c=>c.code));
   const filteredDrivers=drivers.filter(d=>completeTeams.has(d.team));
   const teamCounts=new Map<string,number>();
   for(const d of filteredDrivers)teamCounts.set(d.team,(teamCounts.get(d.team)??0)+1);
   const usableTeams=new Set([...teamCounts].filter(([,n])=>n>=2).map(([team])=>team));
   const usableDrivers=filteredDrivers.filter(d=>usableTeams.has(d.team));
   const usableConstructors=constructors.filter(c=>usableTeams.has(c.code));

   const sim=simulateComponentWeekend(usableDrivers,usableConstructors,{
    sprint:SPRINT_ROUNDS.has(target),
    simulations:1200,
    seed:202600+target,
    overtakeIntensity,
   });
   for(const d of sim.drivers){
    const key='D:'+d.code,actual=actualByKey.get(key),baseline=baselineByKey.get(key);
    if(actual==null||baseline==null)continue;
    predictions.push({round:target,code:d.code,type:'DRIVER',actual,baseline,component:d.total});
   }
   for(const c of sim.constructors){
    const key='C:'+c.code,actual=actualByKey.get(key),baseline=baselineByKey.get(key);
    if(actual==null||baseline==null)continue;
    predictions.push({round:target,code:c.code,type:'CONSTRUCTOR',actual,baseline,component:c.total});
   }
  }

  console.log('\nCOMPONENT SIMULATION GRID · overtakeIntensity='+overtakeIntensity);
  const out=[] as any[];
  for(const type of ['DRIVER','CONSTRUCTOR'] as const){
    const rows=predictions.filter(x=>x.type===type);
    for(const w of BLEND_GRID){
      const errors=rows.map(x=>((1-w)*x.baseline+w*x.component)-x.actual);
      out.push({type,componentWeight:w,n:rows.length,MAE:+mae(errors).toFixed(2),RMSE:+rmse(errors).toFixed(2),Bias:+mean(errors).toFixed(2)});
    }
  }
  console.table(out);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
