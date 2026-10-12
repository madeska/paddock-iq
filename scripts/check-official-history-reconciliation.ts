import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planOfficialHistoryRepair,OFFICIAL_SCORE_SOURCE,EXCLUDED_SCORE_SOURCE} from '../src/lib/official-history-reconciliation';
const stored={id:'score',code:'LAW',round:12,points:0,source:OFFICIAL_SCORE_SOURCE};
const inactive={PlayerId:'114',DriverTLA:'LAW',PositionName:'DRIVER',IsActive:0,GamedayPoints:0};
const active={...inactive,PlayerId:'116',IsActive:1,GamedayPoints:12};
const empty={GamedayId:12,IsPlayed:0,IsActive:0,StatsWise:[]};
const played={GamedayId:12,IsPlayed:1,IsActive:1,StatsWise:[{Event:'Total',Value:12}]};
const evidence=(stats:any,id='116')=>({Value:{PlayerId:id,GamedayWiseStats:[stats],FixtureWiseStats:[{GamedayId:stats.GamedayId,RaceDayWise:[{Season:'2026'}]}]}});
const run=(score=stored,rows:any[]=[inactive,active],popups:any={'114':evidence(empty,'114'),'116':evidence(played)},target=17)=>planOfficialHistoryRepair(score,rows,popups,target);
test('a generated zero is corrected only when active feed and played popup agree',()=>assert.deepEqual(run(),{action:'correct',points:12,source:OFFICIAL_SCORE_SOURCE}));
test('inactive unplayed generated zero is retained with exclusion provenance',()=>assert.deepEqual(run(stored,[inactive]),{action:'exclude',points:0,source:EXCLUDED_SCORE_SOURCE}));
test('manual and nonzero records are preserved',()=>{assert.equal(run({...stored,source:'Manual'}).action,'preserve');assert.equal(run({...stored,points:-20}).action,'preserve')});
test('genuinely played zero is preserved and verified',()=>assert.equal(run(stored,[{...active,GamedayPoints:0}],{'116':evidence({...played,StatsWise:[{Event:'Total',Value:0}]})}).action,'verify'));
test('conflicting or missing source evidence cannot authorize repairs',()=>{assert.equal(run(stored,[active],{}).action,'preserve');assert.equal(run(stored,[active],{'116':evidence({...played,StatsWise:[{Event:'Total',Value:25}]})}).action,'preserve');assert.equal(run(stored,[inactive],{'114':evidence({...empty,IsPlayed:1},'114')}).action,'preserve')});
test('duplicate active identities and missing activity flags are preserved',()=>{assert.equal(run(stored,[active,{...active,PlayerId:'other'}]).action,'preserve');assert.equal(run(stored,[{...inactive,IsActive:undefined}]).action,'preserve')});
test('target and future rounds are never inspected as training repairs',()=>{assert.equal(run({...stored,round:17}).action,'preserve');assert.equal(run({...stored,round:18}).action,'preserve')});
test('negative played correction survives and duplicate popup totals are rejected',()=>{assert.equal(run(stored,[{...active,GamedayPoints:-20}],{'116':evidence({...played,StatsWise:[{Event:'Total',Value:-20}]})}).points,-20);assert.equal(run(stored,[active],{'116':evidence({...played,StatsWise:[{Event:'Total',Value:12},{Event:'Total',Value:12}]})}).action,'preserve')});

import {reconcileOfficialHistory} from '../src/lib/official-history-reconciliation';
import type {PrismaClient} from '@prisma/client';
const candidate=(code:string)=>({id:code,points:0,source:OFFICIAL_SCORE_SOURCE,asset:{code},grandPrix:{round:12}});
function harness(candidates:any[],concurrent=false){
 const writes:any[]=[],queries:any[]=[];let transactions=0;
 const fake={fantasyRoundScore:{findMany:async(q:any)=>{queries.push(q);return candidates},updateMany:async(q:any)=>{writes.push(q);return {count:concurrent?0:1}}},$transaction:async(fn:any)=>{transactions++;return fn(fake)}};
 return {prisma:fake as unknown as PrismaClient,writes,queries,transactions:()=>transactions};
}
test('reconciliation persists provenance without deletions and restricts candidate query',async()=>{
 const h=harness([candidate('LAW')]);const result=await reconcileOfficialHistory(h.prisma,2026,17,{round:async()=>[inactive],popup:async()=>evidence(empty,'114')});
 assert.equal(result.excluded,1);assert.equal(h.transactions(),1);assert.deepEqual(h.writes[0],{where:{id:'LAW',source:OFFICIAL_SCORE_SOURCE,points:0},data:{points:0,source:EXCLUDED_SCORE_SOURCE}});
 assert.deepEqual(h.queries[0].where,{source:OFFICIAL_SCORE_SOURCE,points:0,asset:{season:2026,type:'DRIVER'},grandPrix:{season:2026,round:{lt:17}}});
});
test('dry-run never opens a write transaction',async()=>{
 const h=harness([candidate('LAW')]);const result=await reconcileOfficialHistory(h.prisma,2026,17,{round:async()=>[inactive,active],popup:async id=>evidence(id==='116'?played:empty,id)},true);
 assert.equal(result.corrected,1);assert.equal(h.writes.length,0);assert.equal(h.transactions(),0);
});
test('source failures are detected before any planned write starts',async()=>{
 const h=harness([candidate('LAW'),candidate('HAD')]);await assert.rejects(()=>reconcileOfficialHistory(h.prisma,2026,17,{round:async()=>[inactive,{...inactive,DriverTLA:'HAD',PlayerId:'11032'}],popup:async id=>{if(id==='11032')throw Error('network');return evidence(empty,id)}}));assert.equal(h.writes.length,0);assert.equal(h.transactions(),0);
});
test('a concurrently changed manual result cannot be overwritten',async()=>{
 const h=harness([candidate('LAW')],true);const result=await reconcileOfficialHistory(h.prisma,2026,17,{round:async()=>[inactive],popup:async()=>evidence(empty,'114')});assert.equal(result.concurrentChanges,1);assert.equal(result.excluded,0);
});
test('unversioned endpoints are not used for another season',async()=>{
 const h=harness([candidate('LAW')]);const result=await reconcileOfficialHistory(h.prisma,2025,17,{round:async()=>{throw Error('must not read')},popup:async()=>{throw Error('must not read')}});assert.equal(result.examined,0);assert.equal(h.queries.length,0);
});
test('popup player identity mismatch is preserved',()=>assert.equal(run(stored,[active],{'116':evidence(played,'114')}).action,'preserve'));

test('another season or missing fixture metadata cannot authorize repairs',()=>{const other=evidence(played);other.Value.FixtureWiseStats[0].RaceDayWise[0].Season='2027';assert.equal(run(stored,[active],{'116':other}).action,'preserve');assert.equal(run(stored,[active],{'116':{Value:{PlayerId:'116',GamedayWiseStats:[played]}}}).action,'preserve')});
