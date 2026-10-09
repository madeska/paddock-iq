import assert from 'node:assert/strict';
import {test} from 'node:test';
import {officialDriverTeams,usableOfficialRow,officialFantasyPoints} from '../src/lib/fantasy-official-sync';
const rows=[{PositionName:'CONSTRUCTOR',PlayerId:'29',FUllName:'Red Bull Racing',DriverTLA:'RBR',IsActive:'1'},{PositionName:'CONSTRUCTOR',PlayerId:'2636',FUllName:'Racing Bulls',DriverTLA:'RBS',IsActive:'1'},{PositionName:'DRIVER',DriverTLA:'VER',TeamId:'29',TeamName:'Red Bull Racing',IsActive:'1'},{PositionName:'DRIVER',DriverTLA:'HAD',TeamId:'29',TeamName:'Red Bull Racing',IsActive:'1'},{PositionName:'DRIVER',DriverTLA:'LIN',TeamId:'2636',TeamName:'Racing Bulls',IsActive:'1'},{PositionName:'DRIVER',DriverTLA:'LAW',TeamId:'2636',TeamName:'Racing Bulls',IsActive:'1'},{PositionName:'DRIVER',DriverTLA:'LAW',TeamId:'29',TeamName:'Red Bull Racing',IsActive:'0'}];
test('official current membership assigns Hadjar to Red Bull and Lindblad to Racing Bulls',()=>{
 const teams=officialDriverTeams(rows);assert.deepEqual(teams,{VER:'RBR',HAD:'RBR',LIN:'RB',LAW:'RB'});
});
test('historical active Lawson rows are retained regardless of current team preference',()=>{
 const team=officialDriverTeams(rows.map(r=>r.DriverTLA==='LAW'?{...r,IsActive:r.TeamId==='29'?'1':'0'}:r));assert.equal(team.LAW,'RBR');
});
test('inactive placeholders are ineligible while played zero and negative values stay valid',()=>{
 assert.equal(usableOfficialRow({PositionName:'DRIVER',IsActive:'0',GamedayPoints:'0'}),false);
 assert.equal(usableOfficialRow({PositionName:'DRIVER',IsActive:'1',GamedayPoints:'0'}),true);
 assert.equal(officialFantasyPoints('0'),0);assert.equal(officialFantasyPoints('-20'),-20);
 for(const value of [null,undefined,'',false,'bad',NaN])assert.equal(officialFantasyPoints(value),null);
});
test('conflicting active team assignments are rejected before synchronization writes',()=>{
 assert.throws(()=>officialDriverTeams([...rows,{PositionName:'DRIVER',DriverTLA:'VER',TeamId:'2636',TeamName:'Racing Bulls',IsActive:'1'}]));
});
test('duplicate active IDs for the same driver cannot overwrite scores or prices',()=>{
 assert.throws(()=>officialDriverTeams([...rows,{...rows[2],PlayerId:'other'}]));
});
import {mock} from 'node:test';
import {syncOfficialFantasyMarket} from '../src/lib/fantasy-official-sync';
import type {PrismaClient} from '@prisma/client';
test('synchronization writes active played zeros but never inactive placeholders or empty totals',async()=>{
 const prior=rows.map(r=>({...r,Value:10,GamedayPoints:r.DriverTLA==='VER'?null:r.DriverTLA==='LIN'?'0':r.DriverTLA==='LAW'?'-20':'5',IsActive:r.DriverTLA==='HAD'?'0':r.DriverTLA==='LAW'?(r.TeamId==='29'?'1':'0'):r.IsActive}));
 const current=rows.map(r=>({...r,Value:10,GamedayPoints:'0'}));const scoreWrites:any[]=[],activeWrites:string[]=[],priceWrites:any[]=[];
 const codes=[['VER','DRIVER'],['HAD','DRIVER'],['LIN','DRIVER'],['LAW','DRIVER'],['RBR','CONSTRUCTOR'],['RB','CONSTRUCTOR']];
 const fake={asset:{findMany:async()=>codes.map(([code,type])=>({id:type+':'+code,season:2026,code,type})),updateMany:async()=>({count:6}),update:async(a:any)=>{activeWrites.push(a.where.id);return{}},count:async()=>6},grandPrix:{upsert:async(a:any)=>({id:'GP'+a.create.round}),findUnique:async()=>({id:'GP15'})},priceHistory:{findFirst:async()=>null,create:async(a:any)=>{priceWrites.push(a.data);return{}},update:async()=>({})},fantasyRoundScore:{findUnique:async(a:any)=>a.where.assetId_grandPrixId.assetId==='CONSTRUCTOR:RBR'?{source:'Official F1 Fantasy completed race: feed + popup verified'}:null,upsert:async(a:any)=>{scoreWrites.push(a.create);return{}},deleteMany:async()=>{throw Error('Market sync must not delete completed current-round scores')}}} as unknown as PrismaClient;
 const fetchMock=mock.method(globalThis,'fetch',async(input:any)=>{const round=Number(String(input).match(/\/(\d+)_en\.json/)?.[1]);return new Response(JSON.stringify({Data:{Value:round===15?current:prior}}),{status:200,headers:{'content-type':'application/json'}})});
 try{const result=await syncOfficialFantasyMarket(fake,2026,15);assert.ok(!scoreWrites.some(r=>r.assetId==='CONSTRUCTOR:RBR'));assert.equal(result.driverTeams.HAD,'RBR');assert.equal(result.driverTeams.LIN,'RB');assert.ok(scoreWrites.some(r=>r.assetId==='DRIVER:LIN'&&r.points===0));assert.ok(scoreWrites.some(r=>r.assetId==='DRIVER:LAW'&&r.points===-20));assert.ok(!scoreWrites.some(r=>r.assetId==='DRIVER:HAD'));assert.ok(!scoreWrites.some(r=>r.assetId==='DRIVER:VER')); assert.ok(!scoreWrites.some(r=>r.grandPrixId==='GP15'));assert.ok(activeWrites.includes('DRIVER:HAD'));assert.ok(!priceWrites.some(r=>r.assetId==='DRIVER:HAD'&&r.grandPrixId!=='GP15'));}finally{fetchMock.mock.restore()}
});

