import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitClassifiedProgress} from '../src/lib/race-progress-model';
import type {ComponentObservation} from '../src/lib/component-calibration';
const row=(code:string,start:number,finish:number,round=1)=>({season:2026,round,code,type:'DRIVER',team:'X',race:{failed:false,finishPosition:finish,positionChange:start-finish,total:0,overtakes:0,fastestLap:false,dotd:false}} as ComponentObservation);
test('retirement promotions are removed from progress among classified drivers',()=>{
 const m=fitClassifiedProgress([row('A',2,1),row('B',4,2)],{season:2026,round:2,priorStrength:0});
 assert.deepEqual(m.progress,{A:0,B:0});
});
test('reordering classified finishers yields zero-sum relative progress',()=>{
 const m=fitClassifiedProgress([row('A',2,2),row('B',4,1)],{season:2026,round:2,priorStrength:0});
 assert.deepEqual(m.progress,{A:-1,B:1});
});
test('partial fields and future sessions cannot fabricate net progress',()=>{
 const m=fitClassifiedProgress([row('A',2,1),row('B',4,2),row('C',4,1,2)],{season:2026,round:2,priorStrength:0});
 assert.equal(m.sessions,2);assert.equal(m.progress.C,undefined);
 const partial=fitClassifiedProgress([row('A',2,1),row('B',4,3)],{season:2026,round:2});assert.equal(partial.sessions,0);
});
