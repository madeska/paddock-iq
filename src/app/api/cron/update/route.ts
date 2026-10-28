import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '../../../../lib/prisma';
import {cronAuthorized,withMaintenanceLease} from '../../../../lib/maintenance-updates';
import {forecastSeasonState} from '../../../../lib/forecast-season-state';
import {updateOfficialScores} from '../../../../lib/update-official-scores';
import {generateForecast} from '../../../../lib/generate-forecast';
import {scheduledUpdate} from '../../../../lib/scheduled-update';
import {getWeekendLock} from '../../../../lib/openf1-weekend';
import {syncOfficialFantasyMarket} from '../../../../lib/fantasy-official-sync';
import {readForecastHealth} from '../../../../lib/forecast-health';
import {publicUpdateFailure} from '../../../../lib/update-failure';
export const maxDuration=300;
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'no-store'};
 if(!cronAuthorized(request,process.env.CRON_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 try{
  const result=await withMaintenanceLease(prisma,async token=>{
   const update=await scheduledUpdate({
    state:()=>forecastSeasonState(prisma,2026),
    scores:round=>updateOfficialScores(2026,round),
    lock:async round=>{
     let gp=await prisma.grandPrix.findUnique({where:{season_round:{season:2026,round}}});
     if(!gp){await syncOfficialFantasyMarket(prisma,2026,round);gp=await prisma.grandPrix.findUnique({where:{season_round:{season:2026,round}}})}
     return gp?(await getWeekendLock(2026,round,gp.name,gp.deadline))?.deadline??null:null;
    },
    generate:round=>generateForecast({season:2026,round},token),
    verify:round=>readForecastHealth(prisma,2026,round)
   });
   return {value:{status:update.status,round:update.round}};
  });
  return NextResponse.json(result.busy?{status:'BUSY'}:result.value,{headers});
 }catch(error){return NextResponse.json({error:'Scheduled update failed. Saved data retained; retry later.',...publicUpdateFailure(error)},{status:503,headers})}
}
