import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import {authorizeMaintenanceRequest} from '../../../../lib/auth';

export async function GET(request:Request) {
  const denied=await authorizeMaintenanceRequest(request);if(denied)return denied;
  try {
    const [users, teams, assets, snapshots, prices, predictions] = await Promise.all([
      prisma.user.count(),
      prisma.fantasyTeam.count(),
      prisma.asset.count(),
      prisma.teamSnapshot.count(),
      prisma.priceHistory.count(),
      prisma.assetPrediction.count(),
    ]);

    return NextResponse.json({
      ok: true,
      counts: { users, teams, assets, snapshots, prices, predictions },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database connection unavailable.',
      },
      { status: 500 },
    );
  }
}
