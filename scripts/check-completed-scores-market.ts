import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {COMPLETED_SCORE_SOURCE} from '../src/lib/completed-fantasy-scores';
import {CURRENT_DRIVER_MODEL} from '../src/lib/current-prediction-models';
test('market exposes verified zero actuals beside forecasts without connecting to a database',async()=>{
 (globalThis as any).prisma={grandPrix:{findUnique:async()=>({id:'GP17',name:'Singapore GP'})},asset:{findMany:async(args:any)=>{assert.equal(args.include.fantasyScores.where.grandPrix.round.lte,17);assert.ok(args.include.predictions.where.modelVersion.in.includes(CURRENT_DRIVER_MODEL));return [{code:'VER',name:'Max Verstappen',type:'DRIVER',prices:[{price:27}],predictions:[{modelVersion:CURRENT_DRIVER_MODEL,expectedPoints:30,expectedPriceDelta:.2}],fantasyScores:[{points:0,source:COMPLETED_SCORE_SOURCE,recordedAt:new Date('2026-10-11T16:00:00Z'),grandPrix:{round:17,name:'Singapore GP'}}]}]}}};
 const {GET}=await import('../src/app/api/market/route');const response=await GET(new NextRequest('http://localhost/api/market?season=2026&round=17'));const data=await response.json();assert.equal(data.assets[0].actualPoints,0);assert.equal(data.assets[0].expectedPoints,30);assert.equal(data.complete,true);
 const fake=(globalThis as any).prisma;fake.forecastSeasonState={upsert:async()=>({season:2026,round:18,completed:false})};fake.asset.findMany=async(args:any)=>{assert.equal(args.include.fantasyScores.where.grandPrix.round.lte,18);return []};
 const next=await(await GET(new NextRequest('http://localhost/api/market?season=2026'))).json();assert.equal(next.round,18);assert.equal(next.seasonCompleted,false);
 fake.forecastSeasonState.upsert=async()=>({season:2026,round:23,completed:true});fake.asset.findMany=async()=>[];const end=await(await GET(new NextRequest('http://localhost/api/market?season=2026'))).json();assert.equal(end.round,23);assert.equal(end.seasonCompleted,true);
});
