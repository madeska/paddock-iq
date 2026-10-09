import assert from 'node:assert/strict';
import {test} from 'node:test';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
import {calibrateComponents} from '../src/lib/component-calibration';
const drivers=Array.from({length:20},(_,i)=>({code:'D'+i,team:'T'+Math.floor(i/2),baselineXPts:10,recentScores:[10]}));
const constructors=Array.from({length:10},(_,i)=>({code:'T'+i,baselineXPts:20}));
const calibration=calibrateComponents([],{season:2026,round:1});calibration.driverSessions=1;
calibration.globalDriverRates.dnfProbability=0;calibration.globalDriverRates.sprintDnfProbability=0;calibration.globalDriverRates.noTimeProbability=0;
const options={sprint:true,simulations:500,seed:234,calibration,calibrationMode:'reliability-dotd-pits' as const};
test('zero shared correlation preserves the existing seeded simulation exactly',()=>{
 assert.deepEqual(simulateComponentWeekend(drivers,constructors,options),simulateComponentWeekend(drivers,constructors,{...options,rankingCorrelation:0} as any));
});
test('fully shared form removes artificial race position changes for equal-strength classified drivers',()=>{
 const result=simulateComponentWeekend(drivers,constructors,{...options,rankingCorrelation:1} as any);
 for(const driver of result.drivers)assert.equal(driver.positions,0);
 const current=simulateComponentWeekend(drivers,constructors,options);
 assert.ok(result.drivers.reduce((sum,d)=>sum+d.overtakes,0)<current.drivers.reduce((sum,d)=>sum+d.overtakes,0));
});
test('shared form preserves qualifying marginal points for exchangeable drivers',()=>{
 const result=simulateComponentWeekend(drivers,constructors,{...options,simulations:3000,rankingCorrelation:.6} as any);
 for(const driver of result.drivers)assert.ok(Math.abs(driver.qualifying-2.75)<.3);
});
test('invalid ranking correlation is rejected',()=>{
 for(const rankingCorrelation of [-1,1.01,NaN])assert.throws(()=>simulateComponentWeekend(drivers,constructors,{...options,rankingCorrelation} as any));
});
test('shared form preserves session marginals for unequal-strength drivers',()=>{
 const unequal=drivers.map((driver,i)=>({...driver,baselineXPts:2+i*2}));
 const independent=simulateComponentWeekend(unequal,constructors,{...options,sprint:false,simulations:5000});
 const joint=simulateComponentWeekend(unequal,constructors,{...options,sprint:false,simulations:5000,rankingCorrelation:.75} as any);
 for(const driver of joint.drivers){const original=independent.drivers.find(d=>d.code===driver.code)!;assert.ok(Math.abs(driver.qualifying-original.qualifying)<.25,driver.code+' qualifying marginal changed');}
});
test('optional race pace ranks classified finishers independently from overall xPts',()=>{
 const result=simulateComponentWeekend(drivers,constructors,{...options,sprint:false,simulations:100,racePace:Object.fromEntries(drivers.map((d,i)=>[d.code,20-i])),raceNoise:.001} as any);
 assert.equal(result.drivers.find(d=>d.code==='D0')!.raceFinish,25);
 assert.equal(result.drivers.find(d=>d.code==='D19')!.raceFinish,0);
});
