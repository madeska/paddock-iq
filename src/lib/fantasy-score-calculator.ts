export type DriverWeekendInput={
 qualifyingPosition:number|null;raceStartPosition:number|null;raceFinishPosition:number|null;
 overtakes:number;dnf?:boolean;dsq?:boolean;noQualifyingTime?:boolean;fastestLap?:boolean;driverOfDay?:boolean;
};
export type FantasyScoringConfig={fastestLapPoints:number;driverOfDayPoints:number;dnfPoints:number;overtakePoints:number;positionChangePoints:number};
export const OFFICIAL_2026_CANDIDATE:FantasyScoringConfig={fastestLapPoints:10,driverOfDayPoints:10,dnfPoints:-20,overtakePoints:1,positionChangePoints:1};
const finish=[0,25,18,15,12,10,8,6,4,2,1];
export function scoreDriverWeekend(i:DriverWeekendInput,c=OFFICIAL_2026_CANDIDATE){
 const qualifying=i.noQualifyingTime?-5:(i.qualifyingPosition&&i.qualifyingPosition<=10?11-i.qualifyingPosition:0);
 if(i.dnf||i.dsq)return {qualifying,race:c.dnfPoints,total:qualifying+c.dnfPoints};
 const raceFinish=i.raceFinishPosition&&i.raceFinishPosition<=10?finish[i.raceFinishPosition]:0;
 const change=i.raceStartPosition&&i.raceFinishPosition?(i.raceStartPosition-i.raceFinishPosition)*c.positionChangePoints:0;
 const race=raceFinish+change+i.overtakes*c.overtakePoints+(i.fastestLap?c.fastestLapPoints:0)+(i.driverOfDay?c.driverOfDayPoints:0);
 return {qualifying,race,total:qualifying+race};
}
export function scoreConstructorWeekend(driverTotals:[number,number],qualifyingBonus:number,pitStopPoints:number){
 return driverTotals[0]+driverTotals[1]+qualifyingBonus+pitStopPoints;
}
