import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '../../../../lib/prisma';
export async function POST(req:NextRequest){
 try{
  const key=req.headers.get('x-market-admin-key');
  if(!process.env.MARKET_ADMIN_KEY||key!==process.env.MARKET_ADMIN_KEY)return NextResponse.json({error:'Unauthorized'},{status:401});
  const b=await req.json(),season=Number(b.season),round=Number(b.round),scores=b.scores as Record<string,number>;
  if(!season||!round||!scores||typeof scores!=='object')return NextResponse.json({error:'season, round and scores are required'},{status:400});
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});
  const assets=await prisma.asset.findMany({where:{season}});
  const byCode=new Map(assets.map(a=>[a.code,a]));
  const saved=[] as string[],missing=[] as string[];
  for(const [code,points] of Object.entries(scores)){
   const a=byCode.get(code);if(!a){missing.push(code);continue}
   await prisma.fantasyRoundScore.upsert({where:{assetId_grandPrixId:{assetId:a.id,grandPrixId:gp.id}},update:{points:Number(points),source:b.source||'manual/admin import'},create:{assetId:a.id,grandPrixId:gp.id,points:Number(points),source:b.source||'manual/admin import'}});
   saved.push(code);
  }
  return NextResponse.json({ok:true,saved:saved.length,missing});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import failed'},{status:500})}
}
