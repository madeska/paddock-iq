import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request:NextRequest) {
  const season = Number(request.nextUrl.searchParams.get('season') ?? 2026);
  const round = Number(request.nextUrl.searchParams.get('round') ?? 18);

  const gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

  const assets = await prisma.asset.findMany({
    where:{season},
    include:{
      prices:{orderBy:{recordedAt:'desc'},take:1},
      predictions:{where:{grandPrixId:gp.id},orderBy:{createdAt:'desc'},take:1},
    },
    orderBy:[{type:'asc'},{name:'asc'}],
  });

  return NextResponse.json({
    season, round, grandPrix:gp.name,
    assets:assets.map(a=>({
      code:a.code,
      name:a.name,
      type:a.type,
      price:a.prices[0] ? Number(a.prices[0].price) : null,
      expectedPoints:a.predictions[0]?.expectedPoints ?? null,
      expectedDelta:a.predictions[0]?.expectedPriceDelta ?? null,
      probabilityRise:a.predictions[0]?.probabilityRise ?? null,
      confidence:a.predictions[0]?.confidence ?? null,
      modelVersion:a.predictions[0]?.modelVersion ?? null,
    })),
  });
}
