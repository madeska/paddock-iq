import {authorizeMaintenanceRequest} from '../../../../lib/auth';
export const maxDuration=300;
import {NextRequest,NextResponse} from 'next/server';
import {updateOfficialScores} from '../../../../lib/update-official-scores';
import {maintenanceResponse} from '../../../../lib/maintenance-response';
export async function POST(request:NextRequest){
 const denied=await authorizeMaintenanceRequest(request);if(denied)return denied;
 const body=await request.json().catch(()=>null),season=Number(body?.season),round=Number(body?.round);
 if(season!==2026||!Number.isInteger(round)||round<1||round>30)return NextResponse.json({error:'Invalid season or round'},{status:400});
 return maintenanceResponse(async()=>NextResponse.json(await updateOfficialScores(season,round)));
}
