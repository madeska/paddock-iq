import { NextRequest, NextResponse } from 'next/server';
import {saveTeamSnapshot,type TeamImport} from '../../../../lib/team-snapshot-import';
import { prisma } from '../../../../lib/prisma';

export async function POST(request:NextRequest) {
  try {
    const body = await request.json() as TeamImport;
    const email = body.user?.email?.trim().toLowerCase();
    const teamName = body.team?.name?.trim();
    const season = Number(body.team?.season);
    const round = Number(body.round);

    if (!email || !teamName || !Number.isInteger(season) || !Number.isInteger(round)) {
      return NextResponse.json({error:'user.email, team.name, season and round are required'}, {status:400});
    }
    if (!Array.isArray(body.assets) || body.assets.length !== 7) {
      return NextResponse.json({error:'A Fantasy team must contain exactly 7 assets'}, {status:400});
    }
    const drivers=body.assets.filter(a=>a.type==='DRIVER');
    const constructors=body.assets.filter(a=>a.type==='CONSTRUCTOR');
    if (drivers.length!==5 || constructors.length!==2) {
      return NextResponse.json({error:'Team must contain 5 drivers and 2 constructors'}, {status:400});
    }
    if (new Set(body.assets.map(a=>`${a.type}:${a.code}`)).size!==7) {
      return NextResponse.json({error:'Duplicate team assets'}, {status:400});
    }

    const result=await prisma.$transaction(tx=>saveTeamSnapshot(tx,body));

    return NextResponse.json({ok:true,...result});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Team import failed'}, {status:400});
  }
}
