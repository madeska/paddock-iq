import {NextRequest,NextResponse} from 'next/server';
import {optimizeTransfers} from '../../../lib/multi-optimizer';
export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  if(!Array.isArray(body.current)||!Array.isArray(body.market)||body.market.length>100)return NextResponse.json({error:'Invalid asset lists'},{status:400});
  const scenarios=optimizeTransfers(body.current,body.market,body.cash,body.freeTransfers,body.mode,body.weight??.6,body.penaltyPerExtra??10,body.maxChanges??3,body.locked??[]);
  return NextResponse.json({scenarios,source:'User-supplied forecasts; not live Fantasy prices'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400});}
}
