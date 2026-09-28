const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={PositionName?:string;DriverTLA?:string;TeamId?:string|number;TeamName?:string;FUllName?:string;DisplayName?:string;PlayerId?:string|number;GamedayPoints?:string|number|null};

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
const median=(a:number[])=>{const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const ewma=(h:number[],alpha=.25)=>{if(!h.length)return null;let x=h[0];for(const v of h.slice(1))x=alpha*v+(1-alpha)*x;return x};

type Model={name:string;pred:(h:number[])=>number|null};
const models:Model[]=[
 {name:'ewma025',pred:h=>h.length>=5?ewma(h):null},
 {name:'ewma025_clip0',pred:h=>h.length>=5?Math.max(0,ewma(h)!):null},
 {name:'ewma025_clip_minus5',pred:h=>h.length>=5?Math.max(-5,ewma(h)!):null},
 {name:'ewma_season_90_10',pred:h=>h.length>=5?.9*ewma(h)!+.1*mean(h):null},
 {name:'ewma_season_80_20',pred:h=>h.length>=5?.8*ewma(h)!+.2*mean(h):null},
 {name:'ewma_season_70_30',pred:h=>h.length>=5?.7*ewma(h)!+.3*mean(h):null},
 {name:'ewma_median5_90_10',pred:h=>h.length>=5?.9*ewma(h)!+.1*median(h.slice(-5)):null},
 {name:'ewma_median5_80_20',pred:h=>h.length>=5?.8*ewma(h)!+.2*median(h.slice(-5)):null},
 {name:'ewma_median5_70_30',pred:h=>h.length>=5?.7*ewma(h)!+.3*median(h.slice(-5)):null},
];

type M={n:number;ae:number;sq:number;bias:number};
const init=():M=>({n:0,ae:0,sq:0,bias:0});
const add=(m:M,e:number)=>{m.n++;m.ae+=Math.abs(e);m.sq+=e*e;m.bias+=e};
const fmt=(m:M)=>({n:m.n,MAE:+(m.ae/m.n).toFixed(2),RMSE:+Math.sqrt(m.sq/m.n).toFixed(2),Bias:+(m.bias/m.n).toFixed(2)});

async function main(){
 const hist=new Map<string,number[]>();
 const all=new Map(models.map(m=>[m.name,init()]));
 const perType=new Map(models.map(m=>[m.name,new Map<string,M>()]));

 for(let round=1;round<=15;round++){
  const rows=await fetchRound(round);
  const teamMap=new Map<string,string>();
  for(const r of rows)if(r.PositionName==='DRIVER'&&r.TeamId!=null){const c=C[String(r.TeamName??'').toUpperCase()];if(c)teamMap.set(String(r.TeamId),c)}

  for(const r of rows){
   const key=keyFor(r,teamMap);if(!key)continue;
   const actual=Number(r.GamedayPoints);if(!Number.isFinite(actual))continue;
   const h=hist.get(key)??[];
   for(const model of models){
    const p=model.pred(h);if(p==null||!Number.isFinite(p))continue;
    const e=p-actual;add(all.get(model.name)!,e);
    const type=key.startsWith('DRIVER:')?'DRIVER':'CONSTRUCTOR';
    const map=perType.get(model.name)!;const mt=map.get(type)??init();add(mt,e);map.set(type,mt);
   }
   h.push(actual);hist.set(key,h);
  }
 }

 const table=(type?:string)=>models.map(model=>{
  const m=type?perType.get(model.name)!.get(type)!:all.get(model.name)!;
  return {model:model.name,...fmt(m)};
 }).sort((a,b)=>a.MAE-b.MAE);

 console.log('\nOVERALL');console.table(table());
 console.log('\nDRIVERS');console.table(table('DRIVER'));
 console.log('\nCONSTRUCTORS');console.table(table('CONSTRUCTOR'));
}
main().catch(e=>{console.error(e);process.exitCode=1});
