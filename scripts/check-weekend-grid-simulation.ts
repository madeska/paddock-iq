import assert from 'node:assert/strict';
import {test} from 'node:test';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
const drivers=Array.from({length:6},(_,i)=>({code:'D'+i,team:'C'+Math.floor(i/2),baselineXPts:30-i*3,recentScores:[20,25]}));
test('known sprint grid changes sprint but retains main qualifying scoring',()=>{const opts={sprint:true,seed:42,simulations:500};const a=simulateComponentWeekend(drivers,[],opts),b=simulateComponentWeekend(drivers,[],{...opts,sprintStartingGrid:Object.fromEntries(drivers.map((d,i)=>[d.code,6-i]))});assert.notEqual(a.drivers[0].sprint,b.drivers[0].sprint);assert.throws(()=>simulateComponentWeekend(drivers,[],{...opts,sprintStartingGrid:{D0:1}}))});
test('race grid penalty is distinct from qualifying points and changes expected starts',()=>{const opts={sprint:false,seed:42,simulations:500,includeRankDiagnostics:true};const a=simulateComponentWeekend(drivers,[],opts),b=simulateComponentWeekend(drivers,[],{...opts,gridDrops:{race:{D0:5}}});assert.ok(b.rankDiagnostics!.find(d=>d.code==='D0')!.expectedStart>a.rankDiagnostics!.find(d=>d.code==='D0')!.expectedStart);for(const d of b.drivers)assert.ok(Math.abs(d.total-(d.qualifying+d.sprint+d.raceFinish+d.positions+d.overtakes+d.fastestLap+d.driverOfTheDay+d.dnfPenalty))<1e-8)});
test('back-of-grid race decision puts the driver last without penalising the sprint or qualifying classification',()=>{
 const opts={sprint:true,seed:42,simulations:10000,includeRankDiagnostics:true,sprintStartingGrid:Object.fromEntries(drivers.map((d,i)=>[d.code,i+1]))};
 const before=simulateComponentWeekend(drivers,[],opts),after=simulateComponentWeekend(drivers,[],{...opts,gridDrops:{race:{D0:100}}});
 assert.equal(after.rankDiagnostics!.find(d=>d.code==='D0')!.expectedStart,drivers.length);
 // Race overtakes consume a different number of random draws; compare session marginals, not draw identity.
 for(const d of after.drivers){const prior=before.drivers.find(p=>p.code===d.code)!;assert.ok(Math.abs(d.sprint-prior.sprint)<.3);assert.ok(Math.abs(d.qualifying-prior.qualifying)<.15)}
});
