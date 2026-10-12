import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calibrateComponents} from '../src/lib/component-calibration';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
const drivers=Array.from({length:6},(_,i)=>({code:'D'+i,team:'C'+Math.floor(i/2),baselineXPts:30-i*3,recentScores:[-1,10]}));
function rates(race:number,sprint:number){const c=calibrateComponents([],{season:2026,round:18});c.driverSessions=1;c.globalDriverRates.dnfProbability=race;c.globalDriverRates.sprintDnfProbability=sprint;return c}
const base={scoringSeason:2026,seed:42,simulations:300,calibrationMode:'reliability-only' as const};
test('reliability-only experiment changes actual race failure probability on a normal weekend',()=>{
 const complete=simulateComponentWeekend(drivers,[],{...base,sprint:false,calibration:rates(0,0)}),failed=simulateComponentWeekend(drivers,[],{...base,sprint:false,calibration:rates(1,0)});
 assert.ok(complete.drivers.some(d=>d.raceFinish>0));assert.ok(complete.drivers.every(d=>d.dnfPenalty===0));
 assert.ok(failed.drivers.every(d=>d.raceFinish===0&&d.dnfPenalty===-20&&d.sprint===0));
});
test('normal weekends ignore sprint failure rates exactly',()=>{
 assert.deepEqual(simulateComponentWeekend(drivers,[],{...base,sprint:false,calibration:rates(.1,0)}),simulateComponentWeekend(drivers,[],{...base,sprint:false,calibration:rates(.1,1)}));
});
test('reliability-only experiment does not activate unrelated event and pit calibration',()=>{
 const first=rates(.1,.1),changed=structuredClone(first);changed.globalDriverRates.noTimeProbability=1;changed.globalDriverRates.raceOvertakesMean=100;changed.globalDriverRates.dotdWeight=100;changed.globalDriverRates.fastestLapWeight=100;changed.pitPoints={C0:[{points:1000,probability:1}]};
 assert.deepEqual(simulateComponentWeekend(drivers,[{code:'C0',baselineXPts:50}],{...base,sprint:true,calibration:first}),simulateComponentWeekend(drivers,[{code:'C0',baselineXPts:50}],{...base,sprint:true,calibration:changed}));
});
