import {NextRequest,NextResponse} from 'next/server';
import {ChipStatus} from '@prisma/client';
import {prisma} from '../../../../lib/prisma';
import {saveTeamSnapshot,type TeamImport} from '../../../../lib/team-snapshot-import';
class RequestError extends Error{constructor(message:string,public status=400){super(message)}}
async function parse(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)throw new RequestError('Submit this change from Paddock IQ.',403);
 const text=await request.text();if(text.length>20000)throw new RequestError('Request is too large.',413);
 let b:any;try{b=JSON.parse(text)}catch{throw new RequestError('Invalid request.')}
 if(!b||typeof b!=='object')throw new RequestError('Invalid request.');
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof b.teamId!=='string'||!b.teamId||b.teamId.length>100)throw new RequestError('Profile email and team are required.');
 return {...b,email};
}
function amount(value:unknown,label:string,integer=false,min=0){if(value===null||value===undefined)return undefined;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>(integer?2147483647:999999.99)||(integer&&!Number.isInteger(value)))throw new RequestError('Invalid '+label+'.');return value}
function errorResponse(error:unknown){const e=error as {code?:string};if(e.code==='P2002')return NextResponse.json({error:'Another team already has this name.'},{status:409});const status=error instanceof RequestError?error.status:error instanceof Error&&error.message.startsWith('Unknown market asset:')?400:500;return NextResponse.json({error:status===500?'Unable to update this team. Try again.':error instanceof Error?error.message:'Invalid request.'},{status,headers:{'Cache-Control':'no-store'}})}
export async function PATCH(request:NextRequest){
 try{
  const b=await parse(request);const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>100||!Number.isInteger(b.round)||b.round<1||b.round>30)throw new RequestError('Team name and round are required.');
  if(!Array.isArray(b.assets)||b.assets.length!==7||b.assets.some((a:any)=>!a||typeof a.code!=='string'||!['DRIVER','CONSTRUCTOR'].includes(a.type)||typeof a.isDoubled!=='boolean'))throw new RequestError('Choose 5 drivers and 2 constructors.');
  const assets:TeamImport['assets']=b.assets.map((a:any)=>({code:a.code.trim().toUpperCase(),type:a.type,isDoubled:a.isDoubled}));
  if(assets.filter(a=>a.type==='DRIVER').length!==5||assets.filter(a=>a.type==='CONSTRUCTOR').length!==2||new Set(assets.map(a=>a.type+':'+a.code)).size!==7)throw new RequestError('Choose 5 unique drivers and 2 unique constructors.');
  if(assets.filter(a=>a.type==='DRIVER'&&a.isDoubled).length!==1||assets.some(a=>a.type==='CONSTRUCTOR'&&a.isDoubled))throw new RequestError('Choose exactly one 2× driver.');
  const cashBalance=amount(b.cashBalance,'cash balance'),freeTransfers=amount(b.freeTransfers,'free transfers',true),totalPoints=amount(b.totalPoints,'points',true,-2147483648);
  const chips:NonNullable<TeamImport['chips']>={};if(b.chips!==undefined){if(!b.chips||typeof b.chips!=='object'||Array.isArray(b.chips))throw new RequestError('Invalid chips.');for(const [code,status] of Object.entries(b.chips)){if(!['WC','LL','AP','NN','DRS','FF'].includes(code)||!Object.values(ChipStatus).includes(status as ChipStatus))throw new RequestError('Invalid chip status.');chips[code]=status as ChipStatus}}
  const result=await prisma.$transaction(async tx=>{
   const team=await tx.fantasyTeam.findFirst({where:{id:b.teamId,user:{email:b.email}}});if(!team)throw new RequestError('Team not found for this profile.',404);
   return saveTeamSnapshot(tx,{user:{email:b.email},team:{name,season:team.season},round:b.round,assets,cashBalance,freeTransfers,totalPoints,chips},team.id,team.externalId??'legacy-name:'+team.name);
  });
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error)}
}
export async function DELETE(request:NextRequest){
 try{
  const b=await parse(request);
  const result=await prisma.$transaction(async tx=>{
   const team=await tx.fantasyTeam.findFirst({where:{id:b.teamId,user:{email:b.email}}});if(!team)throw new RequestError('Team not found for this profile.',404);
   await tx.transfer.deleteMany({where:{snapshot:{teamId:team.id}}});await tx.teamSlot.deleteMany({where:{snapshot:{teamId:team.id}}});await tx.teamSnapshot.deleteMany({where:{teamId:team.id}});await tx.chipUsage.deleteMany({where:{teamId:team.id}});await tx.strategyScenario.deleteMany({where:{teamId:team.id}});await tx.fantasyTeam.delete({where:{id:team.id}});
   const teams=await tx.fantasyTeam.findMany({where:{userId:team.userId,season:team.season},select:{id:true,name:true},orderBy:{name:'asc'}});return {season:team.season,teams};
  });return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error)}
}
