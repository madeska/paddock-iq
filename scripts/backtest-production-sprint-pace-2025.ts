import assert from 'node:assert/strict';
import {fitOvertakeModel} from '../src/lib/overtake-model';
import {forecastProductionBaselines,supportedProductionConstructors} from '../src/lib/production-forecast';
import {simulateComponentWeekend,type ComponentSimulationOptions} from '../src/lib/component-simulation';
import {writeFile} from 'node:fs/promises';
import totals from '../src/data/fantasy-totals-2025.json';
import prices from '../src/data/fantasy-prices-2025.json';
import practices from '../src/data/prelock-practice-2025.json';
import components from '../src/data/component-history-2025.json';
import {type ComponentObservation} from '../src/lib/component-calibration';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const rounds=[6,7,8,9,10,11,12,13,14],models=['shared-production-pre-lock','prelock-sprint-pace'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const outcomes:any[]=[],missing:any[]=[];
 for(const round of rounds){
  const weekend=practices.weekends.find(w=>w.round===round)!;
  
  for(const model of models){
   const practice={isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])};
   const roster=prices.observations.filter(p=>p.round===round),teams=Object.fromEntries(roster.filter(p=>p.type==='DRIVER').map(p=>[p.code,p.team]));
   const assets=roster.map(p=>({season:2025,code:p.code,type:p.type as 'DRIVER'|'CONSTRUCTOR',currentPrice:p.priceBefore,prices:prices.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<=round).map(v=>({round:v.round,price:v.priceBefore})),scores:totals.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<round).map(v=>({round:v.round,points:v.actualPoints}))}));
   const {baselines}=forecastProductionBaselines(assets,{season:2025,round,practice});
   const fitted=fitOvertakeModel(components.observations as ComponentObservation[],{season:2025,round});
   assert.deepEqual(fitOvertakeModel((components.observations as ComponentObservation[]).map(o=>o.round>=round?{...o,race:o.race?{...o.race,overtakes:99999}:undefined}:o),{season:2025,round}),fitted);
   const sq=weekend.sprintQualifying;
   if(sq&&Date.parse(sq.endedAt)>=Date.parse(weekend.lockTime))throw Error('Sprint pace after lock');
   const extra:Partial<ComponentSimulationOptions>=model===models[1]&&weekend.isSprint&&sq?{sprintPace:Object.fromEntries(sq.positions.map(p=>[p.code,(11.5-p.position)/6]))}:{};
   const values=[...baselines.values()],sim=simulateComponentWeekend(values.filter(v=>v.type==='DRIVER').map(v=>({code:v.code,team:teams[v.code],baselineXPts:v.rawXPts,recentScores:v.chronological.slice(-5)})),values.filter(v=>v.type==='CONSTRUCTOR').map(v=>({code:v.code,baselineXPts:v.rawXPts})),{scoringSeason:2025,sprint:weekend.isSprint,simulations:3000,seed:202600+round,overtakeIntensity:1.2,...extra});
   const supported=supportedProductionConstructors(baselines,teams);
   const rows=roster.map(v=>{const b=baselines.get(v.code),c=(v.type==='DRIVER'?sim.drivers:sim.constructors.filter(c=>supported.has(c.code))).find(c=>c.code===v.code);return {code:v.code,type:v.type,baseline:b?Math.round(b.rawXPts*10)/10:null,prediction:b?Math.round((c?.total==null?b.rawXPts:.75*b.rawXPts+.25*c.total)*10)/10:null}});
   if(model===models[0])assert.deepEqual(rows,replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:weekend.isSprint,practice}));
   for(const row of totals.observations.filter(r=>r.round===round)){
    const prediction=rows.find(r=>r.code===row.code&&r.type===row.type)?.prediction;
    if(prediction==null){if(model===models[0])missing.push({round,code:row.code,type:row.type});continue}
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
 const sprintOnly=models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metric(outcomes.filter(r=>r.model===model&&r.type===type&&practices.weekends.find(w=>w.round===r.round)?.isSprint).map(r=>r.error))})));
 const report={scoringSeason:2025,sprintNCPenalty:-20,note:'Exploratory R6–14 already consumed. Shared baseline, current active cohort, historical pre-event prices, incumbent practice policy, production intensity1.2/3000 draws/seed and rounding. Sprint pace from completed pre-lock SQ position with fixed scale6. It predicts stochastic sprint grid and finishing pace; SQ is not asserted to be final grid. No hyperparameter search. Incumbent parity and future overtake-label invariance asserted per round. Scored 2025 component labels use only earlier rounds. Reserved R15–21 component labels/features/errors not imported. No activation.',rounds,missing,summary,sprintOnly,pairedRaceBootstrap:intervals,byRound};
 console.table(summary);console.table(intervals);await writeFile('docs/production-sprint-pace-2025-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
