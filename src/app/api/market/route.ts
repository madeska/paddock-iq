import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

const CURRENT_MODELS=[
  'xpts-driver-ridge50-ewma50-practice-v2 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge50-ewma50-v2 + price-probability-v0.3-floor-aware',
  'xpts-constructor-ewma50-mean3-50-v2 + price-probability-v0.3-floor-aware',
  // Legacy fallbacks keep the market populated until the next projection refresh.
  'xpts-driver-ridge3-practice-v1 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge3-v1 + price-probability-v0.3-floor-aware',
  'xpts-constructor-hybrid-v1 + price-probability-v0.3-floor-aware',
];

export async function GET(request:NextRequest) {
  const season = Number(request.nextUrl.searchParams.get('season') ?? 2026);
  const round = Number(request.nextUrl.searchParams.get('round') ?? 16);

  const gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

  const assets = await prisma.asset.findMany({
    where:{season,active:true},
    include:{
      prices:{where:{grandPrixId:gp.id},orderBy:{recordedAt:'desc'},take:1},
      predictions:{
        where:{grandPrixId:gp.id,modelVersion:{in:CURRENT_MODELS}},
        orderBy:{createdAt:'desc'},
        take:1
      },
      fantasyScores:{
        where:{grandPrix:{round:{lt:round}}},
        orderBy:{grandPrix:{round:'desc'}},
        take:2,
        include:{grandPrix:true}
      },
    },
    orderBy:[{type:'asc'},{name:'asc'}],
  });

  const rows=assets.map(a=>({
    code:a.code,
    name:a.name,
    type:a.type,
    price:a.prices[0] ? Number(a.prices[0].price) : null,
    expectedPoints:a.predictions[0]?.expectedPoints ?? null,
    expectedDelta:a.predictions[0]?.expectedPriceDelta ?? null,
    probabilityRise:a.predictions[0]?.probabilityRise ?? null,
    probabilityFlat:a.predictions[0]?.probabilityFlat ?? null,
    probabilityFall:a.predictions[0]?.probabilityFall ?? null,
    probabilityMaxRise:a.predictions[0]?.probabilityMaxRise ?? null,
    probabilitySmallRise:a.predictions[0]?.probabilitySmallRise ?? null,
    probabilitySmallFall:a.predictions[0]?.probabilitySmallFall ?? null,
    probabilityMaxFall:a.predictions[0]?.probabilityMaxFall ?? null,
    requiredPointsMaxRise:a.predictions[0]?.requiredPointsMaxRise ?? null,
    requiredPointsSmallRise:a.predictions[0]?.requiredPointsSmallRise ?? null,
    requiredPointsAvoidMaxFall:a.predictions[0]?.requiredPointsAvoidMaxFall ?? null,
    recentFantasyScores:a.fantasyScores.map(s=>({round:s.grandPrix.round,points:s.points,name:s.grandPrix.name})),
    confidence:a.predictions[0]?.confidence ?? null,
    modelVersion:a.predictions[0]?.modelVersion ?? null,
  }));

  const incomplete=rows.filter(a=>a.price==null||a.expectedPoints==null||a.expectedDelta==null).map(a=>a.code);

  return NextResponse.json({
    season,
    round,
    grandPrix:gp.name,
    currentModels:CURRENT_MODELS,
    complete:incomplete.length===0,
    incomplete,
    assets:rows,
  });
}
