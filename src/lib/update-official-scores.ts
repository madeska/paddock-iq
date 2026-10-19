import {prisma} from './prisma';
import {syncCompletedFantasyScores} from './completed-fantasy-scores';
import {advanceForecastSeason} from './forecast-season-state';
export async function updateOfficialScores(season:number,round:number){
 const result=await syncCompletedFantasyScores(prisma,season,round);
 const forecast=await advanceForecastSeason(prisma,season,round,result);
 return {...result,forecast};
}
