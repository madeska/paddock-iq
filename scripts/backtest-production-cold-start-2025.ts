import assert from 'node:assert/strict';
import {forecastWithColdStartPriors} from '../src/lib/cold-start-prior';
import {forecastProductionBaselines,supportedProductionConstructors} from '../src/lib/production-forecast';
import {simulateComponentWeekend,type ComponentSimulationOptions} from '../src/lib/component-simulation';
import {writeFile} from 'node:fs/promises';
import totals from '../src/data/fantasy-totals-2025.json';
import prices from '../src/data/fantasy-prices-2025.json';
import practices from '../src/data/prelock-practice-2025.json';


import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const rounds=[6,7,8,9,10,11,12,13,14],models=['shared-production-pre-lock','cold-start-prior'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const outcomes:any[]=[],missing:any[]=[],newCoverage:any[]=[];
 for(const round of rounds){
  const weekend=practices.weekends.find(w=>w.round===round)!;
  
  for(const model of models){
   const practice={isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])};
   const roster=prices.observations.filter(p=>p.round===round),teams=Object.fromEntries(roster.filter(p=>p.type==='DRIVER').map(p=>[p.code,p.team]));
   const assets=roster.map(p=>({season:2025,code:p.code,type:p.type as 'DRIVER'|'CONSTRUCTOR',currentPrice:p.priceBefore,prices:prices.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<=round).map(v=>({round:v.round,price:v.priceBefore})),scores:totals.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<round).map(v=>({round:v.round,points:v.actualPoints}))}));
   const {baselines}=model===models[0]?forecastProductionBaselines(assets,{season:2025,round,practice}):forecastWithColdStartPriors(assets,teams,{season:2025,round,practice});
   const extra:Partial<ComponentSimulationOptions>={};
   const weight=.25;
   const values=[...baselines.values()],sim=simulateComponentWeekend(values.filter(v=>v.type==='DRIVER').map(v=>({code:v.code,team:teams[v.code],baselineXPts:v.rawXPts,recentScores:v.chronological.slice(-5)})),values.filter(v=>v.type==='CONSTRUCTOR').map(v=>({code:v.code,baselineXPts:v.rawXPts})),{scoringSeason:2025,sprint:weekend.isSprint,simulations:3000,seed:202600+round,overtakeIntensity:1.2,...extra});
   const supported=supportedProductionConstructors(baselines,teams);
   const rows=roster.map(v=>{const b=baselines.get(v.code),c=(v.type==='DRIVER'?sim.drivers:sim.constructors.filter(c=>supported.has(c.code))).find(c=>c.code===v.code);return {code:v.code,type:v.type,baseline:b?Math.round(b.rawXPts*10)/10:null,prediction:b?Math.round((c?.total==null?b.rawXPts:(1-weight)*b.rawXPts+weight*c.total)*10)/10:null}});
   if(model===models[0])assert.deepEqual(rows,replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:weekend.isSprint,practice}));
   const reference=model===models[0]?rows:replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:weekend.isSprint,practice});
   for(const row of totals.observations.filter(r=>r.round===round)){
    const prediction=rows.find(r=>r.code===row.code&&r.type===row.type)?.prediction;
    if(prediction==null){if(model===models[0])missing.push({round,code:row.code,type:row.type});continue}
    if(model!==models[0]&&reference.find(r=>r.code===row.code&&r.type===row.type)?.prediction==null){newCoverage.push({round,code:row.code,type:row.type,prediction,actual:row.actualPoints,error:prediction-row.actualPoints});continue}
    outcomes.push({round,type:row.type,code:row.code,model,error:prediction-row.actualPoints});
   }
  }
 }
 const summary=models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metric(outcomes.filter(r=>r.model===model&&r.type===type).map(r=>r.error))})));
 const byRound=rounds.flatMap(round=>models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({round,model,type,...metric(outcomes.filter(r=>r.round===round&&r.model===model&&r.type===type).map(r=>r.error))}))));
 const intervals=[];
 for(const model of models.slice(1))for(const type of ['DRIVER','CONSTRUCTOR']){
  const blocks=rounds.map(round=>{const base=byRound.find(r=>r.round===round&&r.model===models[0]&&r.type===type)!,candidate=byRound.find(r=>r.round===round&&r.model===model&&r.type===type)!;if(base.n!==candidate.n)throw Error('Unpaired calibration cohort');return {n:base.n,delta:(candidate.MAE-base.MAE)*base.n}});
  let state=771;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((n,r)=>n+r.delta,0)/draw.reduce((n,r)=>n+r.n,0)}).sort((a,b)=>a-b);
  intervals.push({model,type,deltaMAE:blocks.reduce((n,r)=>n+r.delta,0)/blocks.reduce((n,r)=>n+r.n,0),low:samples[250],high:samples[9749]});
 }
 const report={scoringSeason:2025,sprintNCPenalty:-20,note:'Exploratory consumed2025 R6–14. Fixed research prior uses half teammate pastEWMA and half pooled past score; global fallback if no teammate, no fabricated own history/practice modifier for prior. Same25% component weight. Common cohort metrics exclude newly covered labels and report them separately; adding driver changes simulated field and constructor support. No independent validation or activation.',rounds,missing,newCoverage,summary,pairedRaceBootstrap:intervals,byRound};
 console.table(summary);console.table(intervals);await writeFile('docs/production-cold-start-2025-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
