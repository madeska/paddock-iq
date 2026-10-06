export const QUALIFYING_POINTS=[10,9,8,7,6,5,4,3,2,1] as const;
export const RACE_FINISH_POINTS=[25,18,15,12,10,8,6,4,2,1] as const;
export const SPRINT_FINISH_POINTS=[8,7,6,5,4,3,2,1] as const;

export type DriverQualifyingInput={
 position:number|null;
 noTime?:boolean;
};

export type DriverRaceInput={
 startPosition:number|null;
 finishPosition:number|null;
 classified:boolean;
 overtakes:number;
 fastestLap?:boolean;
 driverOfTheDay?:boolean;
};

export type DriverSprintInput={
 startPosition:number|null;
 finishPosition:number|null;
 classified:boolean;
 overtakes:number;
 fastestLap?:boolean;
};

export type DriverScoreBreakdown={
 qualifying:number;
 sprint:number;
 race:number;
 total:number;
};

const positionalPoints=(position:number|null,table:readonly number[])=>{
 if(position==null||position<1)return 0;
 return position<=table.length?table[position-1]:0;
};

export function qualifyingDriverPoints(input:DriverQualifyingInput){
 if(input.noTime||input.position==null)return -5;
 return positionalPoints(input.position,QUALIFYING_POINTS);
}

function positionsDelta(start:number|null,finish:number|null,classified:boolean){
 if(!classified||start==null||finish==null)return 0;
 return start-finish;
}

export function sprintDriverPoints(input:DriverSprintInput){
 if(!input.classified)return -10;
 return positionalPoints(input.finishPosition,SPRINT_FINISH_POINTS)
  +positionsDelta(input.startPosition,input.finishPosition,true)
  +Math.max(0,input.overtakes)
  +(input.fastestLap?5:0);
}

export function raceDriverPoints(input:DriverRaceInput){
 if(!input.classified)return -20;
 return positionalPoints(input.finishPosition,RACE_FINISH_POINTS)
  +positionsDelta(input.startPosition,input.finishPosition,true)
  +Math.max(0,input.overtakes)
  +(input.fastestLap?10:0)
  +(input.driverOfTheDay?10:0);
}

export function driverWeekendPoints(
 qualifying:DriverQualifyingInput,
 race:DriverRaceInput,
 sprint?:DriverSprintInput|null
):DriverScoreBreakdown{
 const qualifyingPoints=qualifyingDriverPoints(qualifying);
 const sprintPoints=sprint?sprintDriverPoints(sprint):0;
 const racePoints=raceDriverPoints(race);
 return {qualifying:qualifyingPoints,sprint:sprintPoints,race:racePoints,total:qualifyingPoints+sprintPoints+racePoints};
}

export function constructorQualifyingTeamwork(q2Count:number,q3Count:number){
 if(q3Count>=2)return 10;
 if(q3Count===1)return 5;
 if(q2Count>=2)return 3;
 if(q2Count===1)return 1;
 return -1;
}

export function constructorQualifyingPoints(driverPoints:[number,number],q2Count:number,q3Count:number,dsqDrivers=0){
 return driverPoints[0]+driverPoints[1]+constructorQualifyingTeamwork(q2Count,q3Count)-5*Math.max(0,dsqDrivers);
}

export function constructorSprintPoints(driverPoints:[number,number],dsqDrivers=0){
 return driverPoints[0]+driverPoints[1]-10*Math.max(0,dsqDrivers);
}

export function pitStopTimePoints(bestStopSeconds:number|null){
 if(bestStopSeconds==null||!Number.isFinite(bestStopSeconds)||bestStopSeconds>=3)return 0;
 if(bestStopSeconds<2)return 20;
 if(bestStopSeconds<2.2)return 10;
 if(bestStopSeconds<2.5)return 5;
 return 2;
}

export function constructorRacePoints(input:{
 driverRacePointsExcludingDotD:[number,number];
 bestPitStopSeconds:number|null;
 fastestPitStop?:boolean;
 worldRecordPitStop?:boolean;
 dsqDrivers?:number;
}){
 const pit=pitStopTimePoints(input.bestPitStopSeconds)
  +(input.fastestPitStop?5:0)
  +(input.worldRecordPitStop?15:0);
 return input.driverRacePointsExcludingDotD[0]+input.driverRacePointsExcludingDotD[1]
  +pit-20*Math.max(0,input.dsqDrivers??0);
}
