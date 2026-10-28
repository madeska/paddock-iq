import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import {getPracticeSnapshot,type OpenF1Session} from '../src/lib/openf1-weekend';
import {fantasyRaceName} from '../src/lib/fantasy-race-calendar';
const make=(key:number,name:string,start:string,end:string):OpenF1Session=>({year:2026,meeting_key:10,session_key:key,session_name:name,session_type:name,date_start:start,date_end:end});
const sessions=[make(1,'Practice 1','2026-10-09T09:00:00Z','2026-10-09T10:00:00Z'),make(2,'Sprint Qualifying','2026-10-09T13:00:00Z','2026-10-09T14:00:00Z'),make(3,'Sprint','2026-10-10T09:00:00Z','2026-10-10T10:00:00Z')];
async function snapshot(asOf:string){const requested:string[]=[];const m=mock.method(globalThis,'fetch',async(input:any)=>{const u=String(input);requested.push(u);const value=u.includes('/sessions?')?sessions:u.includes('/drivers?')?[{driver_number:1,name_acronym:'VER'},{driver_number:4,name_acronym:'NOR'}]:u.includes('session_key=1')?[{driver_number:1,position:2},{driver_number:4,position:1}]:u.includes('session_key=2')?[{driver_number:1,position:1},{driver_number:4,position:2}]:[];return new Response(JSON.stringify(value))});try{return {value:await getPracticeSnapshot(2026,new Date('2026-10-10T09:00:00Z'),new Date(asOf)),requested}}finally{m.mock.restore()}}
test('sprint FP1 and SQ are separate pre-lock signals',async()=>{const {value}=await snapshot('2026-10-09T15:00:00Z');assert.equal(value?.positions.get('VER'),2);assert.equal(value?.sprintQualifyingPositions?.get('VER'),1);assert.equal(value?.sessionKey,1)});
test('ongoing SQ cannot enter while completed FP1 remains usable',async()=>{const {value,requested}=await snapshot('2026-10-09T13:30:00Z');assert.equal(value?.positions.get('VER'),2);assert.equal(value?.sprintQualifyingPositions?.size??0,0);assert.ok(!requested.some(u=>u.includes('/session_result?session_key=2')))});
import {getWeekendLock} from '../src/lib/openf1-weekend';
test('missing database lock resolves to sprint start with calendar/provider agreement',async()=>{const race=make(4,'Race','2026-10-11T12:00:00Z','2026-10-11T14:00:00Z');const m=mock.method(globalThis,'fetch',async(input:any)=>new Response(JSON.stringify(String(input).includes('f1fantasytools')?{races:[{roundNumber:17,name:'Singapore Grand Prix',sprint:true,start_times:{race:race.date_start,sprint:sessions[2].date_start}}]}:[...sessions,race])));try{const result=await getWeekendLock(2026,17,'Singapore GP',null);assert.equal(result?.deadline.toISOString(),'2026-10-10T09:00:00.000Z');assert.equal(result?.isSprint,true)}finally{m.mock.restore()}});

test('normal weekend lock is qualifying start; conflicting event identity fails closed',async()=>{const race=make(9,'Race','2026-10-11T12:00:00Z','2026-10-11T14:00:00Z'),qualifying=make(8,'Qualifying','2026-10-10T13:00:00Z','2026-10-10T14:00:00Z');const m=mock.method(globalThis,'fetch',async(input:any)=>new Response(JSON.stringify(String(input).includes('f1fantasytools')?{races:[{roundNumber:17,name:'Singapore Grand Prix',sprint:false,start_times:{race:race.date_start,qualifying:qualifying.date_start}}]}:[qualifying,race])));try{const result=await getWeekendLock(2026,17,'Singapore GP',null);assert.equal(result?.deadline.toISOString(),'2026-10-10T13:00:00.000Z');assert.equal(result?.isSprint,false);assert.equal(await getWeekendLock(2026,17,'United States GP',null),null)}finally{m.mock.restore()}});
test('malformed calendar or provider responses leave lock unavailable',async()=>{const m=mock.method(globalThis,'fetch',async()=>new Response('{"races":{}}'));try{assert.equal(await getWeekendLock(2026,17,'Singapore GP',null),null)}finally{m.mock.restore()}});

test('R19 legacy Mexico GP matches Mexico City calendar without accepting a different race or round',async()=>{
 const race=make(20,'Race','2026-11-01T20:00:00Z','2026-11-01T22:00:00Z'),qualifying=make(19,'Qualifying','2026-10-31T21:00:00Z','2026-10-31T22:00:00Z');
 const m=mock.method(globalThis,'fetch',async(input:any)=>Response.json(String(input).includes('f1fantasytools')?{races:[{roundNumber:19,name:'Mexico City Grand Prix',sprint:false,start_times:{race:race.date_start,qualifying:qualifying.date_start}}]}:[race,qualifying]));
 try{
  const lock=await getWeekendLock(2026,19,'Mexico GP',null);
  assert.equal(lock?.deadline.toISOString(),'2026-10-31T21:00:00.000Z');assert.equal(lock?.isSprint,false);
  assert.equal(await getWeekendLock(2026,18,'Mexico GP',null),null);
  assert.equal(await getWeekendLock(2026,19,'United States GP',null),null);
 }finally{m.mock.restore()}
});
test('every remaining 2026 imported round resolves to its independently named calendar/provider session',async()=>{
 const fixtures=[
  {round:19,name:'Mexico City Grand Prix',qualifying:'2026-10-31T21:00:00Z',race:'2026-11-01T20:00:00Z'},
  {round:20,name:'São Paulo Grand Prix',qualifying:'2026-11-07T18:00:00Z',race:'2026-11-08T17:00:00Z'},
  {round:21,name:'Las Vegas Grand Prix',qualifying:'2026-11-21T04:00:00Z',race:'2026-11-22T04:00:00Z'},
  {round:22,name:'Qatar Grand Prix',qualifying:'2026-11-28T18:00:00Z',race:'2026-11-29T16:00:00Z'},
  {round:23,name:'Abu Dhabi Grand Prix',qualifying:'2026-12-05T14:00:00Z',race:'2026-12-06T13:00:00Z'}
 ];
 const calendar={races:fixtures.map(row=>({roundNumber:row.round,name:row.name,sprint:false,start_times:{qualifying:row.qualifying,race:row.race}}))};
 const provider=fixtures.flatMap(row=>['Race','Qualifying'].map((name,i)=>({...make(row.round*10+i,name,name==='Race'?row.race:row.qualifying,name==='Race'?row.race:row.qualifying),meeting_key:row.round})));
 for(const race of fixtures){const lock=await getWeekendLock(2026,race.round,fantasyRaceName(2026,race.round),null,{calendar:async()=>calendar,sessions:async()=>provider});assert.equal(lock?.deadline.toISOString(),new Date(race.qualifying).toISOString())}
});
