import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitRaceProgress} from '../src/lib/race-progress-model';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
import {calibrateComponents,type ComponentObservation} from '../src/lib/component-calibration';
const row:ComponentObservation={season:2026,round:1,code:'D0',type:'DRIVER',team:'T',race:{total:10,failed:false,finishPosition:6,positionChange:4,overtakes:2,fastestLap:false,dotd:false}};
test('progress estimates shrink classified historical position changes',()=>{
 const model=fitRaceProgress([row,{...row,round:2,race:{...row.race!,failed:true,finishPosition:null,positionChange:-20}}],{season:2026,round:3,priorStrength:1});
 assert.equal(model.progress.D0,2);assert.equal(model.sessions,1);
});
test('progress ignores target/future rounds and other seasons',()=>{
 const a=fitRaceProgress([row],{season:2026,round:2});
 assert.deepEqual(a,fitRaceProgress([row,{...row,round:2,race:{...row.race!,positionChange:20}},{...row,round:9},{...row,season:2027}],{season:2026,round:2}));
 assert.deepEqual(fitRaceProgress([],{season:2026,round:1}).progress,{});
});
const drivers=Array.from({length:20},(_,i)=>({code:'D'+i,team:'T'+Math.floor(i/2),baselineXPts:10,recentScores:[10]}));
const constructors=Array.from({length:10},(_,i)=>({code:'T'+i,baselineXPts:20}));
const calibration=calibrateComponents([],{season:2026,round:1});calibration.driverSessions=1;calibration.globalDriverRates.dnfProbability=0;calibration.globalDriverRates.noTimeProbability=0;
const options={sprint:false,simulations:300,seed:111,calibration};
test('zero progress and noise preserve the simulated grid when everyone finishes',()=>{
 const result=simulateComponentWeekend(drivers,constructors,{...options,raceProgress:{},raceNoise:0} as any);
 for(const d of result.drivers)assert.equal(d.positions,0);
});
test('race progress adjusts the sampled starting order without duplicate finishing places',()=>{
 const result=simulateComponentWeekend(drivers,constructors,{...options,raceProgress:{D0:20,D19:-20},raceNoise:0} as any);
 assert.equal(result.drivers.find(d=>d.code==='D0')!.raceFinish,25);assert.equal(result.drivers.find(d=>d.code==='D19')!.raceFinish,0);
 assert.ok(result.drivers.find(d=>d.code==='D0')!.positions>7);
 assert.ok(Math.abs(result.drivers.reduce((n,d)=>n+d.positions,0))<1e-9);
});
test('removing a non-classified driver promotes remaining grid positions exactly once',()=>{
 const retired=structuredClone(calibration);retired.drivers.D0={...retired.globalDriverRates,dnfProbability:1};
 const result=simulateComponentWeekend(drivers,constructors,{...options,calibration:retired,qualifyingPace:Object.fromEntries(drivers.map((d,i)=>[d.code,20-i])),qualifyingNoise:.001,raceProgress:{},raceNoise:0} as any);
 assert.equal(result.drivers.find(d=>d.code==='D0')!.positions,0);
 for(const d of result.drivers.filter(d=>d.code!=='D0'))assert.equal(d.positions,1);
 assert.equal(result.drivers.find(d=>d.code==='D1')!.raceFinish,25);
});
test('omitting grid-relative progress preserves the original seeded path',()=>{
 assert.deepEqual(simulateComponentWeekend(drivers,constructors,options),simulateComponentWeekend(drivers,constructors,{...options,raceProgress:undefined}));
});
test('equal projected finishing keys are randomized rather than biased by input order',()=>{
 const pair=drivers.slice(0,2);const result=simulateComponentWeekend(pair,constructors.slice(0,1),{...options,simulations:1500,qualifyingPace:{D0:10,D1:0},qualifyingNoise:.001,raceProgress:{D1:1},raceNoise:0} as any);
 for(const d of result.drivers)assert.ok(Math.abs(d.raceFinish-21.5)<.4,d.code+' tied order is biased');
});
