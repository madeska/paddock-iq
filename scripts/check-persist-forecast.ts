import {CURRENT_CONSTRUCTOR_MODEL} from '../src/lib/current-prediction-models';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {persistForecast} from '../src/lib/persist-forecast';
test('lease loss or crossing team lock rejects before replacing forecasts',async()=>{
 let owned=0,writes=0;
 const db:any={$transaction:async(work:any)=>work({maintenanceState:{updateMany:async()=>({count:owned})},assetPrediction:{deleteMany:async()=>{writes++},createMany:async()=>{writes++}}})};
 const input={leaseToken:'lost',deadline:new Date(Date.now()+60000),grandPrixId:'gp',assets:[{id:'constructor',type:'CONSTRUCTOR' as const,currentPrice:10}],predictions:[{assetId:'constructor',grandPrixId:'gp',modelVersion:CURRENT_CONSTRUCTOR_MODEL,expectedPoints:1,expectedPriceDelta:0,probabilityMaxFall:.25,probabilitySmallFall:.25,probabilitySmallRise:.25,probabilityMaxRise:.25}],result:{}};
 await assert.rejects(persistForecast(db,input),/lease lost/);assert.equal(writes,0);
 owned=1;await assert.rejects(persistForecast(db,{...input,deadline:new Date(0)}),/Team lock/);assert.equal(writes,0);
});
test('metadata failure rolls back predictions in the same transaction',async()=>{
 let saved={predictions:['old'],context:'old'},fail=true;
 const db:any={$transaction:async(work:any)=>{
  let staged={...saved};
  const result=await work({maintenanceState:{updateMany:async({data}:any)=>{if(data.forecastContext){if(fail)throw Error('metadata unavailable');staged.context='new'}return {count:1}}},assetPrediction:{deleteMany:async()=>{staged.predictions=[]},createMany:async()=>{staged.predictions=['new'];return {count:1}}}});
  saved=staged;return result;
 }};
 const input={leaseToken:'owner',deadline:new Date(Date.now()+60000),grandPrixId:'gp',assets:[{id:'constructor',type:'CONSTRUCTOR' as const,currentPrice:10}],predictions:[{assetId:'constructor',grandPrixId:'gp',modelVersion:CURRENT_CONSTRUCTOR_MODEL,expectedPoints:1,expectedPriceDelta:0,probabilityMaxFall:.25,probabilitySmallFall:.25,probabilitySmallRise:.25,probabilityMaxRise:.25}],result:{round:18,forecastAt:new Date().toISOString()}};
 await assert.rejects(persistForecast(db,input));assert.deepEqual(saved,{predictions:['old'],context:'old'});
 fail=false;await persistForecast(db,input);assert.deepEqual(saved,{predictions:['new'],context:'new'});
});
