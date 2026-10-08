import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '../../../../lib/prisma';
import {syncCompletedFantasyScores} from '../../../../lib/completed-fantasy-scores';
const pending=new Map<string,ReturnType<typeof syncCompletedFantasyScores>>();
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null),season=Number(body?.season),round=Number(body?.round);
 if(season!==2026||!Number.isInteger(round)||round<1||round>30)return NextResponse.json({error:'Invalid season or round'},{status:400});
 const key=season+':'+round;
 try{let work=pending.get(key);if(!work){work=syncCompletedFantasyScores(prisma,season,round);pending.set(key,work)}const result=await work;return NextResponse.json(result)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Official score update failed'},{status:502})}finally{pending.delete(key)}
}
