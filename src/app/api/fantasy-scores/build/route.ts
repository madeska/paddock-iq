import { NextRequest, NextResponse } from 'next/server';
import { buildFantasyWeekendInputs } from '../../../../lib/fantasy-weekend-inputs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const meetingKey = Number(request.nextUrl.searchParams.get('meeting_key'));
  if (!meetingKey) return NextResponse.json({ error: 'meeting_key is required' }, { status: 400 });

  try {
    const drivers = await buildFantasyWeekendInputs(meetingKey);
    return NextResponse.json({
      meetingKey,
      complete: false,
      drivers,
      scoringRulesVersion:'official-2026',
      missingInputs: [
        'driverOfDay',
        'constructorPitStopPoints',
      ],
      note: 'Qualifying, Sprint, race result, positions gained/lost and fastest-lap scoring are reconstructed from OpenF1. Overtakes use the OpenF1 beta feed and can differ from F1 Fantasy validation. Driver of the Day and constructor pit-stop points remain explicit external inputs and are never assumed to be zero.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Weekend build failed' },
      { status: 500 }
    );
  }
}
