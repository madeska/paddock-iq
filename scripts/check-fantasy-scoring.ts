import {predictFantasyPrice} from '../src/lib/fantasy-price-model';
import {
 qualifyingDriverPoints,
 raceDriverPoints,
 sprintDriverPoints,
 constructorQualifyingTeamwork,
 pitStopTimePoints,
 constructorRacePoints,
} from '../src/lib/fantasy-scoring';

function eq(actual:number,expected:number,label:string){
 if(actual!==expected)throw new Error(label+': expected '+expected+', got '+actual);
}

eq(qualifyingDriverPoints({position:1}),10,'quali pole');
eq(qualifyingDriverPoints({position:10}),1,'quali P10');
eq(qualifyingDriverPoints({position:11}),0,'quali P11');
eq(qualifyingDriverPoints({position:null,noTime:true}),-5,'quali no time');

eq(raceDriverPoints({startPosition:15,finishPosition:7,classified:true,overtakes:6}),20,'race finish + positions + overtakes');
eq(raceDriverPoints({startPosition:3,finishPosition:7,classified:true,overtakes:1,fastestLap:true}),13,'race losses + FL');
eq(raceDriverPoints({startPosition:5,finishPosition:null,classified:false,overtakes:8}),-20,'race DNF override');
eq(raceDriverPoints({startPosition:4,finishPosition:1,classified:true,overtakes:3,fastestLap:true,driverOfTheDay:true}),51,'race win full bonuses');

eq(sprintDriverPoints({startPosition:12,finishPosition:6,classified:true,overtakes:5,fastestLap:true}),19,'sprint scoring');
eq(sprintDriverPoints({startPosition:2,finishPosition:null,classified:false,overtakes:2}),-10,'sprint DNF override');

eq(constructorQualifyingTeamwork(0,0),-1,'neither Q2');
eq(constructorQualifyingTeamwork(1,0),1,'one Q2');
eq(constructorQualifyingTeamwork(2,0),3,'both Q2');
eq(constructorQualifyingTeamwork(2,1),5,'one Q3');
eq(constructorQualifyingTeamwork(2,2),10,'both Q3');

eq(pitStopTimePoints(3.01),0,'pit >=3');
eq(pitStopTimePoints(2.75),2,'pit 2.50-2.99');
eq(pitStopTimePoints(2.30),5,'pit 2.20-2.49');
eq(pitStopTimePoints(2.10),10,'pit 2.00-2.19');
eq(pitStopTimePoints(1.99),20,'pit under 2');

eq(constructorRacePoints({
 driverRacePointsExcludingDotD:[25,15],
 bestPitStopSeconds:1.95,
 fastestPitStop:true,
 worldRecordPitStop:false,
}),65,'constructor race aggregation');

console.log('Official 2026 Fantasy scoring checks passed');

const atCeiling=predictFantasyPrice({currentPrice:34,previousFantasyPoints:[80,80],expectedPoints:100,pointsStdDev:5});
eq(atCeiling.effectiveDeltas.smallRise,0,'price ceiling small rise');
eq(atCeiling.effectiveDeltas.maxRise,0,'price ceiling max rise');
eq(atCeiling.expectedDelta<=0?1:0,1,'price ceiling expected delta');
const nearCeiling=predictFantasyPrice({currentPrice:33.9,previousFantasyPoints:[80,80],expectedPoints:100,pointsStdDev:5});
eq(nearCeiling.effectiveDeltas.smallRise,0.1,'near ceiling small rise cap');
eq(nearCeiling.effectiveDeltas.maxRise,0.1,'near ceiling max rise cap');
const atFloor=predictFantasyPrice({currentPrice:3,previousFantasyPoints:[-20,-20],expectedPoints:-20,pointsStdDev:5});
eq(atFloor.effectiveDeltas.maxFall,0,'price floor max fall');
eq(atFloor.effectiveDeltas.smallFall,0,'price floor small fall');
