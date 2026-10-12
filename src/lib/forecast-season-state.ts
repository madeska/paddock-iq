import type {PrismaClient} from '@prisma/client';
// This deployment starts at R17 of the supported 2026 calendar. The persisted cursor never moves backwards.
export async function forecastSeasonState(prisma:PrismaClient,season:number){
 if(season!==2026)throw Error('Unsupported forecast season');
 return prisma.forecastSeasonState.upsert({where:{season},create:{season,round:17},update:{}});
}
type Completion={status:string;verified:number;total:number;protectedScores:number;pending:string[];errors:string[]};
export function rolloverDecision(round:number,result:Completion,expectedAssets:number){
 if(!Number.isInteger(round)||round<17||round>23||expectedAssets<=0||result.status!=='UPDATED'||result.verified!==expectedAssets||result.total!==expectedAssets||result.protectedScores||result.pending.length||result.errors.length)return null;
 return round===23?{round,completed:true}:{round:round+1,completed:false};
}
export async function advanceForecastSeason(prisma:PrismaClient,season:number,round:number,result:Completion){
 const state=await forecastSeasonState(prisma,season);
 if(state.round!==round||state.completed)return state;
 const expectedAssets=await prisma.asset.count({where:{season,active:true}}),next=rolloverDecision(round,result,expectedAssets);
 if(next){
  const stored=await prisma.fantasyRoundScore.count({where:{grandPrix:{season,round},asset:{season,active:true},source:'Official F1 Fantasy completed race: feed + popup verified'}});
  if(stored!==expectedAssets)return state;
 }
 if(next)await prisma.forecastSeasonState.updateMany({where:{season,round,completed:false},data:next});
 return prisma.forecastSeasonState.findUniqueOrThrow({where:{season}});
}
