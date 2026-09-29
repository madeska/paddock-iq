import {NextRequest,NextResponse} from 'next/server';
import {optimizeThreeGpHold} from '../../../../lib/horizon-optimizer';

export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  if(!Array.isArray(body.current)||!Array.isArray(body.market))return NextResponse.json({error:'Invalid asset lists'},{status:400});
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
