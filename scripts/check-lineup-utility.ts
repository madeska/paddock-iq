import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectPointsLineup,type LineupAsset} from '../src/lib/lineup-utility';
const roster:LineupAsset[]=[...Array.from({length:6},(_,i)=>({code:`D${i}`,type:'DRIVER' as const,price:10,points:i===0?20:10,boostPoints:i===1?30:0})),...Array.from({length:3},(_,i)=>({code:`C${i}`,type:'CONSTRUCTOR' as const,price:10,points:i===2?-10:20}))];
test('selects five distinct drivers, two constructors and the production boost objective',()=>{
 const selected=selectPointsLineup(roster,70)!;
 assert.equal(selected.drivers.length,5);assert.equal(selected.constructors.length,2);
 assert.equal(new Set([...selected.drivers,...selected.constructors]).size,7);
 assert.equal(selected.boost,'D1');assert.equal(selected.points,130);assert.equal(selected.cost,70);
 assert.ok(selected.drivers.includes('D0'));assert.deepEqual(selected.constructors,['C0','C1']);
});
test('respects budget cents, retains zero/negative forecasts and returns no infeasible lineup',()=>{
 const negative=roster.slice(0,5).concat(roster.slice(6,8)).map(r=>({...r,price:10.01,points:-1,boostPoints:null}));
 assert.equal(selectPointsLineup(negative,70.06),null);
 assert.equal(selectPointsLineup(negative,70.07)!.points,-8);
 assert.equal(selectPointsLineup(negative.map(r=>({...r,points:0})),70.07)!.points,0);
});
test('rejects duplicate identities and invalid numeric inputs',()=>{
 assert.throws(()=>selectPointsLineup([...roster,roster[0]],100));
 assert.throws(()=>selectPointsLineup(roster,-1));
 assert.throws(()=>selectPointsLineup(roster.map(r=>({...r,points:NaN})),100));
});
test('matches an independent omission enumeration with a binding budget',()=>{
 const input=roster.map((r,i)=>({...r,price:8+i,points:3*i-7,boostPoints:r.type==='DRIVER'?17-i:null}));
 let best=-Infinity;
 for(let omittedDriver=0;omittedDriver<6;omittedDriver++)for(let omittedConstructor=6;omittedConstructor<9;omittedConstructor++){
  const rows=input.filter((_,i)=>i!==omittedDriver&&i!==omittedConstructor);
  if(rows.reduce((s,r)=>s+r.price,0)>85)continue;
  const boost=Math.max(...rows.filter(r=>r.type==='DRIVER').map(r=>r.boostPoints!));
  best=Math.max(best,rows.reduce((s,r)=>s+r.points,0)+boost);
 }
 const selected=selectPointsLineup(input,85)!;assert.equal(selected.points,best);assert.ok(selected.cost<=85);
});
