import { NextRequest, NextResponse } from 'next/server';
import { AssetType, ChipStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';

type TeamImport = {
  user:{email:string;name?:string};
  team:{name:string;season:number};
  round:number;
  grandPrixName?:string;
  cashBalance?:number;
  freeTransfers?:number;
  totalPoints?:number;
  assets:{code:string;type:'DRIVER'|'CONSTRUCTOR';isDoubled?:boolean}[];
  chips?:Record<string,'AVAILABLE'|'USED'|'LOCKED'|'UNKNOWN'>;
};

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

    const result = await prisma.$transaction(async tx => {
      const user=await tx.user.upsert({
        where:{email},
        update:{name:body.user.name?.trim() || undefined},
        create:{email,name:body.user.name?.trim() || undefined}
      });
      const team=await tx.fantasyTeam.upsert({
        where:{userId_season_name:{userId:user.id,season,name:teamName}},
        update:{},
        create:{userId:user.id,season,name:teamName}
      });
      const gp=await tx.grandPrix.upsert({
        where:{season_round:{season,round}},
        update:body.grandPrixName?{name:body.grandPrixName}:{},
        create:{season,round,name:body.grandPrixName || `Round ${round}`}
      });

      const wanted=[];
      for (const a of body.assets) {
        const type=a.type==='DRIVER'?AssetType.DRIVER:AssetType.CONSTRUCTOR;
        const asset=await tx.asset.findUnique({where:{season_code_type:{season,code:a.code,type}}});
        if (!asset) throw new Error(`Unknown market asset: ${a.code} (${a.type}). Import market data first.`);
        wanted.push({asset,isDoubled:Boolean(a.isDoubled)});
      }

      const snapshot=await tx.teamSnapshot.create({
        data:{
          teamId:team.id,grandPrixId:gp.id,
          cashBalance:Number.isFinite(body.cashBalance)?body.cashBalance:undefined,
          freeTransfers:Number.isInteger(body.freeTransfers)?body.freeTransfers:undefined,
          totalPoints:Number.isInteger(body.totalPoints)?body.totalPoints:undefined
        }
      });
      await tx.teamSlot.createMany({data:wanted.map(x=>({snapshotId:snapshot.id,assetId:x.asset.id,isDoubled:x.isDoubled}))});

      for (const [chipCode,status] of Object.entries(body.chips ?? {})) {
        if (!(status in ChipStatus)) continue;
        await tx.chipUsage.upsert({
          where:{teamId_chipCode:{teamId:team.id,chipCode}},
          update:{status:status as ChipStatus},
          create:{teamId:team.id,chipCode,status:status as ChipStatus}
        });
      }

      return {userId:user.id,teamId:team.id,snapshotId:snapshot.id};
    });

    return NextResponse.json({ok:true,...result});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Team import failed'}, {status:400});
  }
}
