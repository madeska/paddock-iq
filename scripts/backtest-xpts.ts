const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PositionName?:string;
 DriverTLA?:string;
 TeamId?:string|number;
 TeamName?:string;
 FUllName?:string;
 DisplayName?:string;
 PlayerId?:string|number;
 GamedayPoints?:string|number|null;
};

const CONSTRUCTOR_CODES:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'
};

function keyFor(row:Row,teamMap:Map<string,string>){
 if(row.PositionName==='DRIVER')return 'DRIVER:'+String(row.DriverTLA??'').toUpperCase();
 if(row.PositionName==='CONSTRUCTOR'){
  const name=String(row.TeamName??row.FUllName??row.DisplayName??'').toUpperCase();
  const code=teamMap.get(String(row.PlayerId??''))??CONSTRUCTOR_CODES[name];
  return code?'CONSTRUCTOR:'+code:null;
 }
 return null;
}

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(!r.ok)throw new Error('Round '+round+' failed: '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const weighted=(xs:number[],ws:number[])=>xs.reduce((s,x,i)=>s+x*ws[i],0)/ws.slice(0,xs.length).reduce((a,b)=>a+b,0);

type Pred={name:string;fn:(h:number[])=>number|null};
const models:Pred[]=[
 {name:'last1',fn:h=>h.length?h[h.length-1]:null},
 {name:'mean2',fn:h=>h.length>=2?mean(h.slice(-2)):null},
 {name:'mean3',fn:h=>h.length>=3?mean(h.slice(-3)):null},
 {name:'mean5',fn:h=>h.length>=5?mean(h.slice(-5)):null},
 {name:'median3',fn:h=>h.length>=3?median(h.slice(-3)):null},
 {name:'weighted3',fn:h=>h.length>=3?weighted(h.slice(-3).reverse(),[1,.7,.5]):null},
 {name:'weighted5',fn:h=>h.length>=5?weighted(h.slice(-5).reverse(),[1,.82,.67,.55,.45]):null},
];

async function main(){
 const history=new Map<string,number[]>();
 const metrics=new Map<string,{n:number;ae:number;sq:number;bias:number}>();
 const perType=new Map<string,Map<string,{n:number;ae:number;sq:number;bias:number}>>();
 for(const m of models){metrics.set(m.name,{n:0,ae:0,sq:0,bias:0});perType.set(m.name,new Map())}

 for(let round=1;round<=15;round++){
  const rows=await fetchRound(round);
  const teamMap=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const c=CONSTRUCTOR_CODES[String(row.TeamName??'').toUpperCase()];
   if(c)teamMap.set(String(row.TeamId),c);
  }

  for(const row of rows){
   const key=keyFor(row,teamMap);
   if(!key)continue;
   const actual=Number(row.GamedayPoints);
   if(!Number.isFinite(actual))continue;
   const h=history.get(key)??[];

   for(const model of models){
    const pred=model.fn(h);
    if(pred==null||!Number.isFinite(pred))continue;
    const e=pred-actual;
    const all=metrics.get(model.name)!;
    all.n++;all.ae+=Math.abs(e);all.sq+=e*e;all.bias+=e;

    const type=key.startsWith('DRIVER:')?'DRIVER':'CONSTRUCTOR';
    const map=perType.get(model.name)!;
    const mt=map.get(type)??{n:0,ae:0,sq:0,bias:0};
    mt.n++;mt.ae+=Math.abs(e);mt.sq+=e*e;mt.bias+=e;map.set(type,mt);
   }

   h.push(actual);
   history.set(key,h);
  }
 }

 const fmt=(x:{n:number;ae:number;sq:number;bias:number})=>({
  n:x.n,
  MAE:+(x.ae/x.n).toFixed(2),
  RMSE:+Math.sqrt(x.sq/x.n).toFixed(2),
  Bias:+(x.bias/x.n).toFixed(2),
 });

 console.log('\nOVERALL');
 console.table(models.map(m=>({model:m.name,...fmt(metrics.get(m.name)!)})).sort((a,b)=>a.MAE-b.MAE));

 console.log('\nDRIVERS');
 console.table(models.map(m=>({model:m.name,...fmt(perType.get(m.name)!.get('DRIVER')!)})).sort((a,b)=>a.MAE-b.MAE));

 console.log('\nCONSTRUCTORS');
 console.table(models.map(m=>({model:m.name,...fmt(perType.get(m.name)!.get('CONSTRUCTOR')!)})).sort((a,b)=>a.MAE-b.MAE));
}

main().catch(error=>{console.error(error);process.exitCode=1});
