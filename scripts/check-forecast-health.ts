import {test} from 'node:test';import assert from 'node:assert/strict';
import {readForecastHealth} from '../src/lib/forecast-health';
import {CURRENT_CONSTRUCTOR_MODEL} from '../src/lib/current-prediction-models';
test('read-back detects missing rows and metadata instead of trusting generator success',async()=>{
 let predictions:any[]=[{assetId:'constructor',grandPrixId:'gp',modelVersion:CURRENT_CONSTRUCTOR_MODEL,expectedPoints:0,expectedPriceDelta:0,probabilityMaxFall:.25,probabilitySmallFall:.25,probabilitySmallRise:.25,probabilityMaxRise:.25}];
 const original=predictions;let forecastRound=19;
 const db:any={grandPrix:{findUnique:async()=>({id:'gp'})},asset:{findMany:async()=>[{id:'constructor',code:'MER',type:'CONSTRUCTOR',prices:[{price:34}],predictions}]},maintenanceState:{findUnique:async()=>({forecastRound,forecastAt:new Date()})}};
 assert.equal((await readForecastHealth(db,2026,19)).ok,true);
 predictions=[];assert.equal((await readForecastHealth(db,2026,19)).ok,false);
 predictions=original;forecastRound=18;assert.equal((await readForecastHealth(db,2026,19)).ok,false);
 db.forecastSeasonState={findUnique:async()=>({round:19})};(globalThis as any).prisma=db;
 const {GET}=await import('../src/app/api/forecast/health/route');
 assert.equal((await GET()).status,503);
 forecastRound=19;const response=await GET();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
