import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
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
        error: error instanceof Error ? error.message : 'Database connection failed',
      },
      { status: 500 },
    );
  }
}
