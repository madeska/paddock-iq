import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseRaceArchive} from '../src/lib/race-archive';
const race={year:2025,session_key:9693,meeting_key:1254,date_start:'2025-03-16T06:00:00Z',circuit_short_name:'Melbourne'};
const qualifying={year:2025,session_key:9689,meeting_key:1254,date_start:'2025-03-15T06:00:00Z'};
const names=[{driver_number:4,name_acronym:'NOR',team_name:'McLaren'},{driver_number:1,name_acronym:'VER',team_name:'Red Bull Racing'}];
const grid=[{driver_number:4,position:1},{driver_number:1,position:2}];
const finish=[{driver_number:4,position:1,dnf:false,dns:false,dsq:false},{driver_number:1,position:null,dnf:true,dns:false,dsq:false}];
const q=[{driver_number:4,position:1,dnf:false,dns:false,dsq:false},{driver_number:1,position:2,dnf:false,dns:false,dsq:false}];
test('archive preserves actual grid and failure flags without fabricated finishing places',()=>{
 const archive=parseRaceArchive({race,qualifying,names,grid,finish,qualifyingResult:q},1);
 assert.equal(archive.drivers[0].code,'NOR');assert.equal(archive.drivers[1].finish,null);assert.equal(archive.drivers[1].dnf,true);
});
test('pit-lane or missing grid is explicit rather than a fictional grid position',()=>{
 const archive=parseRaceArchive({race,qualifying,names,grid:[grid[0],{driver_number:1,position:'PL'}],finish,qualifyingResult:q},1);
 assert.equal(archive.drivers[1].grid,null);assert.equal(archive.drivers[1].pitLane,true);
});
test('duplicate identities, ambiguous failure flags and missing successful finish are rejected',()=>{
 assert.throws(()=>parseRaceArchive({race,qualifying,names,grid:[grid[0],grid[0]],finish,qualifyingResult:q},1));
 assert.throws(()=>parseRaceArchive({race,qualifying,names,grid,finish:[{...finish[0],dnf:undefined},finish[1]],qualifyingResult:q},1));
 assert.throws(()=>parseRaceArchive({race,qualifying,names,grid,finish:[{...finish[0],position:null},finish[1]],qualifyingResult:q},1));
});
test('a qualifying session must precede the same-year and same-meeting race',()=>{
 for(const changed of [{...qualifying,meeting_key:999},{...qualifying,year:2026},{...qualifying,date_start:'2025-03-17T00:00:00Z'}])assert.throws(()=>parseRaceArchive({race,qualifying:changed,names,grid,finish,qualifyingResult:q},1));
});
test('missing provider result rows remain unknown instead of being labeled DNS',()=>{
 const archive=parseRaceArchive({race,qualifying,names,grid,finish:[finish[0]],qualifyingResult:q},1);
 const unknown=archive.drivers.find(d=>d.code==='VER')!;assert.equal(unknown.resultKnown,false);assert.equal(unknown.dnf,null);assert.equal(unknown.dns,null);
});
test('a missing qualifying result stays unknown while known race results are retained',()=>{
 const archive=parseRaceArchive({race,qualifying,names,grid,finish,qualifyingResult:[q[0]]},1);
 const unknown=archive.drivers.find(d=>d.code==='VER')!;assert.equal(unknown.qualifyingPosition,null);assert.equal(unknown.qualifyingDns,null);assert.equal(unknown.resultKnown,true);
});
