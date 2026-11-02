import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withMaintenanceLease,cronAuthorized,forecastFreshness} from '../src/lib/maintenance-updates';

function store(){
 let row:any={id:'fantasy:2026',token:null,leaseUntil:new Date(0)};
 return {maintenanceState:{upsert:async()=>row,findUnique:async()=>row,updateMany:async({where,data}:any)=>{
  if(where.token!==undefined&&row.token!==where.token)return {count:0};
  if(where.leaseUntil&&row.leaseUntil>where.leaseUntil.lte)return {count:0};
  row={...row,...data};return {count:1};
 }},row:()=>row};
}
test('separate workers cannot update together, failures release the lease, and prior forecast survives',async()=>{
 const db=store();await db.maintenanceState.updateMany({where:{},data:{forecastRound:18}});let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);
 const first=withMaintenanceLease(db,async()=>{entered();await gate;return {value:'done'}});
 await ready;assert.equal((await withMaintenanceLease(db,async()=>{throw Error('must not run')})).busy,true);
 release();assert.equal((await first).value,'done');assert.equal(db.row().forecastRound,18);
 await assert.rejects(withMaintenanceLease(db,async()=>{throw Error('private host details')}));
 assert.equal(db.row().token,null);assert.equal(db.row().status,'FAILED');assert.equal(db.row().forecastRound,18);
 assert.ok(!JSON.stringify(db.row()).includes('private host'));
});
test('expired leases can be recovered and stale owners cannot release a newer lease',async()=>{
 const db=store();await db.maintenanceState.updateMany({where:{},data:{token:'dead',leaseUntil:new Date(0)}});
 await withMaintenanceLease(db,async()=>({value:1}));assert.equal(db.row().token,null);
 await withMaintenanceLease(db,async()=>{await db.maintenanceState.updateMany({where:{},data:{token:'new-owner'}});return {value:2}});
 assert.equal(db.row().token,'new-owner');
});
test('cron needs an explicit secret and bearer header; forecast freshness never fabricates timestamps',()=>{
 assert.equal(cronAuthorized(new Request('https://example.test'),'s'.repeat(32)),false);
 assert.equal(cronAuthorized(new Request('https://example.test',{headers:{authorization:'Bearer '+'s'.repeat(32)}}),'s'.repeat(32)),true);
 assert.equal(cronAuthorized(new Request('https://example.test',{headers:{authorization:'Bearer '}}),''),false);
 const now=new Date('2026-10-19T12:00:00Z');
 assert.equal(forecastFreshness([],null,now).status,'MISSING');
 assert.equal(forecastFreshness([{forecastCreatedAt:'2026-10-19T11:55:00Z'}],null,now).status,'CURRENT');
 assert.equal(forecastFreshness([{forecastCreatedAt:'2026-10-18T11:55:00Z'}],null,now).status,'STALE');
 assert.equal(forecastFreshness([{forecastCreatedAt:'2026-10-18T11:55:00Z'}],new Date('2026-10-18T12:00:00Z'),now).status,'LOCKED');
});
