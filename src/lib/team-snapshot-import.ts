import {AssetType,ChipStatus,type Prisma} from '@prisma/client';

export type TeamImport = {
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

export async function saveTeamSnapshot(tx:Prisma.TransactionClient,body:TeamImport,existingTeamId?:string,externalId?:string){
  const email=body.user.email.trim().toLowerCase(),teamName=body.team.name.trim(),season=Number(body.team.season),round=Number(body.round);
  const user=await tx.user.upsert({
    where:{email},
    update:{name:body.user.name?.trim() || undefined},
    create:{email,name:body.user.name?.trim() || undefined}
  });
  const team=existingTeamId?await tx.fantasyTeam.update({where:{id:existingTeamId},data:{name:teamName,externalId}}):externalId?await tx.fantasyTeam.create({data:{userId:user.id,season,name:teamName,externalId}}):await tx.fantasyTeam.upsert({
    where:{userId_season_name:{userId:user.id,season,name:teamName}},
    update:{externalId},
    create:{userId:user.id,season,name:teamName,externalId}
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
}
