import assert from 'node:assert/strict';
import {test} from 'node:test';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
const drivers=Array.from({length:20},(_,i)=>({code:'D'+i,team:'T'+Math.floor(i/2),baselineXPts:10,recentScores:[10]}));
const constructors=Array.from({length:10},(_,i)=>({code:'T'+i,baselineXPts:20}));
const options={sprint:true,simulations:2000,seed:987};
test('absent sprint pace preserves seeded default',()=>assert.deepEqual(simulateComponentWeekend(drivers,constructors,options),simulateComponentWeekend(drivers,constructors,{...options,sprintPace:undefined})));
test('sprint pace cannot change a non-sprint forecast',()=>assert.deepEqual(simulateComponentWeekend(drivers,constructors,{...options,sprint:false}),simulateComponentWeekend(drivers,constructors,{...options,sprint:false,sprintPace:{D0:100}})));
test('stronger pre-lock sprint pace changes sprint outcomes without changing qualifying or main-race scores',()=>{const base=simulateComponentWeekend(drivers,constructors,options),changed=simulateComponentWeekend(drivers,constructors,{...options,sprintPace:Object.fromEntries(drivers.map((d,i)=>[d.code,i===0?100:0]))});assert.ok(changed.drivers[0].sprint>base.drivers[0].sprint+3);for(const d of changed.drivers){const b=base.drivers.find(v=>v.code===d.code)!;assert.equal(d.qualifying,b.qualifying);assert.equal(d.raceFinish,b.raceFinish);assert.equal(d.positions,b.positions)}});
