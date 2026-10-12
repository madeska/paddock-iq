import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {ComponentObservation} from '../src/lib/component-calibration';
import * as pace from '../src/lib/session-pace';
import practiceArchive from '../src/data/session-pace-practice-2026.json';
const history:ComponentObservation[]=[1,2,3].flatMap(round=>['A','B','C','D'].map((code,i)=>({season:2026,round,code,type:'DRIVER' as const,team:'T'+Math.floor(i/2),qualifying:{total:10-i,position:i+1,noTime:false},race:{total:30-i,failed:false,overtakes:0,fastestLap:false,dotd:false,finishPosition:i+1,positionChange:0}})));
const options={season:2026,round:4,drivers:['A','B','C','D']};
test('session pace uses classification ranks and excludes points, bonuses and future rounds',()=>{
 assert.equal(typeof pace.fitSessionPace,'function');
 const expected=pace.fitSessionPace(history,options);
 assert.ok(expected.qualifying.A>expected.qualifying.D);assert.ok(expected.race.A>expected.race.D);
 const changed=history.map(r=>({...r,qualifying:{...r.qualifying!,total:999},race:{...r.race!,total:-999,overtakes:100,dotd:true,fastestLap:true}}));
 assert.deepEqual(pace.fitSessionPace([...changed,...changed.map(r=>({...r,round:4})),...changed.map(r=>({...r,season:2025}))],options),expected);
});
test('failed race and no-time qualifying are absent observations, not last-place pace',()=>{
 const modified=history.map(r=>r.code==='A'?{...r,race:{...r.race!,failed:true,finishPosition:null},qualifying:{...r.qualifying!,noTime:true,position:null}}:r);
 const result=pace.fitSessionPace(modified,options);assert.equal(result.race.A,0);assert.equal(result.qualifying.A,0);
});
test('complete practice changes session pace while partial or duplicate classifications fall back',()=>{
 const noPractice=pace.fitSessionPace(history,options);
 const complete=pace.fitSessionPace(history,{...options,practice:new Map([['A',4],['B',3],['C',2],['D',1]])});
 assert.ok(complete.qualifying.A<noPractice.qualifying.A);assert.ok(complete.race.D>noPractice.race.D);
 assert.deepEqual(pace.fitSessionPace(history,{...options,practice:new Map([['A',4]])}),noPractice);
 assert.deepEqual(pace.fitSessionPace(history,{...options,practice:new Map([['A',1],['B',1],['C',2],['D',3]])}),noPractice);
});
test('a visibly incomplete historical field cannot create a misleading pace signal',()=>{
 const invalid=history.filter(r=>r.code!=='B');const result=pace.fitSessionPace(invalid,options);
 assert.ok(Object.values(result.qualifying).every(v=>v===0));assert.ok(Object.values(result.race).every(v=>v===0));
});
test('derived normal-weekend practice archive preserves completion before lock and unique classifications',()=>{
 assert.equal(practiceArchive.season,2026);assert.equal(practiceArchive.weekends.length,9);
 assert.match(practiceArchive.sourceArchiveSHA256,/^[a-f0-9]{64}$/);
 for(const w of practiceArchive.weekends){assert.equal(w.isSprint,false);assert.ok(w.round>=6&&w.round<=16);assert.ok(Date.parse(w.practice.startedAt)<Date.parse(w.practice.endedAt));assert.ok(Date.parse(w.practice.endedAt)<Date.parse(w.lockTime));assert.equal(new Set(w.practice.positions.map(p=>p.code)).size,w.practice.positions.length);assert.equal(new Set(w.practice.positions.map(p=>p.position)).size,w.practice.positions.length)}
});
