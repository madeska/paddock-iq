import { NextRequest, NextResponse } from 'next/server';
import { fetchFantasyPlayers, FantasyApiError } from '../../../../lib/f1-fantasy-api';

export async function GET(request:NextRequest) {
  const season = Number(request.nextUrl.searchParams.get('season') ?? 2026);
  if (!Number.isInteger(season)) return NextResponse.json({error:'Invalid season'}, {status:400});

  try {
    const players = await fetchFantasyPlayers(season);
    return NextResponse.json({
      ok:true,
      season,
      count:players.length,
      source:'official F1 Fantasy API',
      // Deliberately return a small sample until the upstream 2026 schema is verified.
      sample:players.slice(0,3),
    });
  } catch (error) {
    const status = error instanceof FantasyApiError && error.status === 401 ? 401 : 502;
    return NextResponse.json({
      ok:false,
      error:error instanceof Error ? error.message : 'F1 Fantasy sync failed',
      configured:Boolean(process.env.F1_FANTASY_TOKEN),
    }, {status});
  }
}
