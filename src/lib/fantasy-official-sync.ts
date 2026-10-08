import {AssetType,PrismaClient} from '@prisma/client';

const BASE='https://fantasy.formula1.com/feeds/drivers';

export type FeedRow={
 IsActive?:string|number|boolean;
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

export function usableOfficialRow(row:FeedRow){return row.IsActive==null||row.IsActive===true||row.IsActive===1||row.IsActive==='1'}
export function officialFantasyPoints(value:unknown):number|null{
 if(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&value.trim()==='')return null;
 const result=Number(value);return Number.isFinite(result)?result:null;
}
/** Current or historical snapshot membership; inactive alternate IDs cannot override an active row. */
export function officialDriverTeams(rows:readonly FeedRow[]):Record<string,string>{
 const aliases:Record<string,string>={RBS:'RB',HAA:'HAS',AMR:'AST'},known=new Set(Object.values(CONSTRUCTOR_CODES)),byId=new Map<string,string>();
 for(const row of rows.filter(r=>r.PositionName==='CONSTRUCTOR')){
  const token=String(row.DriverTLA??'').trim().toUpperCase(),team=constructorCode(row.TeamName)??constructorCode(row.FUllName)??constructorCode(row.DisplayName)??aliases[token]??(known.has(token)?token:null);
  if(team&&row.PlayerId!=null){const id=String(row.PlayerId);if(byId.has(id)&&byId.get(id)!==team)throw Error('Ambiguous official constructor identity');byId.set(id,team)}
 }
 const result:Record<string,string>={};
 for(const row of rows.filter(r=>r.PositionName==='DRIVER'&&usableOfficialRow(r))){
  const code=String(row.DriverTLA??'').trim().toUpperCase();if(!code)continue;
  const team=byId.get(String(row.TeamId??''))??constructorCode(row.TeamName);if(!team)continue;
  if(Object.hasOwn(result,code))throw Error('Ambiguous official driver membership: '+code);result[code]=team;
 }
 return result;
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
 driverTeams:Record<string,string>;
};

export async function syncOfficialFantasyMarket(prisma:PrismaClient,season=2026,targetRound=17):Promise<OfficialFantasySyncResult>{
 const existingAssets=await prisma.asset.findMany({where:{season}});
 const byKey=new Map(existingAssets.map(a=>[a.type+':'+a.code,a]));
 const completedRounds=[Math.max(1,targetRound-2),Math.max(1,targetRound-1)];
 const [olderRows,completedRows,currentRows]=await Promise.all([
  fetchRound(completedRounds[0]),
  fetchRound(completedRounds[1]),
  fetchRound(targetRound),
 ]);
 if(!currentRows)throw new Error('Official F1 Fantasy current round '+targetRound+' feed is unavailable');
 const driverTeams=officialDriverTeams(currentRows);
 if(olderRows)officialDriverTeams(olderRows);
 if(completedRows)officialDriverTeams(completedRows);

 let scoresSaved=0,pricesSaved=0;
 const skipped=new Set<string>();

 const processRows=async(round:number,rows:FeedRow[],saveScores:boolean,markCurrent:boolean)=>{
  const teamIdToCode=new Map<string,string>();
  for(const row of rows){
   if(!usableOfficialRow(row))continue;
   if(row.PositionName!=='DRIVER'||row.TeamId==null)continue;
   const code=constructorCode(row.TeamName);
   if(code)teamIdToCode.set(String(row.TeamId),code);
  }
  const gp=await prisma.grandPrix.upsert({
   where:{season_round:{season,round}},
   update:{name:GP_NAMES_2026[round]??'Round '+round},
   create:{season,round,name:GP_NAMES_2026[round]??'Round '+round},
  });

  if(markCurrent)await prisma.asset.updateMany({where:{season},data:{active:false}});

  for(const row of rows){
   if(!usableOfficialRow(row))continue;
   const identity=rowIdentity(row,teamIdToCode);
   if(!identity)continue;
   const asset=byKey.get(identity.type+':'+identity.code);
   if(!asset){skipped.add(identity.type+':'+identity.code);continue}

   if(markCurrent)await prisma.asset.update({where:{id:asset.id},data:{active:true}});

   const price=Number(row.Value);
   if(Number.isFinite(price)&&price>0){
    const source=markCurrent?'Official F1 Fantasy current round feed':'Official F1 Fantasy round feed';
    const existing=await prisma.priceHistory.findFirst({where:{assetId:asset.id,grandPrixId:gp.id,source}});
    if(existing)await prisma.priceHistory.update({where:{id:existing.id},data:{price}});
    else await prisma.priceHistory.create({data:{assetId:asset.id,grandPrixId:gp.id,price,source}});
    pricesSaved++;
   }

   if(saveScores){
    const fantasyPoints=officialFantasyPoints(row.GamedayPoints);
    if(fantasyPoints!==null){
     const verified=await prisma.fantasyRoundScore.findUnique({where:{assetId_grandPrixId:{assetId:asset.id,grandPrixId:gp.id}}});
     if(verified?.source==='Official F1 Fantasy completed race: feed + popup verified')continue;
     await prisma.fantasyRoundScore.upsert({
      where:{assetId_grandPrixId:{assetId:asset.id,grandPrixId:gp.id}},
      update:{points:fantasyPoints,source:'Official F1 Fantasy round feed'},
      create:{assetId:asset.id,grandPrixId:gp.id,points:fantasyPoints,source:'Official F1 Fantasy round feed'},
     });
     scoresSaved++;
    }
   }
  }
 };

 const olderHasScores=Boolean(olderRows?.some(row=>usableOfficialRow(row)&&officialFantasyPoints(row.GamedayPoints)!==null&&officialFantasyPoints(row.GamedayPoints)!==0));
 const completedHasScores=Boolean(completedRows?.some(row=>usableOfficialRow(row)&&officialFantasyPoints(row.GamedayPoints)!==null&&officialFantasyPoints(row.GamedayPoints)!==0));
 if(olderRows)await processRows(completedRounds[0],olderRows,olderHasScores,false);
 if(completedRows)await processRows(completedRounds[1],completedRows,completedHasScores,false);
 await processRows(targetRound,currentRows,false,true);

 // Completed current-round scores are retained; post-race sync verifies them independently.

 const activeAssets=await prisma.asset.count({where:{season,active:true}});
 return {
  season,
  latestCompletedRound:completedHasScores?completedRounds[1]:olderHasScores?completedRounds[0]:Math.max(0,completedRounds[0]-1),
  currentRound:targetRound,
  scoresSaved,
  pricesSaved,
  activeAssets,
  skipped:[...skipped],
  driverTeams
 };
}
