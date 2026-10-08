import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {MAIN_MODELS,CURRENT_MODELS,CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL} from '../src/lib/current-prediction-models';
test('newly emitted driver and constructor forecasts survive reader filtering and selection',()=>{for(const model of [CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL]){const stored=[{modelVersion:model,expectedPoints:31.2}];const fetched=stored.filter(p=>CURRENT_MODELS.includes(p.modelVersion));const selected=MAIN_MODELS.map(m=>fetched.find(p=>p.modelVersion===m)).find(Boolean);assert.equal(selected?.expectedPoints,31.2)}assert.equal(MAIN_MODELS[0],CURRENT_DRIVER_MODEL);assert.equal(MAIN_MODELS[1],CURRENT_CONSTRUCTOR_MODEL)});
test('writer, market and team use the same registry',()=>{for(const path of ['src/app/api/market/route.ts','src/app/api/team/route.ts','src/app/api/predictions/auto/route.ts'])assert.ok(readFileSync(path,'utf8').includes('lib/current-prediction-models'),path)});
