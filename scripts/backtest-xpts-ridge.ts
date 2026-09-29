const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;DriverTLA?:string;TeamId?:string|number;TeamName?:string;
 FUllName?:string;DisplayName?:string;PlayerId?:string|number;
 GamedayPoints?:string|number|null;Value?:string|number|null
};
type Example={round:number;type:'DRIVER'|'CONSTRUCTOR';key:string;y:number;x:number[];hybrid:number};

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
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
const std=(a:number[])=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
const ewma=(h:number[],alpha=.25)=>{let x=h[0];for(const v of h.slice(1))x=alpha*v+(1-alpha)*x;return x};
const hybrid=(type:string,h:number[])=>{
 const e=ewma(h);
 if(type==='DRIVER')return .7*e+.3*mean(h);
 return Math.max(-5,e);
};

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

function fitRidge(rows:Example[],lambda:number){
 const d=rows[0].x.length;
 const means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);const s=std(vals);sds[j]=s>1e-8?s:1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]);
 const p=d+1,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
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
 const hist=new Map<string,number[]>();
 const examples:Example[]=[];

 for(let round=1;round<=15;round++){
  const rows=feeds.get(round)!;
  const tm=new Map<string,string>();
  for(const r of rows)if(r.PositionName==='DRIVER'&&r.TeamId!=null){const c=C[String(r.TeamName??'').toUpperCase()];if(c)tm.set(String(r.TeamId),c)}

  for(const r of rows){
   const key=keyFor(r,tm);if(!key)continue;
   const y=Number(r.GamedayPoints),price=Number(r.Value);
   if(!Number.isFinite(y)||!Number.isFinite(price))continue;
   const h=hist.get(key)??[];
   if(h.length>=2){
    const type=(key.startsWith('DRIVER:')?'DRIVER':'CONSTRUCTOR') as 'DRIVER'|'CONSTRUCTOR';
    const last=h[h.length-1],m2=mean(h.slice(-2)),m3=mean(h.slice(-3)),e=ewma(h),season=mean(h),v5=std(h.slice(-5));
    examples.push({round,type,key,y,x:[e,season,last,m2,m3,v5,price],hybrid:hybrid(type,h)});
   }
   h.push(y);hist.set(key,h);
  }
 }

 const lambdas=[0.1,1,10,50,100];
 const names=['hybrid',...lambdas.map(x=>'ridge_'+x)];
 const metrics=new Map(names.map(n=>[n,init()]));
 const perType=new Map(names.map(n=>[n,new Map<string,M>()]));

 for(let round=6;round<=15;round++){
  for(const type of ['DRIVER','CONSTRUCTOR'] as const){
   const train=examples.filter(e=>e.type===type&&e.round<round);
   const test=examples.filter(e=>e.type===type&&e.round===round);
   if(train.length<20||!test.length)continue;

   const models=new Map<number,ReturnType<typeof fitRidge>>();
   for(const l of lambdas)models.set(l,fitRidge(train,l));

   for(const ex of test){
    const preds:[string,number][]=[['hybrid',ex.hybrid]];
    for(const l of lambdas){const m=models.get(l);if(m)preds.push(['ridge_'+l,m.predict(ex.x)])}
    for(const [name,p] of preds){
     const e=p-ex.y;add(metrics.get(name)!,e);
     const map=perType.get(name)!;const mt=map.get(type)??init();add(mt,e);map.set(type,mt);
    }
   }
  }
 }

 const table=(type?:string)=>names.map(name=>{
  const m=type?perType.get(name)!.get(type)!:metrics.get(name)!;
  return {model:name,...fmt(m)};
 }).sort((a,b)=>a.MAE-b.MAE);

 console.log('\nFEATURES: ewma025, seasonMean, last1, mean2, mean3, std5, currentPrice');
 console.log('\nOVERALL');console.table(table());
 console.log('\nDRIVERS');console.table(table('DRIVER'));
 console.log('\nCONSTRUCTORS');console.table(table('CONSTRUCTOR'));
}

main().catch(e=>{console.error(e);process.exitCode=1});
