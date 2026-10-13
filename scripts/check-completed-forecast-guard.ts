import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {COMPLETED_SCORE_SOURCE} from '../src/lib/completed-fantasy-scores';
test('completed and rolled-over rounds reject recalculation before fetching sources or writing forecasts',async()=>{
 let round=18,verified:any=null,reads=0;
 process.env.MARKET_ADMIN_KEY='guard-test-key';
 (globalThis as any).prisma={forecastSeasonState:{upsert:async()=>({season:2026,round,completed:false})},fantasyRoundScore:{findFirst:async(args:any)=>{reads++;assert.equal(args.where.source,COMPLETED_SCORE_SOURCE);assert.equal(args.where.grandPrix.season,2026);return verified}}};
 const {POST}=await import('../src/app/api/predictions/auto/route');
 const request=()=>new NextRequest('http://localhost/api/predictions/auto',{method:'POST',headers:{'x-market-admin-key':'guard-test-key'},body:JSON.stringify({season:2026,round:17})});
 const old=await POST(request());assert.equal(old.status,409);assert.match((await old.json()).error,/completed|past|retained/i);assert.equal(reads,0);
 round=17;verified={id:'verified-score'};
 const current=await POST(request());assert.equal(current.status,409);assert.match((await current.json()).error,/completed|retained/i);assert.equal(reads,1);
});
