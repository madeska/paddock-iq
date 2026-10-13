import {NextRequest,NextResponse} from 'next/server';
import {optimizeThreeGpHold} from '../../../../lib/horizon-optimizer';
import {authorizeTeamRequest} from '../../../../lib/auth';
import {readLimitedJson} from '../../../../lib/request-json';

export async function POST(request:NextRequest){
 const auth=await authorizeTeamRequest(request);if(auth.response)return auth.response;
 try{
  const body=await readLimitedJson(request);
  if(!Array.isArray(body.current)||body.current.length!==7||!Array.isArray(body.market)||body.market.length>33||!Number.isInteger(body.maxChanges??3)||(body.maxChanges??3)<0||(body.maxChanges??3)>3)return NextResponse.json({error:'Invalid optimizer inputs. Use 7 current assets, at most 33 candidates and 0–3 changes.'},{status:400});
  const assets=[...body.current,...body.market];
  if(assets.some(a=>!a||typeof a.code!=='string'||!['DRIVER','CONSTRUCTOR'].includes(a.type)||!Number.isFinite(a.price)||a.price<0||!Number.isFinite(a.expectedDelta)||!Array.isArray(a.horizonPoints)||a.horizonPoints.length!==3||a.horizonPoints.some((p:unknown)=>typeof p!=='number'||!Number.isFinite(p)))||new Set(assets.map(a=>a.code)).size!==assets.length||!Number.isFinite(body.cash)||body.cash<0||!Number.isInteger(body.freeTransfers)||body.freeTransfers<0||!Array.isArray(body.locked??[])||(body.locked??[]).some((code:unknown)=>typeof code!=='string'||!body.current.some((a:any)=>a.code===code)))return NextResponse.json({error:'Invalid horizon forecast inputs'},{status:400});
  const scenarios=optimizeThreeGpHold(
   body.current,
   body.market,
   body.cash,
   body.freeTransfers,
   body.penaltyPerExtra??10,
   body.maxChanges??3,
   body.locked??[]
  );
  return NextResponse.json({
   scenarios,
   model:'3-gp-hold-v1',
   caveat:'Scores assume the post-transfer lineup is held for all three projected GPs. Future transfers, track/sprint/weather/news modifiers are not simulated.'
  });
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Invalid request'},{status:400});
 }
}
