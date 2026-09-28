import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictPrice } from '../../../../lib/price-predictor';

export async function GET(request: NextRequest) {
  const season = Number(request.nextUrl.searchParams.get('season') ?? 2026);
  const round = Number(request.nextUrl.searchParams.get('round') ?? 18);

  if (!Number.isInteger(season) || !Number.isInteger(round)) {
    return NextResponse.json({error:'Invalid season or round'}, {status:400});
  }

  const gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

  const assets = await prisma.asset.findMany({
    where:{season},
    include:{
      prices:{orderBy:{recordedAt:'desc'},take:2},
      predictions:{where:{grandPrixId:gp.id},orderBy:{createdAt:'desc'},take:1},
    },
    orderBy:[{type:'asc'},{code:'asc'}],
  });

  return NextResponse.json({
    season, round, grandPrix:gp.name,
    assets: assets.map(a=>({
      code:a.code,
      name:a.name,
      type:a.type,
      currentPrice:a.prices[0] ? Number(a.prices[0].price) : null,
      previousPrice:a.prices[1] ? Number(a.prices[1].price) : null,
      prediction:a.predictions[0] ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const season = Number(body.season ?? 2026);
    const round = Number(body.round ?? 18);
    const expectedPoints: Record<string,number> = body.expectedPoints ?? {};

    const gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
    if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

    const assets = await prisma.asset.findMany({
      where:{season},
      include:{prices:{orderBy:{recordedAt:'desc'},take:2}},
    });

    const created = [];
    for (const asset of assets) {
      const currentPrice = asset.prices[0] ? Number(asset.prices[0].price) : null;
      if (currentPrice == null) continue;
      const previousPrice = asset.prices[1] ? Number(asset.prices[1].price) : currentPrice;
      const pts = Number.isFinite(expectedPoints[asset.code]) ? expectedPoints[asset.code] : null;
      const p = predictPrice({currentPrice, previousPrice, expectedPoints:pts});
      const row = await prisma.assetPrediction.create({
        data:{
          assetId:asset.id,
          grandPrixId:gp.id,
          expectedPoints:pts,
          expectedPriceDelta:p.expectedDelta,
          probabilityRise:p.probabilityRise,
          probabilityFlat:p.probabilityFlat,
          probabilityFall:p.probabilityFall,
          confidence:p.confidence,
          source:'paddock-iq heuristic',
          modelVersion:p.modelVersion,
        },
      });
      created.push({code:asset.code,...p,id:row.id});
    }

    return NextResponse.json({
      created:created.length,
      predictions:created,
      warning:'Heuristic model only. It is not an official F1 Fantasy pricing algorithm.'
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Prediction failed'}, {status:400});
  }
}
