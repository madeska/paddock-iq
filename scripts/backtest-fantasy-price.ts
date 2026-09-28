const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PlayerId?:string|number;
 PositionName?:string;
 DriverTLA?:string;
 TeamId?:string|number;
 TeamName?:string;
 FUllName?:string;
 DisplayName?:string;
 GamedayPoints?:string|number|null;
 OldPlayerValue?:string|number|null;
 Value?:string|number|null;
};

type Obs={round:number;key:string;points:number;oldPrice:number;newPrice:number;actualDelta:number};

const CONSTRUCTOR_CODES:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'
};

const round2=(n:number)=>Math.round(n*100)/100;
const nameKey=(row:Row,teamMap:Map<string,string>)=>{
 if(row.PositionName==='DRIVER')return 'DRIVER:'+String(row.DriverTLA??'').toUpperCase();
 if(row.PositionName==='CONSTRUCTOR'){
  const code=teamMap.get(String(row.PlayerId??''))??
   CONSTRUCTOR_CODES[String(row.TeamName??row.FUllName??row.DisplayName??'').toUpperCase()];
  return code?'CONSTRUCTOR:'+code:null;
 }
 return null;
};

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(!r.ok)throw new Error('Round '+round+' failed: '+r.status);
 const j=await r.json() as any;
 return (Array.isArray(j?.Data?.Value)?j.Data.Value:[]) as Row[];
}

function expectedDelta(ppm:number,price:number){
 const tierA=price>=18.5;
 if(ppm<.6)return tierA?-.3:-.6;
 if(ppm<.9)return tierA?-.1:-.2;
 if(ppm<1.2)return tierA?.1:.2;
 return tierA?.3:.6;
}

async function main(){
 const history=new Map<string,Obs[]>();
 const evaluations:{round:number;key:string;ppm:number;oldPrice:number;actual:number;predicted:number;correct:boolean}[]=[];

 const feeds=new Map<number,Row[]>();
 for(let round=1;round<=16;round++)feeds.set(round,await fetchRound(round));

 for(let round=1;round<=15;round++){
  const rows=feeds.get(round)!;
  const teamMap=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const code=CONSTRUCTOR_CODES[String(row.TeamName??'').toUpperCase()];
   if(code)teamMap.set(String(row.TeamId),code);
  }

  for(const row of rows){
   const key=nameKey(row,teamMap);
   if(!key)continue;
   const points=Number(row.GamedayPoints),oldPrice=Number(row.OldPlayerValue),newPrice=Number(row.Value);
   if(!Number.isFinite(points)||!Number.isFinite(oldPrice)||!Number.isFinite(newPrice)||oldPrice<=0)continue;

   const obs:Obs={round,key,points,oldPrice,newPrice,actualDelta:0};
   const list=history.get(key)??[];
   list.push(obs);
   history.set(key,list);

   if(list.length<3)continue;
   const last3=list.slice(-3);
   if(last3[2].round!==round||last3[1].round!==round-1||last3[0].round!==round-2)continue;

   const nextRows=feeds.get(round+1)??[];
   const nextTeamMap=new Map<string,string>();
   for(const nextRow of nextRows){
    if(nextRow.PositionName!=='DRIVER'||nextRow.TeamId==null)continue;
    const c=CONSTRUCTOR_CODES[String(nextRow.TeamName??'').toUpperCase()];
    if(c)nextTeamMap.set(String(nextRow.TeamId),c);
   }
   const nextRow=nextRows.find(r=>nameKey(r,nextTeamMap)===key);
   const nextPrice=Number(nextRow?.Value);
   if(!Number.isFinite(nextPrice)||nextPrice<=0)continue;

   const currentPrice=newPrice;
   const actual=round2(nextPrice-currentPrice);
   const sum=last3.reduce((s,x)=>s+x.points,0);
   const ppm=sum/(3*currentPrice);
   let predicted=expectedDelta(ppm,currentPrice);
   if(currentPrice<=3&&predicted<0)predicted=0;

   evaluations.push({
    round,key,ppm,oldPrice:currentPrice,actual,predicted,
    correct:Math.abs(actual-predicted)<.01,
   });
  }
 }

 const byTier=(tier:'A'|'B')=>evaluations.filter(x=>tier==='A'?x.oldPrice>=18.5:x.oldPrice<18.5);
 const summarize=(rows:typeof evaluations)=>{
  const correct=rows.filter(x=>x.correct).length;
  return {n:rows.length,correct,accuracy:rows.length?round2(correct/rows.length*100):0};
 };

 console.log('OVERALL',summarize(evaluations));
 console.log('TIER A',summarize(byTier('A')));
 console.log('TIER B',summarize(byTier('B')));

 const mismatches=evaluations.filter(x=>!x.correct)
  .sort((a,b)=>Math.abs(b.actual-b.predicted)-Math.abs(a.actual-a.predicted))
  .slice(0,40)
  .map(x=>({...x,ppm:round2(x.ppm)}));

 console.log('\nTOP MISMATCHES');
 console.table(mismatches);

 const buckets=[-.6,-.3,-.2,-.1,.1,.2,.3,.6];
 console.log('\nACTUAL DELTA COUNTS');
 console.table(buckets.map(delta=>({delta,count:evaluations.filter(x=>Math.abs(x.actual-delta)<.01).length})));
}

main().catch(error=>{console.error(error);process.exitCode=1});
