import { AssetType, PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const prisma=new PrismaClient();
const SEASON=2026;
const BASE='https://fantasy.formula1.com/feeds/drivers';

type Row={
 PlayerId?:string|number;
 PositionName?:string;
 DriverTLA?:string;
 TeamId?:string|number;
 TeamName?:string;
 FUllName?:string;
 DisplayName?:string;
 Value?:string|number|null;
 GamedayPoints?:string|number|null;
};

const C:Record<string,string>={
 'MCLAREN':'MCL','RED BULL':'RBR','RED BULL RACING':'RBR','FERRARI':'FER','MERCEDES':'MER',
 'ASTON MARTIN':'AST','ALPINE':'ALP','HAAS':'HAS','HAAS F1 TEAM':'HAS','WILLIAMS':'WIL',
 'RACING BULLS':'RB','RB':'RB','AUDI':'AUD','AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD','CADILLAC FORMULA 1 TEAM':'CAD'
};

function constructorCode(name:unknown){
 return C[String(name??'').trim().toUpperCase()]??null;
}

async function fetchRound(round:number){
 const r=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(!r.ok)throw new Error('Round '+round+' failed: '+r.status);
 const j=await r.json() as any;
 const rows=Array.isArray(j?.Data?.Value)?j.Data.Value as Row[]:[];
 return {round,rows};
}

async function main(){
 const feeds=await Promise.all(Array.from({length:16},(_,i)=>fetchRound(i+1)));

 const assets=await prisma.asset.findMany({where:{season:SEASON}});
 const byKey=new Map(assets.map(a=>[a.type+':'+a.code,a]));

 const gps=await prisma.grandPrix.findMany({where:{season:SEASON,round:{in:feeds.map(f=>f.round)}}});
 const gpByRound=new Map(gps.map(g=>[g.round,g]));

 const rowsToCreate:{assetId:string;grandPrixId:string;price:number;source:string}[]=[];

 for(const feed of feeds){
  const gp=gpByRound.get(feed.round);
  if(!gp)continue;

  const teamMap=new Map<string,string>();
  for(const row of feed.rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const code=constructorCode(row.TeamName);
   if(code)teamMap.set(String(row.TeamId),code);
  }

  for(const row of feed.rows){
   const price=Number(row.Value);
   if(!Number.isFinite(price)||price<=0)continue;

   let type:AssetType;
   let code:string|null=null;

   if(row.PositionName==='DRIVER'){
    type=AssetType.DRIVER;
    code=String(row.DriverTLA??'').trim().toUpperCase()||null;
   }else if(row.PositionName==='CONSTRUCTOR'){
    type=AssetType.CONSTRUCTOR;
    code=teamMap.get(String(row.PlayerId??''))??
      constructorCode(row.TeamName)??constructorCode(row.FUllName)??constructorCode(row.DisplayName);
   }else continue;

   if(!code)continue;
   const asset=byKey.get(type+':'+code);
   if(!asset)continue;

   rowsToCreate.push({
    assetId:asset.id,
    grandPrixId:gp.id,
    price,
    source:'Official F1 Fantasy historical price backfill'
   });
  }
 }

 const gpIds=[...new Set(rowsToCreate.map(r=>r.grandPrixId))];
 await prisma.$transaction([
  prisma.priceHistory.deleteMany({
   where:{
    grandPrixId:{in:gpIds},
    source:'Official F1 Fantasy historical price backfill'
   }
  }),
  prisma.priceHistory.createMany({data:rowsToCreate})
 ]);

 console.log(JSON.stringify({
  ok:true,
  feeds:feeds.length,
  prices:rowsToCreate.length,
  source:'Official F1 Fantasy round feeds'
 },null,2));
}

main()
 .catch(e=>{console.error(e);process.exitCode=1})
 .finally(async()=>{await prisma.$disconnect()});
