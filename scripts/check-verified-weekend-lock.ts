import {test} from 'node:test';import assert from 'node:assert/strict';
import {readVerifiedWeekendLock} from '../src/lib/verified-weekend-lock';
test('cached schedule must come from provider-verified context for the requested round',async()=>{
 let source='Fantasy Tools calendar + OpenF1 session start; earliest cutoff',round=19;
 const db:any={maintenanceState:{findUnique:async()=>({forecastRound:round,forecastAt:new Date('2026-10-30T06:06:14Z'),forecastContext:{round,weekendLock:{deadline:'2026-10-31T21:00:00Z',source,isSprint:false}}})}};
 assert.equal((await readVerifiedWeekendLock(db,2026,19))?.isSprint,false);
 assert.equal(await readVerifiedWeekendLock(db,2026,18),null);
 source='Stored Fantasy deadline';assert.equal(await readVerifiedWeekendLock(db,2026,19),null);
 assert.equal(await readVerifiedWeekendLock(db,2027,19),null);
});
