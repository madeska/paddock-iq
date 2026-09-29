const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
  PositionName?:string;
  PlayerId?:string|number;
  GamedayPoints?:string|number|null;
};

async function fetchRound(round:number){
  const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Paddock-IQ constructor grid'}});
  if(!r.ok)throw Error('Round '+round+' failed '+r.status);
  const j=await r.json() as any;
  return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const ewma=(h:number[],alpha:number)=>{
  if(!h.length)return 0;
  let v=h[0];
  for(const x of h.slice(1))v=alpha*x+(1-alpha)*v;
  return v;
};

type Ex={round:number;key:string;y:number;history:number[]};
type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({
  n:m.n,
  MAE:+(m.ae/m.n).toFixed(3),
  RMSE:+Math.sqrt(m.sq/m.n).toFixed(3),
  Bias:+(m.bias/m.n).toFixed(3)
});

async function main(){
  const feeds=new Map<number,Row[]>();
  for(let r=1;r<=15;r++)feeds.set(r,await fetchRound(r));

  const hist=new Map<string,number[]>();
  const examples:Ex[]=[];
  for(let round=1;round<=15;round++){
    for(const row of feeds.get(round)!.filter(r=>r.PositionName==='CONSTRUCTOR')){
      if(row.PlayerId==null)continue;
      const key=String(row.PlayerId);
      const y=Number(row.GamedayPoints);
      if(!Number.isFinite(y))continue;
      const h=hist.get(key)??[];
      if(h.length>=2)examples.push({round,key,y,history:[...h]});
      h.push(y);hist.set(key,h);
    }
  }

  const alphas=[.05,.1,.15,.2,.25,.3,.35,.4,.45,.5,.6];
  const seasonWeights=[0,.1,.2,.3,.4,.5];
  const floors=[-10,-5,0];
  const rows:{name:string;alpha:number;seasonWeight:number;floor:number;m:M}[]=[];

  for(const alpha of alphas)for(const seasonWeight of seasonWeights)for(const floor of floors){
    rows.push({
      name:'a'+alpha.toFixed(2)+'_s'+seasonWeight.toFixed(1)+'_f'+floor,
      alpha,seasonWeight,floor,m:init()
    });
  }

  const baseline=init();

  for(let round=6;round<=15;round++){
    for(const e of examples.filter(e=>e.round===round)){
      const b=Math.max(-5,ewma(e.history,.25));
      add(baseline,b-e.y);

      const season=mean(e.history);
      for(const row of rows){
        const ewm=ewma(e.history,row.alpha);
        const raw=(1-row.seasonWeight)*ewm+row.seasonWeight*season;
        const p=Math.max(row.floor,raw);
        add(row.m,p-e.y);
      }
    }
  }

  const ranked=rows
    .map(r=>({model:r.name,alpha:r.alpha,seasonWeight:r.seasonWeight,floor:r.floor,...fmt(r.m)}))
    .sort((a,b)=>a.MAE-b.MAE||a.RMSE-b.RMSE);

  console.log('\nBASELINE');
  console.table([{model:'ewma025_floor-5',...fmt(baseline)}]);

  console.log('\nCONSTRUCTOR SIMPLE GRID — TOP 20');
  console.table(ranked.slice(0,20));

  console.log('\nBEST BY ALPHA');
  const bestByAlpha=alphas.map(alpha=>ranked.filter(r=>r.alpha===alpha)[0]);
  console.table(bestByAlpha);
}

main().catch(e=>{console.error(e);process.exitCode=1});
