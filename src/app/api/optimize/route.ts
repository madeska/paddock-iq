import {NextRequest,NextResponse} from 'next/server';
import {optimizeTransfers} from '../../../lib/multi-optimizer';
import {authorizeTeamRequest} from '../../../lib/auth';
import {readLimitedJson} from '../../../lib/request-json';
export async function POST(request:NextRequest){
 const auth=await authorizeTeamRequest(request);if(auth.response)return auth.response;
 try{
  const body=await readLimitedJson(request);
  if(!Array.isArray(body.current)||body.current.length!==7||!Array.isArray(body.market)||body.market.length>33||!Number.isInteger(body.maxChanges??3)||(body.maxChanges??3)<0||(body.maxChanges??3)>3)return NextResponse.json({error:'Invalid optimizer inputs. Use 7 current assets, at most 33 candidates and 0–3 changes.'},{status:400});
  const scenarios=optimizeTransfers(body.current,body.market,body.cash,body.freeTransfers,body.mode,body.weight??.6,body.penaltyPerExtra??10,body.maxChanges??3,body.locked??[]);
  return NextResponse.json({scenarios,source:'User-supplied forecasts; not live Fantasy prices'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400});}
}
