import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeFantasyTotals} from '../src/lib/fantasy-total-archive';
import type {ArchivedRace} from '../src/lib/race-archive';
const race={year:2025,round:1,drivers:[{code:'A',team:'X'},{code:'B',team:'X'}]} as ArchivedRace;
const asset=(code:string,type:'DRIVER'|'CONSTRUCTOR',points:number)=>({type,raw:{abbreviation:code,value:'99.9M',races:[{round:'1',raceName:'Australia',totalPoints:points}]}});
const assets=[asset('A','DRIVER',0),asset('B','DRIVER',-20),asset('XX','CONSTRUCTOR',10)];
const options={throughRound:1,teamCodes:{X:'XX'},roundNames:{1:'Australia'}};
test('played zero/negative totals survive without introducing current prices or fake breakdowns',()=>{
 const rows=normalizeFantasyTotals(assets,[race],options);assert.equal(rows.length,3);assert.equal(rows[0].actualPoints,0);assert.equal(rows[1].actualPoints,-20);assert.ok(!('priceBefore' in rows[0]));assert.ok(!('race' in rows[0]));
});
test('roster excludes inactive placeholders and historical team overrides current team',()=>{
 const rows=normalizeFantasyTotals([...assets,{...asset('C','DRIVER',0),raw:{...asset('C','DRIVER',0).raw,team:'Other'}}],[race],options);assert.equal(rows.length,3);assert.equal(rows[0].team,'XX');
});
test('duplicate rounds, missing active labels, ambiguous names and nonnumeric totals are rejected',()=>{
 assert.throws(()=>normalizeFantasyTotals([{...assets[0],raw:{...assets[0].raw,races:[...assets[0].raw.races,...assets[0].raw.races]}},...assets.slice(1)],[race],options));
 assert.throws(()=>normalizeFantasyTotals(assets.slice(1),[race],options));
 assert.throws(()=>normalizeFantasyTotals(assets,[race],{...options,roundNames:{1:'China'}}));
 assert.throws(()=>normalizeFantasyTotals([{...assets[0],raw:{...assets[0].raw,races:[{round:'1',raceName:'Australia',totalPoints:null}]}},...assets.slice(1)],[race],options));
});
test('future snapshot rows are excluded by the explicit completed-round cutoff',()=>{
 assert.equal(normalizeFantasyTotals(assets,[race,{...race,round:2}],options).length,3);
});
import {repairFantasy2025CountryRounds} from '../src/lib/fantasy-total-archive';
const prior={abbreviation:'A',races:[{round:'6',raceName:'United States',totalPoints:10},{round:'7',raceName:'Italy',totalPoints:20}]};
const latest={abbreviation:'A',races:[{round:'16',raceName:'Italy',totalPoints:20},{round:'16',raceName:'Italy',totalPoints:40},{round:'22',raceName:'United States',totalPoints:10},{round:'22',raceName:'United States',totalPoints:30},{round:'22',raceName:'United States',totalPoints:0}]};
test('documented country collisions recover chronological occurrences and match earlier anchors',()=>{
 const repaired=repairFantasy2025CountryRounds(latest,prior);
 assert.deepEqual(repaired.raw.races.map((r:any)=>[Number(r.round),r.totalPoints]),[[6,10],[7,20],[16,40],[19,30],[22,0]]);assert.equal(repaired.anchorsChecked,2);
});
test('lossy team-swap records stay missing instead of selecting a convenient country result',()=>{
 const repaired=repairFantasy2025CountryRounds({...latest,teamSwap:true,races:[latest.races[0],latest.races[2]]},prior);
 assert.deepEqual(repaired.raw.races.map((r:any)=>Number(r.round)),[6,7]);assert.deepEqual(repaired.unknownRounds,[16,19,22]);
});
test('changed anchors or unexplained country occurrence counts reject recovery',()=>{
 assert.throws(()=>repairFantasy2025CountryRounds({...latest,races:[...latest.races.slice(0,2),{...latest.races[2],totalPoints:999},...latest.races.slice(3)]},prior));
 assert.throws(()=>repairFantasy2025CountryRounds({...latest,races:[latest.races[0],latest.races[2]]},prior));
});
test('only explicitly audited missing labels may be omitted',()=>{
 const partial=normalizeFantasyTotals(assets.slice(1),[race],{...options,allowedMissing:new Set(['2025:1:DRIVER:A'])});assert.equal(partial.length,2);
 assert.throws(()=>normalizeFantasyTotals(assets.slice(1),[race],{...options,allowedMissing:new Set(['2025:1:DRIVER:B'])}));
});
