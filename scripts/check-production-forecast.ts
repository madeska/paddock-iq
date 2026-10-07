import assert from 'node:assert/strict';
import {test} from 'node:test';
import fixture from './fixtures/production-baseline-parity.json';
import {forecastProductionBaselines,simulateProductionForecast,PRODUCTION_FORECAST_CONFIG,type ProductionForecastAsset} from '../src/lib/production-forecast';
const assets=fixture.assets as ProductionForecastAsset[];
for(const c of fixture.cases)test('original API baseline parity: round '+c.round+' practice '+c.practice,()=>{
 const practice=c.practice?{isSprint:false,positions:new Map(assets.filter(a=>a.type==='DRIVER').map(a=>[a.code,Number(a.code.slice(1))+1]))}:null;
 const result=forecastProductionBaselines(assets,{season:2026,round:c.round,practice});
 assert.equal(result.trainingRows,c.expected.trainingRows);assert.equal(result.baselines.size,c.expected.rows.length);
 for(const expected of c.expected.rows){const actual=result.baselines.get(expected.code)!;for(const key of ['rawXPts','boostXPts','practicePosition'] as const){if(expected[key]===null)assert.equal(actual[key],null);else assert.ok(Math.abs(actual[key]!-expected[key]!)<1e-10,key+' parity for '+expected.code)}}
});
test('future scores and inactive seasons cannot enter shared baseline calculations',()=>{
 const a=forecastProductionBaselines(assets,{season:2026,round:9});
 const b=forecastProductionBaselines([...assets.map(a=>({...a,scores:[...a.scores,{round:9,points:9999},{round:10,points:-9999}]})),{...assets[0],season:2025,code:'OTHER'}],{season:2026,round:9});assert.deepEqual(a,b);
});
test('sprint practices do not change baseline or boost and missing-history assets stay missing',()=>{
 const a=forecastProductionBaselines(assets,{season:2026,round:9}),b=forecastProductionBaselines(assets,{season:2026,round:9,practice:{isSprint:true,positions:new Map([['D0',1]])}});assert.deepEqual(a,b);assert.equal(a.baselines.has('C10'),false);assert.equal(a.baselines.has('C11'),false);assert.equal(a.baselines.get('C8')!.rawXPts,-5);
});
test('shared production constants retain deployed simulation configuration',()=>{
 assert.equal(PRODUCTION_FORECAST_CONFIG.overtakeIntensity,1.2);assert.equal(PRODUCTION_FORECAST_CONFIG.componentWeight,.25);assert.equal(PRODUCTION_FORECAST_CONFIG.simulations,3000);assert.equal(PRODUCTION_FORECAST_CONFIG.firstTrainingRound,6);
});

for(const c of fixture.cases)test('original full component parity: round '+c.round+' practice '+c.practice,()=>{
 const practice=c.practice?{isSprint:false,positions:new Map(assets.filter(a=>a.type==='DRIVER').map(a=>[a.code,Number(a.code.slice(1))+1]))}:null;
 const result=forecastProductionBaselines(assets,{season:2026,round:c.round,practice});
 const component=simulateProductionForecast(result.baselines,{D0:'C8',D1:'C8',D2:'C9',D3:'C9'},{round:c.round,sprint:[2,4,5,9,12,17].includes(c.round)});assert.deepEqual(component,c.expected.component);
});
import {supportedProductionConstructors} from '../src/lib/production-forecast';
test('constructor component support requires exactly two known drivers',()=>{
 const {baselines}=forecastProductionBaselines(assets,{season:2026,round:9});
 assert.deepEqual([...supportedProductionConstructors(baselines,{D0:'C8',D1:'C8',D2:'C9'})],['C8']);
 assert.equal(supportedProductionConstructors(baselines,{D0:'C8',D1:'C8',D2:'C8'}).size,0);
});
test('unsupported constructor components are omitted rather than returned as zero estimates',()=>{
 const {baselines}=forecastProductionBaselines(assets,{season:2026,round:9});
 const result=simulateProductionForecast(baselines,{D0:'C8',D1:'C8',D2:'C9'},{round:9,sprint:true});assert.deepEqual(result.constructors.map(r=>r.code),['C8']);
});
