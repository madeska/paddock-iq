type OpenF1Row = Record<string, unknown>;

function rows(value: unknown): OpenF1Row[] {
  return Array.isArray(value) ? value as OpenF1Row[] : [];
}

async function openF1(resource: string, params: Record<string, number>) {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
  const response = await fetch(`https://api.openf1.org/v1/${resource}?${query}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`OpenF1 ${resource}: ${response.status}`);
  return rows(await response.json());
}

export type WeekendDriverInput = {
  code: string;
  driverNumber: number;
  teamName: string;
  qualifyingPosition: number | null;
  raceStartPosition: number | null;
  raceFinishPosition: number | null;
  fastestLap: boolean;
  overtakes: number;
  overtakeDataQuality: 'openf1-beta';
  dnf: boolean;
};

export async function buildFantasyWeekendInputs(meetingKey: number) {
  const sessions = await openF1('sessions', { meeting_key: meetingKey });
  const race = sessions.find((s) => s.session_name === 'Race');
  const qualifying = sessions.find((s) => s.session_name === 'Qualifying');
  if (!race || !qualifying) throw new Error('Race or Qualifying session missing');

  const raceKey = Number(race.session_key);
  const qualifyingKey = Number(qualifying.session_key);
  const [drivers, raceResults, qualifyingResults, laps, overtakes] = await Promise.all([
    openF1('drivers', { session_key: raceKey }),
    openF1('session_result', { session_key: raceKey }),
    openF1('session_result', { session_key: qualifyingKey }),
    openF1('laps', { session_key: raceKey }),
    openF1('overtakes', { session_key: raceKey }),
  ]);

  const fastestByDriver = new Map<number, number>();
  for (const lap of laps) {
    const driver = Number(lap.driver_number);
    const duration = Number(lap.lap_duration);
    if (!driver || !Number.isFinite(duration)) continue;
    const previous = fastestByDriver.get(driver);
    if (previous == null || duration < previous) fastestByDriver.set(driver, duration);
  }
  const fastest = Math.min(...fastestByDriver.values());

  return drivers.map((driver) => {
    const number = Number(driver.driver_number);
    const raceResult = raceResults.find((r) => Number(r.driver_number) === number);
    const qualifyingResult = qualifyingResults.find((r) => Number(r.driver_number) === number);
    return {
      code: String(driver.name_acronym ?? ''),
      driverNumber: number,
      teamName: String(driver.team_name ?? ''),
      qualifyingPosition: qualifyingResult?.position == null ? null : Number(qualifyingResult.position),
      raceStartPosition: raceResult?.grid_position == null ? null : Number(raceResult.grid_position),
      raceFinishPosition: raceResult?.position == null ? null : Number(raceResult.position),
      fastestLap: fastestByDriver.get(number) === fastest,
      overtakes: overtakes.filter((o) => Number(o.overtaking_driver_number) === number).length,
      overtakeDataQuality: 'openf1-beta',
      dnf: Boolean(raceResult?.dnf || raceResult?.dns || raceResult?.dsq),
    } satisfies WeekendDriverInput;
  });
}
