import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitArchivedPace} from '../src/lib/archive-pace';
import type {ArchivedRace} from '../src/lib/race-archive';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
import {calibrateComponents} from '../src/lib/component-calibration';
const race:ArchivedRace={year:2025,round:1,sessionKey:1,qualifyingSessionKey:2,meetingKey:1,dateStart:'2025-03-16T00:00:00Z',circuit:'A',drivers:[{code:'NOR',number:4,team:'MCL',grid:2,pitLane:false,resultKnown:true,finish:1,dnf:false,dns:false,dsq:false,qualifyingPosition:1,qualifyingDsq:false,qualifyingDns:false},{code:'VER',number:1,team:'RBR',grid:1,pitLane:false,resultKnown:true,finish:null,dnf:true,dns:false,dsq:false,qualifyingPosition:2,qualifyingDsq:false,qualifyingDns:false}]};
test('archive pace excludes target/future races and other years',()=>{
 const a=fitArchivedPace([race],{year:2025,round:2});assert.deepEqual(a,fitArchivedPace([race,{...race,round:2},{...race,round:8},{...race,year:2026}],{year:2025,round:2}));
});
test('physical failures contribute reliability without fabricated finish ranks or gains',()=>{
 const model=fitArchivedPace([race],{year:2025,round:2});assert.equal(model.racePace.VER,0);assert.equal(model.progress.VER,0);assert.ok(model.failureProbability.VER>model.failureProbability.NOR);assert.ok(model.racePace.NOR>0);
});
test('a known race grid overrides race starting positions without overriding qualifying points',()=>{
 const drivers=Array.from({length:20},(_,i)=>({code:'D'+i,team:'T',baselineXPts:10,recentScores:[10]}));
 const calibration=calibrateComponents([],{season:2025,round:2});calibration.driverSessions=1;calibration.globalDriverRates.dnfProbability=0;calibration.globalDriverRates.noTimeProbability=0;
 const options={sprint:false,simulations:200,calibration,qualifyingPace:Object.fromEntries(drivers.map((d,i)=>[d.code,20-i])),qualifyingNoise:.001,raceProgress:{},raceNoise:0,raceStartingGrid:Object.fromEntries(drivers.map((d,i)=>[d.code,20-i])),includeRankDiagnostics:true};
 const result=simulateComponentWeekend(drivers,[],options as any);
 assert.equal(result.drivers.find(d=>d.code==='D19')!.raceFinish,25);assert.equal(result.drivers.find(d=>d.code==='D0')!.qualifying,10);
 assert.equal((result as any).rankDiagnostics.find((d:any)=>d.code==='D0').expectedStart,20);
 assert.equal((result as any).rankDiagnostics.find((d:any)=>d.code==='D0').expectedClassifiedFinish,20);
 assert.throws(()=>simulateComponentWeekend(drivers,[],{...options,raceStartingGrid:{D0:1}} as any));
});
test('unknown result rows do not become successful reliability observations',()=>{
 const unknown={...race.drivers[1],resultKnown:false,dnf:null,dns:null,dsq:null,finish:null};
 const base=fitArchivedPace([race],{year:2025,round:3});const extended=fitArchivedPace([race,{...race,round:2,drivers:[unknown]}],{year:2025,round:3});
 assert.equal(base.globalFailureProbability,extended.globalFailureProbability);assert.equal(base.failureProbability.VER,extended.failureProbability.VER);assert.equal(extended.racePace.VER,0);
});
