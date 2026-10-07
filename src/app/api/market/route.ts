import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { syncOfficialFantasyMarket } from '../../../lib/fantasy-official-sync';

const MAIN_MODELS=[
  'xpts-driver-baseline75-component25-practice-v2 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-v2 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v4 + price-probability-v0.4-bounded',
 'xpts-constructor-baseline75-component25-v3 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v2 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-practice-v1 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-v1 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v1 + price-probability-v0.4-bounded',
  'xpts-driver-ridge50-ewma50-practice-v2 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge50-ewma50-v2 + price-probability-v0.3-floor-aware',
  'xpts-constructor-ewma50-mean3-50-v2 + price-probability-v0.3-floor-aware',
  // Legacy fallbacks keep the market populated until the next projection refresh.
  'xpts-driver-ridge3-practice-v1 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge3-v1 + price-probability-v0.3-floor-aware',
  'xpts-constructor-hybrid-v1 + price-probability-v0.3-floor-aware',
];

const BOOST_MODELS=[
  'xpts-driver-ridge50-boost-practice-v1',
  'xpts-driver-ridge50-boost-v1',
];

const CURRENT_MODELS=[...MAIN_MODELS,...BOOST_MODELS];

export async function GET(request:NextRequest) {
  const season = Number(request.nextUrl.searchParams.get('season') ?? 2026);
  const round = Number(request.nextUrl.searchParams.get('round') ?? 17);

  let gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if (!gp) {
    await syncOfficialFantasyMarket(prisma,season,round);
    gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  }
  if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

  const assets = await prisma.asset.findMany({
    where:{season,active:true},
    include:{
      prices:{where:{grandPrixId:gp.id},orderBy:{recordedAt:'desc'},take:1},
      predictions:{
        where:{grandPrixId:gp.id,modelVersion:{in:CURRENT_MODELS}},
        orderBy:{createdAt:'desc'}
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

  const rows=assets.map(a=>{
    const main=MAIN_MODELS.map(model=>a.predictions.find(p=>p.modelVersion===model)).find(Boolean)??null;
    const boost=a.type==='DRIVER'
      ?(a.predictions.find(p=>BOOST_MODELS.includes(p.modelVersion))??null)
      :null;
    return {
      code:a.code,
      name:a.name,
      type:a.type,
      price:a.prices[0] ? Number(a.prices[0].price) : null,
      expectedPoints:main?.expectedPoints ?? null,
      boostExpectedPoints:boost?.expectedPoints ?? main?.expectedPoints ?? null,
      expectedDelta:main?.expectedPriceDelta ?? null,
      probabilityRise:main?.probabilityRise ?? null,
      probabilityFlat:main?.probabilityFlat ?? null,
      probabilityFall:main?.probabilityFall ?? null,
      probabilityMaxRise:main?.probabilityMaxRise ?? null,
      probabilitySmallRise:main?.probabilitySmallRise ?? null,
      probabilitySmallFall:main?.probabilitySmallFall ?? null,
      probabilityMaxFall:main?.probabilityMaxFall ?? null,
      requiredPointsMaxRise:main?.requiredPointsMaxRise ?? null,
      requiredPointsSmallRise:main?.requiredPointsSmallRise ?? null,
      requiredPointsAvoidMaxFall:main?.requiredPointsAvoidMaxFall ?? null,
      recentFantasyScores:a.fantasyScores.map(s=>({round:s.grandPrix.round,points:s.points,name:s.grandPrix.name})),
      confidence:main?.confidence ?? null,
      modelVersion:main?.modelVersion ?? null,
      boostModelVersion:boost?.modelVersion ?? null,
    };
  });

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
