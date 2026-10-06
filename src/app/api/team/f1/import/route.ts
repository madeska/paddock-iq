import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '../../../../../lib/prisma';
import {normalizeF1TeamExport} from '../../../../../lib/f1-team-import';
import {saveTeamSnapshot} from '../../../../../lib/team-snapshot-import';
export async function POST(request:NextRequest){
 const headers={'Cache-Control':'no-store'};
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Import must be submitted from Paddock IQ.'},{status:403,headers});
  const text=await request.text();if(text.length>100000)return NextResponse.json({error:'Export is too large.'},{status:413,headers});
  const body=JSON.parse(text);if(body.action!=='preview'&&body.action!=='save')throw Error('Choose preview or save.');
  const season=Number(body.season),round=Number(body.round);
  if(!Number.isInteger(season)||season<2026||season>2100||!Number.isInteger(round)||round<1||round>30)throw Error('Invalid season or round.');
  const market=await prisma.asset.findMany({where:{season,active:true},select:{code:true,name:true,type:true}});
  const imported=normalizeF1TeamExport(body.export,market,season,round);
  if(body.action==='preview')return NextResponse.json(imported,{headers});
  const team=imported.teams.find(t=>t.teamNo===Number(body.teamNo??imported.teams[0].teamNo));if(!team)throw Error('Select an exported F1 team.');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Enter your Paddock IQ profile email.');
  if(new Set(imported.teams.map(t=>t.name)).size!==imported.teams.length)throw Error('Exported teams must have distinct names.');
  // All teams share one transaction: either every snapshot is saved, or none is.
  const saved=await prisma.$transaction(async tx=>{
   const results=[];
   for(const t of imported.teams){const result=await saveTeamSnapshot(tx,{user:{email},team:{name:t.name,season},round,assets:t.assets,cashBalance:t.cashBalance,freeTransfers:t.freeTransfers,totalPoints:t.totalPoints,chips:t.chips});results.push({teamNo:t.teamNo,name:t.name,...result})}
   return results;
  });
  const selected=saved.find(t=>t.teamNo===team.teamNo)!;
  return NextResponse.json({ok:true,userId:selected.userId,teamId:selected.teamId,snapshotId:selected.snapshotId,teams:saved},{headers});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'F1 team import failed.'},{status:400,headers})}
}
