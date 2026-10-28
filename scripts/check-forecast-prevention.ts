import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fantasyRaceName,normalizeFantasyRaceName,FANTASY_RACES_2026} from '../src/lib/fantasy-race-calendar';
import {validateForecastBatch} from '../src/lib/forecast-batch-validation';
import {CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL,BOOST_MODELS} from '../src/lib/current-prediction-models';

test('all supported event aliases share one canonical identity and unknown events remain distinct',()=>{
 for(const race of FANTASY_RACES_2026){
  assert.equal(fantasyRaceName(2026,race.round),race.name);
  for(const alias of race.aliases)assert.equal(normalizeFantasyRaceName(alias),normalizeFantasyRaceName(race.name));
 }
 assert.notEqual(normalizeFantasyRaceName('Mexico GP'),normalizeFantasyRaceName('United States GP'));
 assert.equal(fantasyRaceName(2027,19),'Round 19');
});
const assets=[{id:'driver',type:'DRIVER' as const,currentPrice:10},{id:'constructor',type:'CONSTRUCTOR' as const,currentPrice:34}];
const main=(assetId:string,modelVersion:string)=>({assetId,grandPrixId:'gp',modelVersion,expectedPoints:0,expectedPriceDelta:0,probabilityMaxFall:.25,probabilitySmallFall:.25,probabilitySmallRise:.25,probabilityMaxRise:.25});
const valid=()=>[main('driver',CURRENT_DRIVER_MODEL),main('constructor',CURRENT_CONSTRUCTOR_MODEL),{assetId:'driver',grandPrixId:'gp',modelVersion:BOOST_MODELS[0],expectedPoints:-3}];
test('a complete finite batch permits zero and negative points',()=>assert.deepEqual(validateForecastBatch(assets,'gp',valid()),[]));
test('batch validation rejects omissions, duplicates, wrong identity and malformed predictions',()=>{
 for(const change of [
  (rows:any[])=>rows.filter(row=>row.assetId!=='constructor'),
  (rows:any[])=>[...rows,rows[0]],
  (rows:any[])=>rows.map((row,i)=>i===0?{...row,expectedPoints:NaN}:row),
  (rows:any[])=>rows.map((row,i)=>i===0?{...row,grandPrixId:'other-gp'}:row),
  (rows:any[])=>rows.map((row,i)=>i===0?{...row,expectedPriceDelta:Infinity}:row),
  (rows:any[])=>rows.map((row,i)=>i===0?{...row,probabilityMaxFall:.9}:row),
  (rows:any[])=>rows.map((row,i)=>i===1?{...row,expectedPriceDelta:.3}:row),
  (rows:any[])=>rows.slice(0,2),
  (rows:any[])=>[...rows,{...rows[2],assetId:'constructor'}]
 ])assert.ok(validateForecastBatch(assets,'gp',change(valid())).length>0);
 assert.ok(validateForecastBatch([],'gp',[]).length>0);
});
