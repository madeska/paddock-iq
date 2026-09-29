const BASE='https://fantasy.formula1.com/feeds/drivers';
const SPRINT_ROUNDS=new Set([2,4,5,9,12]);

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
const ewma=(h:number[],alpha=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=alpha*v+(1-alpha)*x;return x};
const constructorBaseline=(h:number[])=>Math.max(-5,ewma(h)??0);

function features(h:number[],price:number){
 const e=ewma(h)??0;
 const s=mean(h);
 const last=h.at(-1)??s;
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

type Ex={round:number;type:'DRIVER'|'CONSTRUCTOR';key:string;y:number;price:number;history:number[]};
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
  const rows=feeds.get(round)!;
  const tm=new Map<string,string>();
  for(const r of rows)if(r.PositionName==='DRIVER'&&r.TeamId!=null){const c=C[String(r.TeamName??'').toUpperCase()];if(c)tm.set(String(r.TeamId),c)}
  for(const r of rows){
   const key=keyFor(r,tm);if(!key)continue;
   const y=Number(r.GamedayPoints),price=Number(r.Value);if(!Number.isFinite(y)||!Number.isFinite(price))continue;
   const h=hist.get(key)??[];
   if(h.length>=2)examples.push({round,type:key.startsWith('DRIVER:')?'DRIVER':'CONSTRUCTOR',key,y,price,history:[...h]});
   h.push(y);hist.set(key,h);
  }
 }

 const baseline=init(), corrected=init(), sprintBaseline=init(), sprintCorrected=init();
 const learned:{round:number;driverCorrection:number;constructorCorrection:number;driverN:number;constructorN:number}[]=[];

 for(let round=6;round<=15;round++){
  const prior=examples.filter(e=>e.round<round);
  const driverTrain=prior.filter(e=>e.type==='DRIVER').map(e=>({x:features(e.history,e.price),y:e.y}));
  const driverModel=fitRidge(driverTrain,50);

  const priorSprintResiduals={DRIVER:[] as number[],CONSTRUCTOR:[] as number[]};
  for(const e of prior.filter(e=>SPRINT_ROUNDS.has(e.round))){
   const pred=e.type==='DRIVER'
    ?(driverModel?.predict(features(e.history,e.price))??(.7*(ewma(e.history)??0)+.3*mean(e.history)))
    :constructorBaseline(e.history);
   priorSprintResiduals[e.type].push(e.y-pred);
  }

  const correction={
   DRIVER:priorSprintResiduals.DRIVER.length?mean(priorSprintResiduals.DRIVER):0,
   CONSTRUCTOR:priorSprintResiduals.CONSTRUCTOR.length?mean(priorSprintResiduals.CONSTRUCTOR):0
  };
  learned.push({round,driverCorrection:+correction.DRIVER.toFixed(2),constructorCorrection:+correction.CONSTRUCTOR.toFixed(2),driverN:priorSprintResiduals.DRIVER.length,constructorN:priorSprintResiduals.CONSTRUCTOR.length});

  for(const e of examples.filter(e=>e.round===round)){
   const pred=e.type==='DRIVER'
    ?(driverModel?.predict(features(e.history,e.price))??(.7*(ewma(e.history)??0)+.3*mean(e.history)))
    :constructorBaseline(e.history);
   const pred2=pred+(SPRINT_ROUNDS.has(round)?correction[e.type]:0);
   add(baseline,pred-e.y);add(corrected,pred2-e.y);
   if(SPRINT_ROUNDS.has(round)){add(sprintBaseline,pred-e.y);add(sprintCorrected,pred2-e.y)}
  }
 }

 console.log('SPRINT ROUNDS:',[...SPRINT_ROUNDS].join(', '));
 console.log('\nLEARNED WALK-FORWARD CORRECTIONS');
 console.table(learned);
 console.log('\nALL TEST ROUNDS');
 console.table([{model:'baseline',...fmt(baseline)},{model:'sprint-aware',...fmt(corrected)}]);
 console.log('\nSPRINT TEST ROUNDS ONLY');
 console.table([{model:'baseline',...fmt(sprintBaseline)},{model:'sprint-aware',...fmt(sprintCorrected)}]);
}
main().catch(e=>{console.error(e);process.exitCode=1});
