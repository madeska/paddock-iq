import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rolloverDecision} from '../src/lib/forecast-season-state';
const full={status:'UPDATED',verified:33,total:33,protectedScores:0,pending:[],errors:[]};
test('only complete verified scores advance exactly one round',()=>{assert.deepEqual(rolloverDecision(17,full,33),{round:18,completed:false});for(const s of [{...full,status:'WAITING'},{...full,verified:32},{...full,pending:['GAS']},{...full,protectedScores:1},{...full,errors:['source unavailable']}])assert.equal(rolloverDecision(17,s,33),null);assert.equal(rolloverDecision(17,full,34),null)});
test('last race completes the season without creating another round',()=>{assert.deepEqual(rolloverDecision(23,full,33),{round:23,completed:true});assert.equal(rolloverDecision(24,full,33),null)});

import {advanceForecastSeason} from '../src/lib/forecast-season-state';
test('persisted rollover is idempotent and cannot skip or reverse a round',async()=>{let state={season:2026,round:17,completed:false};let stored=32;const prisma:any={asset:{count:async()=>33},fantasyRoundScore:{count:async()=>stored},forecastSeasonState:{upsert:async()=>({...state}),findUniqueOrThrow:async()=>({...state}),updateMany:async({where,data}:any)=>{if(state.round===where.round&&!state.completed){state={...state,...data};return {count:1}}return {count:0}}}};assert.equal((await advanceForecastSeason(prisma,2026,17,full)).round,17);stored=33;assert.equal((await advanceForecastSeason(prisma,2026,17,full)).round,18);assert.equal((await advanceForecastSeason(prisma,2026,17,full)).round,18);assert.equal((await advanceForecastSeason(prisma,2026,19,full)).round,18)});
