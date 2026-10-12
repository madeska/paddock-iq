import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareForecast} from '../src/lib/forecast-preparation';
test('missing feed stays retryable and later completion clears the pending work',async()=>{let ready=false,calls=0;const load=async()=>ready?{round:18,complete:false}:undefined;const refresh=async(round:number)=>{calls++;assert.equal(round,18);return {round,complete:true}};assert.equal(await prepareForecast(load,refresh),false);assert.equal(calls,0);ready=true;assert.equal(await prepareForecast(load,refresh),true);assert.equal(calls,1)});
test('failed generation remains pending while complete and ended markets need no generation',async()=>{assert.equal(await prepareForecast(async()=>({round:18,complete:false}),async()=>undefined),false);for(const market of [{round:18,complete:true},{round:23,complete:false,seasonCompleted:true}])assert.equal(await prepareForecast(async()=>market,async()=>{throw Error('Unnecessary generation')}),true)});
