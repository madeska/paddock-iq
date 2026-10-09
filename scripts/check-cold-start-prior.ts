import assert from 'node:assert/strict';import {test} from 'node:test';import {forecastWithColdStartPriors} from '../src/lib/cold-start-prior';import type {ProductionForecastAsset} from '../src/lib/production-forecast';
const asset=(code:string,scores:number[]):ProductionForecastAsset=>({season:2025,code,type:'DRIVER',currentPrice:5,prices:[],scores:scores.map((points,i)=>({round:i+1,points}))});
const assets=[asset('NEW',[]),asset('MATE',[20,20]),asset('OTHER',[0,0])],teams={NEW:'T',MATE:'T',OTHER:'U'},options={season:2025,round:3};
test('cold-start prior blends teammate history and pooled past score',()=>{const r=forecastWithColdStartPriors(assets,teams,options);assert.deepEqual(r.coldStarts,['NEW']);assert.equal(r.baselines.get('NEW')?.rawXPts,15);assert.deepEqual(r.baselines.get('NEW')?.chronological,[])});
test('target and future labels cannot change the prior',()=>assert.deepEqual(forecastWithColdStartPriors(assets.map(a=>({...a,scores:[...a.scores,{round:3,points:99999}]})),teams,options),forecastWithColdStartPriors(assets,teams,options)));
test('missing team or all missing history remains explicitly unprojected',()=>{assert.equal(forecastWithColdStartPriors([asset('NEW',[])],{NEW:'T'},options).baselines.size,0);assert.equal(forecastWithColdStartPriors(assets,{MATE:'T',OTHER:'U'},options).baselines.has('NEW'),false)});

test('invalid current quote cannot create a cold-start row',()=>{for(const currentPrice of [NaN,Infinity,0,-1])assert.throws(()=>forecastWithColdStartPriors(assets.map(a=>a.code==='NEW'?{...a,currentPrice}:a),teams,options))});
