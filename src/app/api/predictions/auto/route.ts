import {NextRequest,NextResponse} from 'next/server';
import {authorizeMaintenanceRequest} from '../../../../lib/auth';
import {generateForecast} from '../../../../lib/generate-forecast';
import {maintenanceResponse} from '../../../../lib/maintenance-response';
export const maxDuration=300;
export async function POST(request:NextRequest){
 const denied=await authorizeMaintenanceRequest(request);if(denied)return denied;
 const body=await request.json().catch(()=>({}));
 if(Number(body.season??2026)!==2026||(body.round!==undefined&&(!Number.isInteger(body.round)||body.round<1||body.round>30)))return NextResponse.json({error:'Invalid season or round'},{status:400});
 return maintenanceResponse(token=>generateForecast(body,token),true);
}
