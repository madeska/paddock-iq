import {AssetType,PrismaClient} from '@prisma/client';

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
 Value?:string|number|null;
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

const GP_NAMES_2026:Record<number,string>={
 16:'Bahrain GP in Malaysia',
 17:'Singapore GP',
 18:'United States GP',
 19:'Mexico GP',
 20:'São Paulo GP',
 21:'Las Vegas GP',
 22:'Qatar GP',
 23:'Abu Dhabi GP',
};

function constructorCode(name:unknown){
 const upper=String(name??'').trim().toUpperCase();
 return CONSTRUCTOR_CODES[upper]??null;
}

function rowIdentity(row:FeedRow,teamIdToCode:Map<string,string>){
 if(row.PositionName==='DRIVER'){
  const code=String(row.DriverTLA??'').trim().toUpperCase();
  return code?{type:AssetType.DRIVER,code}:null;
 }
 if(row.PositionName==='CONSTRUCTOR'){
  const code=teamIdToCode.get(String(row.PlayerId??''))??
   constructorCode(row.TeamName)??constructorCode(row.FUllName)??constructorCode(row.DisplayName);
  return code?{type:AssetType.CONSTRUCTOR,code}:null;
 }
 return null;
}

async function fetchRound(round:number){
 const response=await fetch(BASE+'/'+round+'_en.json?buster='+Date.now(),{
  headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'},
  cache:'no-store'
 });
 if(response.status===404)return null;
 if(!response.ok)throw new Error('Official F1 Fantasy round '+round+' feed failed: HTTP '+response.status);
 const json=await response.json() as any;
 const rows=Array.isArray(json?.Data?.Value)?json.Data.Value as FeedRow[]:[];
 if(!rows.length)throw new Error('Official F1 Fantasy round '+round+' feed returned no assets');
 return rows;
}

export type OfficialFantasySyncResult={
 season:number;
 latestCompletedRound:number;
 currentRound:number|null;
 scoresSaved:number;
 pricesSaved:number;
 activeAssets:number;
 skipped:string[];
};

export async function syncOfficialFantasyMarket(prisma:PrismaClient,season=2026,maxRound=30):Promise<OfficialFantasySyncResult>{
 const existingAssets=await prisma.asset.findMany({where:{season}});
 const byKey=new Map(existingAssets.map(a=>[a.type+':'+a.code,a]));
 let latestCompletedRound=0,currentRound:number|null=null,scoresSaved=0,pricesSaved=0;
 const skipped=new Set<string>();

 for(let round=1;round<=maxRound;round++){
  const rows=await fetchRound(round);
  if(!rows)break;

  const teamIdToCode=new Map<string,string>();
  for(const row of rows){
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const code=constructorCode(row.TeamName);
   if(code)teamIdToCode.set(String(row.TeamId),code);
  }

  const points=rows.map(row=>Number(row.GamedayPoints)).filter(Number.isFinite);
  const completed=points.some(value=>value!==0);
  const gp=await prisma.grandPrix.upsert({
   where:{season_round:{season,round}},
   update:{name:GP_NAMES_2026[round]??'Round '+round},
   create:{season,round,name:GP_NAMES_2026[round]??'Round '+round},
  });

  if(!completed){
   currentRound=round;
   await prisma.asset.updateMany({where:{season},data:{active:false}});
  }

  for(const row of rows){
   const identity=rowIdentity(row,teamIdToCode);
   if(!identity)continue;
   const asset=byKey.get(identity.type+':'+identity.code);
   if(!asset){skipped.add(identity.type+':'+identity.code);continue}

   if(!completed&&!asset.active)await prisma.asset.update({where:{id:asset.id},data:{active:true}});
   else if(!completed)await prisma.asset.update({where:{id:asset.id},data:{active:true}});

   const price=Number(row.Value);
   if(Number.isFinite(price)&&price>0){
    const source=completed?'Official F1 Fantasy round feed':'Official F1 Fantasy current round feed';
    const existing=await prisma.priceHistory.findFirst({where:{assetId:asset.id,grandPrixId:gp.id,source}});
    if(existing)await prisma.priceHistory.update({where:{id:existing.id},data:{price}});
    else await prisma.priceHistory.create({data:{assetId:asset.id,grandPrixId:gp.id,price,source}});
    pricesSaved++;
   }

   if(completed){
    const fantasyPoints=Number(row.GamedayPoints);
    if(Number.isFinite(fantasyPoints)){
     await prisma.fantasyRoundScore.upsert({
      where:{assetId_grandPrixId:{assetId:asset.id,grandPrixId:gp.id}},
      update:{points:fantasyPoints,source:'Official F1 Fantasy round feed'},
      create:{assetId:asset.id,grandPrixId:gp.id,points:fantasyPoints,source:'Official F1 Fantasy round feed'},
     });
     scoresSaved++;
    }
   }
  }

  if(completed)latestCompletedRound=round;
  else break;
 }

 if(latestCompletedRound){
  const futureGps=await prisma.grandPrix.findMany({where:{season,round:{gt:latestCompletedRound}},select:{id:true}});
  if(futureGps.length)await prisma.fantasyRoundScore.deleteMany({where:{grandPrixId:{in:futureGps.map(g=>g.id)}}});
 }

 const activeAssets=await prisma.asset.count({where:{season,active:true}});
 return {season,latestCompletedRound,currentRound,scoresSaved,pricesSaved,activeAssets,skipped:[...skipped]};
}
