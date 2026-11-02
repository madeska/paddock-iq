import {prisma} from './prisma';
import {syncCompletedFantasyScores} from './completed-fantasy-scores';
import {advanceForecastSeason,forecastSeasonState} from './forecast-season-state';
import {syncOfficialFantasyRoster} from './fantasy-official-sync';
export async function updateOfficialScores(season:number,round:number){
 const state=await forecastSeasonState(prisma,season);
 if(state.round===round&&!state.completed)await syncOfficialFantasyRoster(prisma,season,round);
 const result=await syncCompletedFantasyScores(prisma,season,round);
 const forecast=await advanceForecastSeason(prisma,season,round,result);
 return {...result,forecast};
}
