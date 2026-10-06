import {driverWeekendPoints,type DriverSprintInput} from './fantasy-scoring';

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
  sprintStartPosition: number | null;
  sprintFinishPosition: number | null;
  sprintFastestLap: boolean;
  sprintOvertakes: number;
  sprintDnf: boolean;
  raceStartPosition: number | null;
  raceFinishPosition: number | null;
  fastestLap: boolean;
  overtakes: number;
  positionsChanged: number;
  overtakeDataQuality: 'openf1-beta';
  dnf: boolean;
  knownFantasyBreakdown:{
    qualifying:number;
    sprint:number;
    raceExcludingDotD:number;
    totalExcludingDotD:number;
  };
};

export async function buildFantasyWeekendInputs(meetingKey: number) {
  const sessions = await openF1('sessions', { meeting_key: meetingKey });
  const race = sessions.find((s) => s.session_name === 'Race');
  const qualifying = sessions.find((s) => s.session_name === 'Qualifying');
  const sprint = sessions.find((s) => s.session_name === 'Sprint');
  if (!race || !qualifying) throw new Error('Race or Qualifying session missing');

  const raceKey = Number(race.session_key);
  const qualifyingKey = Number(qualifying.session_key);
  const sprintKey = sprint?Number(sprint.session_key):null;
  const [drivers, raceResults, qualifyingResults, laps, overtakes, sprintResults, sprintLaps, sprintOvertakes] = await Promise.all([
    openF1('drivers', { session_key: raceKey }),
    openF1('session_result', { session_key: raceKey }),
    openF1('session_result', { session_key: qualifyingKey }),
    openF1('laps', { session_key: raceKey }),
    openF1('overtakes', { session_key: raceKey }),
    sprintKey?openF1('session_result',{session_key:sprintKey}):Promise.resolve([]),
    sprintKey?openF1('laps',{session_key:sprintKey}):Promise.resolve([]),
    sprintKey?openF1('overtakes',{session_key:sprintKey}):Promise.resolve([]),
  ]);

  const fastestByDriver = new Map<number, number>();
  for (const lap of laps) {
    const driver = Number(lap.driver_number);
    const duration = Number(lap.lap_duration);
    if (!driver || !Number.isFinite(duration)) continue;
    const previous = fastestByDriver.get(driver);
    if (previous == null || duration < previous) fastestByDriver.set(driver, duration);
  }
  const fastest = fastestByDriver.size?Math.min(...fastestByDriver.values()):Infinity;
  const sprintFastestByDriver = new Map<number,number>();
  for(const lap of sprintLaps){
    const driver=Number(lap.driver_number),duration=Number(lap.lap_duration);
    if(!driver||!Number.isFinite(duration))continue;
    const previous=sprintFastestByDriver.get(driver);
    if(previous==null||duration<previous)sprintFastestByDriver.set(driver,duration);
  }
  const sprintFastest=sprintFastestByDriver.size?Math.min(...sprintFastestByDriver.values()):Infinity;

  return drivers.map((driver) => {
    const number = Number(driver.driver_number);
    const raceResult = raceResults.find((r) => Number(r.driver_number) === number);
    const qualifyingResult = qualifyingResults.find((r) => Number(r.driver_number) === number);
    const sprintResult = sprintResults.find((r) => Number(r.driver_number) === number);
    const qualifyingPosition=qualifyingResult?.position==null?null:Number(qualifyingResult.position);
    const raceStartPosition=raceResult?.grid_position==null?null:Number(raceResult.grid_position);
    const raceFinishPosition=raceResult?.position==null?null:Number(raceResult.position);
    const dnf=Boolean(raceResult?.dnf||raceResult?.dns||raceResult?.dsq);
    const raceOvertakes=overtakes.filter((o)=>Number(o.overtaking_driver_number)===number).length;
    const sprintDnf=Boolean(sprintResult?.dnf||sprintResult?.dns||sprintResult?.dsq);
    const sprintInput:DriverSprintInput|null=sprintKey?{
      startPosition:sprintResult?.grid_position==null?null:Number(sprintResult.grid_position),
      finishPosition:sprintResult?.position==null?null:Number(sprintResult.position),
      classified:!sprintDnf,
      overtakes:sprintOvertakes.filter((o)=>Number(o.overtaking_driver_number)===number).length,
      fastestLap:sprintFastestByDriver.get(number)===sprintFastest,
    }:null;
    const known=driverWeekendPoints(
      {position:qualifyingPosition,noTime:qualifyingPosition==null},
      {startPosition:raceStartPosition,finishPosition:raceFinishPosition,classified:!dnf,overtakes:raceOvertakes,fastestLap:fastestByDriver.get(number)===fastest,driverOfTheDay:false},
      sprintInput
    );
    return {
      code: String(driver.name_acronym ?? ''),
      driverNumber: number,
      teamName: String(driver.team_name ?? ''),
      qualifyingPosition,
      sprintStartPosition:sprintInput?.startPosition??null,
      sprintFinishPosition:sprintInput?.finishPosition??null,
      sprintFastestLap:Boolean(sprintInput?.fastestLap),
      sprintOvertakes:sprintInput?.overtakes??0,
      sprintDnf,
      raceStartPosition,
      raceFinishPosition,
      fastestLap: fastestByDriver.get(number) === fastest,
      overtakes: raceOvertakes,
      positionsChanged:!dnf&&raceStartPosition!=null&&raceFinishPosition!=null?raceStartPosition-raceFinishPosition:0,
      overtakeDataQuality: 'openf1-beta',
      dnf,
      knownFantasyBreakdown:{
        qualifying:known.qualifying,
        sprint:known.sprint,
        raceExcludingDotD:known.race,
        totalExcludingDotD:known.total,
      },
    } satisfies WeekendDriverInput;
  });
}
