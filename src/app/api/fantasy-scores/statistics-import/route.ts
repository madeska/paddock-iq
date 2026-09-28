import {NextRequest,NextResponse} from 'next/server';import {prisma} from '../../../../lib/prisma';import {normalizeFantasyStatistics} from '../../../../lib/fantasy-statistics-normalizer';
export async function POST(req:NextRequest){try{
 const key=req.headers.get('x-market-admin-key');if(!process.env.MARKET_ADMIN_KEY||key!==process.env.MARKET_ADMIN_KEY)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json(),season=Number(body.season||2026),rounds=normalizeFantasyStatistics(body.data);
 const latestImportedRound=rounds.length?Math.max(...rounds.map(r=>r.round)):0;
 if(!rounds.length)return NextResponse.json({error:'No completed race-by-race Fantasy statistics found'},{status:400});
 const futureGps=await prisma.grandPrix.findMany({where:{season,round:{gt:latestImportedRound}},select:{id:true}});
 if(futureGps.length)await prisma.fantasyRoundScore.deleteMany({where:{grandPrixId:{in:futureGps.map(g=>g.id)}}});
 const assets=await prisma.asset.findMany({where:{season}}),byCode=new Map(assets.map(a=>[a.code,a]));let saved=0;const skipped:string[]=[];
 for(const r of rounds){const gp=await prisma.grandPrix.upsert({where:{season_round:{season,round:r.round}},update:{name:r.raceName||`Round ${r.round}`},create:{season,round:r.round,name:r.raceName||`Round ${r.round}`}})
  for(const [code,points] of Object.entries(r.scores)){const a=byCode.get(code);if(!a){skipped.push(code);continue}
   await prisma.fantasyRoundScore.upsert({where:{assetId_grandPrixId:{assetId:a.id,grandPrixId:gp.id}},update:{points,source:'Official F1 Fantasy Statistics'},create:{assetId:a.id,grandPrixId:gp.id,points,source:'Official F1 Fantasy Statistics'}});saved++;
  }}
 return NextResponse.json({ok:true,saved,rounds:rounds.length,skipped:[...new Set(skipped)]});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import failed'},{status:500})}}
