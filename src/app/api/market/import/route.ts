import { NextRequest, NextResponse } from 'next/server';
import { AssetType } from '@prisma/client';
import { prisma } from '../../../lib/prisma';

type MarketAsset = {
  code: string;
  name: string;
  type: 'DRIVER' | 'CONSTRUCTOR';
  price: number;
};

function validAsset(a: unknown): a is MarketAsset {
  if (!a || typeof a !== 'object') return false;
  const v = a as Record<string, unknown>;
  return typeof v.code === 'string' &&
    typeof v.name === 'string' &&
    (v.type === 'DRIVER' || v.type === 'CONSTRUCTOR') &&
    typeof v.price === 'number' &&
    Number.isFinite(v.price) &&
    v.price > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const season = Number(body.season ?? 2026);
    const round = Number(body.round ?? 18);
    const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'manual market import';
    const assets = body.assets;

    if (!Number.isInteger(season) || !Number.isInteger(round)) {
      return NextResponse.json({error:'Invalid season or round'}, {status:400});
    }
    if (!Array.isArray(assets) || assets.length === 0 || assets.length > 100 || !assets.every(validAsset)) {
      return NextResponse.json({error:'Invalid assets payload'}, {status:400});
    }
    if (new Set(assets.map((a:MarketAsset)=>`${a.type}:${a.code}`)).size !== assets.length) {
      return NextResponse.json({error:'Duplicate asset codes'}, {status:400});
    }

    const gp = await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
    if (!gp) return NextResponse.json({error:'Grand Prix not found'}, {status:404});

    let created = 0;
    let updated = 0;
    let pricesAdded = 0;

    for (const a of assets as MarketAsset[]) {
      const type = a.type === 'DRIVER' ? AssetType.DRIVER : AssetType.CONSTRUCTOR;
      const existing = await prisma.asset.findUnique({
        where:{season_code_type:{season,code:a.code,type}}
      });

      const asset = existing
        ? await prisma.asset.update({where:{id:existing.id},data:{name:a.name}})
        : await prisma.asset.create({data:{season,code:a.code,name:a.name,type}});

      if (existing) updated++; else created++;

      const latest = await prisma.priceHistory.findFirst({
        where:{assetId:asset.id,grandPrixId:gp.id},
        orderBy:{recordedAt:'desc'}
      });

      if (!latest || Number(latest.price) !== a.price) {
        await prisma.priceHistory.create({
          data:{assetId:asset.id,grandPrixId:gp.id,price:a.price,source}
        });
        pricesAdded++;
      }
    }

    return NextResponse.json({
      ok:true,
      season,
      round,
      imported:assets.length,
      created,
      updated,
      pricesAdded,
      source
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Market import failed'}, {status:400});
  }
}
