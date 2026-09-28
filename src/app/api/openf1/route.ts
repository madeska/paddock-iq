import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const allowed=new Set(['meetings','sessions','drivers','session_result','laps','pit','weather']);
export async function GET(request:NextRequest){
 const url=new URL(request.url);const resource=url.searchParams.get('resource')||'meetings';
 if(!allowed.has(resource))return NextResponse.json({error:'Unsupported resource'},{status:400});
 const params=new URLSearchParams();
 for(const key of ['year','meeting_key','session_key','driver_number','country_name']){
  const v=url.searchParams.get(key);if(v)params.set(key,v);
 }
 if(!params.has('year')&&!params.has('meeting_key')&&!params.has('session_key'))params.set('year','2026');
 try{
  const response=await fetch(`https://api.openf1.org/v1/${resource}?${params}`,{next:{revalidate:300},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return NextResponse.json({error:'OpenF1 unavailable',upstreamStatus:response.status},{status:502});
  return NextResponse.json({source:'OpenF1',resource,updatedAt:new Date().toISOString(),data:await response.json()});
 }catch{return NextResponse.json({error:'OpenF1 request failed'},{status:502});}
}
