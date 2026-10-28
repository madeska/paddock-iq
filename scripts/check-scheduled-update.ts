import {test} from 'node:test';import assert from 'node:assert/strict';
import {scheduledUpdate} from '../src/lib/scheduled-update';
import {NextRequest} from 'next/server';
test('rollover generates only the next unlocked race and freezes post-lock forecasts',async()=>{
 const calls:number[]=[],now=new Date('2026-10-19T12:00:00Z');let completed=false,deadline=new Date('2026-10-24T12:00:00Z');
 const deps={state:async()=>({round:18,completed:false}),scores:async()=>({forecast:{round:19,completed},errors:[],verified:33}),lock:async()=>deadline,verify:async()=>({ok:true}),generate:async(round:number)=>{calls.push(round);return Response.json({ok:true,created:33})}};
 assert.equal((await scheduledUpdate(deps,()=>now)).status,'UPDATED');assert.deepEqual(calls,[19]);
 deadline=new Date('2026-10-18T12:00:00Z');assert.equal((await scheduledUpdate(deps,()=>now)).status,'LOCKED');assert.deepEqual(calls,[19]);
 completed=true;assert.equal((await scheduledUpdate(deps,()=>now)).status,'COMPLETED');assert.deepEqual(calls,[19]);
});
test('source failure stays retryable rather than claiming a successful update',async()=>{
 await assert.rejects(scheduledUpdate({state:async()=>({round:18,completed:false}),scores:async()=>({forecast:{round:18,completed:false},errors:['feed unavailable'],verified:0}),lock:async()=>new Date(),verify:async()=>({ok:true}),generate:async()=>{throw Error('must not generate')}}));
});
test('lock is checked against the clock after source checks, not invocation time',async()=>{
 let now=new Date('2026-10-19T12:00:00Z'),generated=false;
 const result=await scheduledUpdate({state:async()=>({round:18,completed:false}),scores:async()=>{now=new Date('2026-10-19T12:02:00Z');return {forecast:{round:18,completed:false},verified:0,errors:[]}},lock:async()=>new Date('2026-10-19T12:01:00Z'),verify:async()=>({ok:true}),generate:async()=>{generated=true;return Response.json({})}},()=>now);
 assert.equal(result.status,'LOCKED');assert.equal(generated,false);
});
test('cron rejects anonymous and invalid bearer requests before database access',async()=>{
 process.env.CRON_SECRET='s'.repeat(32);(globalThis as any).prisma={};
 const {GET}=await import('../src/app/api/cron/update/route');
 for(const authorization of ['', 'Bearer wrong'])assert.equal((await GET(new NextRequest('https://example.test/api/cron/update',{headers:{authorization}}))).status,401);
});
test('successful generator response cannot hide failed saved-forecast verification',async()=>{
 await assert.rejects(scheduledUpdate({state:async()=>({round:19,completed:false}),scores:async()=>({forecast:{round:19,completed:false},verified:0,errors:[]}),lock:async()=>new Date(Date.now()+60000),generate:async()=>Response.json({ok:true,created:33}),verify:async()=>({ok:false})}),error=>(error as any).code==='FORECAST_READBACK_FAILED');
});
