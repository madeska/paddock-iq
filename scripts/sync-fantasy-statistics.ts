import { AssetType, PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const prisma=new PrismaClient();
const SEASON=2026;
const BASE='https://fantasy.formula1.com/feeds/drivers';

type FeedRow={
 PlayerId?:string|number;
 PositionName?:string;
 DriverTLA?:string;
 TeamId?:string|number;
 TeamName?:string;
 FUllName?:string;
 DisplayName?:string;
 GamedayPoints?:string|number|null;
};

const CONSTRUCTOR_CODES:Record<string,string>={
 'MCLAREN':'MCL',
 'RED BULL':'RBR',
 'RED BULL RACING':'RBR',
 'FERRARI':'FER',
 'MERCEDES':'MER',
 'ASTON MARTIN':'AST',
 'ALPINE':'ALP',
 'HAAS':'HAS',
 'HAAS F1 TEAM':'HAS',
 'WILLIAMS':'WIL',
 'RACING BULLS':'RB',
 'RB':'RB',
 'AUDI':'AUD',
 'AUDI REVOLUT F1 TEAM':'AUD',
 'CADILLAC':'CAD',
 'CADILLAC FORMULA 1 TEAM':'CAD',
};

function constructorCode(name:unknown){
 const upper=String(name??'').trim().toUpperCase();
 return CONSTRUCTOR_CODES[upper]??null;
}

async function fetchRound(round:number){
 const url=BASE+'/'+round+'_en.json?buster='+Date.now();
 const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('Round '+round+' feed failed: HTTP '+response.status);
 const json=await response.json() as any;
 const rows=Array.isArray(json?.Data?.Value)?json.Data.Value as FeedRow[]:[];
 if(!rows.length)throw new Error('Round '+round+' feed returned no players');
 return rows;
}

async function main(){
 const assets=await prisma.asset.findMany({where:{season:SEASON}});
 const byKey=new Map(assets.map(a=>[a.type+':'+a.code,a]));
 let saved=0;
 const skipped=new Set<string>();
 const completedRounds:number[]=[];

 for(let round=1;round<=30;round++){
  const rows=await fetchRound(round);
  if(!rows)break;

  const points=rows
   .map(row=>Number(row.GamedayPoints))
   .filter(Number.isFinite);

  const completed=points.some(value=>value!==0);
  if(!completed){
   console.log('Round '+round+': all GamedayPoints are 0 -> upcoming/not completed; syncing current prices');
   const teamIdToCode=new Map<string,string>();
   for(const row of rows){
    if(row.PositionName!=='DRIVER')continue;
    const code=constructorCode(row.TeamName);
    if(code&&row.TeamId!=null)teamIdToCode.set(String(row.TeamId),code);
   }

   let gp=await prisma.grandPrix.findUnique({where:{season_round:{season:SEASON,round}}});
   if(!gp)gp=await prisma.grandPrix.create({data:{season:SEASON,round,name:'Round '+round}});

   let pricesSaved=0;
   for(const row of rows){
    const price=Number((row as any).Value);
    if(!Number.isFinite(price)||price<=0)continue;

    let type:AssetType;
    let code:string|null=null;
    if(row.PositionName==='DRIVER'){
     type=AssetType.DRIVER;
     code=String(row.DriverTLA??'').trim().toUpperCase()||null;
    }else if(row.PositionName==='CONSTRUCTOR'){
     type=AssetType.CONSTRUCTOR;
     code=teamIdToCode.get(String(row.PlayerId??''))??
      constructorCode(row.TeamName)??constructorCode(row.FUllName)??constructorCode(row.DisplayName);
    }else continue;

    if(!code)continue;
    const asset=byKey.get(type+':'+code);
    if(!asset)continue;

    const source='Official F1 Fantasy current round feed';
    const existing=await prisma.priceHistory.findFirst({where:{assetId:asset.id,grandPrixId:gp.id,source},orderBy:{recordedAt:'desc'}});
    if(existing)await prisma.priceHistory.update({where:{id:existing.id},data:{price}});
    else await prisma.priceHistory.create({data:{assetId:asset.id,grandPrixId:gp.id,price,source}});
    pricesSaved++;
   }
   console.log('Round '+round+': '+pricesSaved+' current prices saved');
   break;
  }

  const teamIdToCode=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER')continue;
   const code=constructorCode(row.TeamName);
   if(code&&row.TeamId!=null)teamIdToCode.set(String(row.TeamId),code);
  }

  let gp=await prisma.grandPrix.findUnique({where:{season_round:{season:SEASON,round}}});
  if(!gp){
   gp=await prisma.grandPrix.create({data:{season:SEASON,round,name:'Round '+round}});
  }

  let roundSaved=0;
  for(const row of rows){
   const value=Number(row.GamedayPoints);
   if(!Number.isFinite(value))continue;

   let type:AssetType;
   let code:string|null=null;

   if(row.PositionName==='DRIVER'){
    type=AssetType.DRIVER;
    code=String(row.DriverTLA??'').trim().toUpperCase()||null;
   }else if(row.PositionName==='CONSTRUCTOR'){
    type=AssetType.CONSTRUCTOR;
    code=teamIdToCode.get(String(row.PlayerId??''))??
      constructorCode(row.TeamName)??constructorCode(row.FUllName)??constructorCode(row.DisplayName);
   }else{
    continue;
   }

   if(!code)continue;
   const asset=byKey.get(type+':'+code);
   if(!asset){skipped.add(type+':'+code);continue}

   await prisma.fantasyRoundScore.upsert({
    where:{assetId_grandPrixId:{assetId:asset.id,grandPrixId:gp.id}},
    update:{points:value,source:'Official F1 Fantasy round feed'},
    create:{assetId:asset.id,grandPrixId:gp.id,points:value,source:'Official F1 Fantasy round feed'},
   });
   saved++;
   roundSaved++;
  }

  completedRounds.push(round);
  console.log('Round '+round+': '+roundSaved+' scores saved');
 }

 if(!completedRounds.length)throw new Error('No completed Fantasy rounds found');

 const latest=Math.max(...completedRounds);
 const futureGps=await prisma.grandPrix.findMany({
  where:{season:SEASON,round:{gt:latest}},
  select:{id:true},
 });
 if(futureGps.length){
  await prisma.fantasyRoundScore.deleteMany({where:{grandPrixId:{in:futureGps.map(g=>g.id)}}});
 }

 console.log(JSON.stringify({
  ok:true,
  season:SEASON,
  rounds:completedRounds.length,
  latestCompletedRound:latest,
  saved,
  skipped:[...skipped],
  source:'Official F1 Fantasy /feeds/drivers/{round}_en.json',
 },null,2));
}

main()
 .catch(error=>{console.error(error);process.exitCode=1})
 .finally(async()=>{await prisma.$disconnect()});
