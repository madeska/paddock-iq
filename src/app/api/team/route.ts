import {EXCLUDED_SCORE_SOURCE} from '../../../lib/official-history-reconciliation';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '../../../lib/prisma';

import {MAIN_MODELS,BOOST_MODELS,CURRENT_MODELS} from '../../../lib/current-prediction-models';

export async function GET(request:NextRequest){
 const email=request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
 const season=Number(request.nextUrl.searchParams.get('season')??2026);
 if(!email)return NextResponse.json({error:'email is required'},{status:400});

 const user=await prisma.user.findUnique({where:{email},include:{teams:{where:{season},orderBy:{name:'asc'}}}});
 if(!user)return NextResponse.json({error:'User not found'},{status:404});
 if(!user.teams.length)return NextResponse.json({error:'No team found for this season'},{status:404});

 const teamId=request.nextUrl.searchParams.get('teamId')||user.teams[0].id;
 const team=user.teams.find(t=>t.id===teamId);
 if(!team)return NextResponse.json({error:'Team not found for user'},{status:404});

 const latestCompletedGp=await prisma.grandPrix.findFirst({where:{season,fantasyScores:{some:{points:{not:0}}}},orderBy:{round:'desc'}});
 const targetRound=(latestCompletedGp?.round??0)+1;
 const targetGp=await prisma.grandPrix.findUnique({where:{season_round:{season,round:targetRound}}});

 const snapshot=await prisma.teamSnapshot.findFirst({
  where:{teamId},
  orderBy:{capturedAt:'desc'},
  include:{
   grandPrix:true,
   slots:{include:{asset:{include:{
    prices:targetGp?{where:{grandPrixId:targetGp.id},orderBy:{recordedAt:'desc'},take:1}:{orderBy:{recordedAt:'desc'},take:1},
    predictions:targetGp?{where:{grandPrixId:targetGp.id,modelVersion:{in:CURRENT_MODELS}},orderBy:{createdAt:'desc'}}:{orderBy:{createdAt:'desc'}},
    fantasyScores:{where:{source:{not:EXCLUDED_SCORE_SOURCE}},orderBy:{grandPrix:{round:'desc'}},take:3,include:{grandPrix:true}}
   }}}},
   team:{include:{chipUses:true}}
  }
 });
 if(!snapshot)return NextResponse.json({error:'No team snapshot found'},{status:404});

 return NextResponse.json({
  user:{id:user.id,email:user.email,name:user.name},
  teams:user.teams.map(t=>({id:t.id,name:t.name})),
  team:{id:team.id,name:team.name,season:team.season},
  snapshot:{
   id:snapshot.id,capturedAt:snapshot.capturedAt,
   grandPrix:{round:targetGp?.round??snapshot.grandPrix.round,name:targetGp?.name??snapshot.grandPrix.name},
   cashBalance:snapshot.cashBalance===null?null:Number(snapshot.cashBalance),
   freeTransfers:snapshot.freeTransfers,totalPoints:snapshot.totalPoints,
   assets:snapshot.slots.map(s=>{
    const p=s.asset.predictions.find(pred=>MAIN_MODELS.includes(pred.modelVersion))??s.asset.predictions[0]??null;
    const boost=s.asset.type==='DRIVER'
      ?(s.asset.predictions.find(pred=>BOOST_MODELS.includes(pred.modelVersion))??null)
      :null;
    const currentRound=targetGp?.round??snapshot.grandPrix.round;
    const history=s.asset.fantasyScores.filter(x=>x.grandPrix.round<currentRound).slice(0,2);
    const probs=p?[p.probabilityMaxRise,p.probabilitySmallRise,p.probabilitySmallFall,p.probabilityMaxFall,p.probabilityFlat]:[null,null,null,null,null];
    const currentPrice=s.asset.prices[0]?Number(s.asset.prices[0].price):null;
    const base=currentPrice!==null&&currentPrice>=18.5?[.3,.1,-.1,-.3]:[.6,.2,-.2,-.6];
    const floorDelta=currentPrice===null?-Infinity:Math.round((3-currentPrice)*100)/100;
    const deltas=[base[0],base[1],Math.max(base[2],floorDelta),Math.max(base[3],floorDelta),0];
    let mostLikelyDelta:number|null=null,mostLikelyProbability:number|null=null;
    const valid=probs.map((v,i)=>({v:v??-1,i})).filter(x=>x.v>=0);
    if(valid.length){const best=valid.reduce((a,b)=>b.v>a.v?b:a);mostLikelyDelta=deltas[best.i];mostLikelyProbability=best.v}
    return {
     code:s.asset.code,name:s.asset.name,type:s.asset.type,isDoubled:s.isDoubled,
     price:s.asset.prices[0]?Number(s.asset.prices[0].price):null,
     expectedPoints:p?.expectedPoints??null,boostExpectedPoints:boost?.expectedPoints??p?.expectedPoints??null,expectedDelta:p?.expectedPriceDelta??null,modelVersion:p?.modelVersion??null,
     probabilityMaxRise:p?.probabilityMaxRise??null,probabilitySmallRise:p?.probabilitySmallRise??null,
     probabilitySmallFall:p?.probabilitySmallFall??null,probabilityMaxFall:p?.probabilityMaxFall??null,probabilityFlat:p?.probabilityFlat??null,
     requiredPointsMaxRise:p?.requiredPointsMaxRise??null,requiredPointsSmallRise:p?.requiredPointsSmallRise??null,
     requiredPointsAvoidMaxFall:p?.requiredPointsAvoidMaxFall??null,
     mostLikelyDelta,mostLikelyProbability,
     recentFantasyScores:history.map(x=>({round:x.grandPrix.round,name:x.grandPrix.name,points:x.points}))
    };
   }),
   chips:snapshot.team.chipUses.map(c=>({code:c.chipCode,status:c.status}))
  }
 });
}
