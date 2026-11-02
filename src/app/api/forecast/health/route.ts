import {NextResponse} from 'next/server';
import {prisma} from '../../../../lib/prisma';
import {readForecastHealth} from '../../../../lib/forecast-health';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 try{
  const state=await prisma.forecastSeasonState.findUnique({where:{season:2026}});
  if(!state)return NextResponse.json({ok:false,code:'ROUND_NOT_READY'},{status:503,headers});
  const result=await readForecastHealth(prisma,2026,state.round);
  return NextResponse.json(result,{status:result.ok?200:503,headers});
 }catch{return NextResponse.json({ok:false,code:'FORECAST_HEALTH_UNAVAILABLE'},{status:503,headers})}
}
