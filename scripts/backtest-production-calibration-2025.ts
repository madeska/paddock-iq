import {writeFile} from 'node:fs/promises';
import totals from '../src/data/fantasy-totals-2025.json';
import prices from '../src/data/fantasy-prices-2025.json';
import practices from '../src/data/prelock-practice-2025.json';
import components from '../src/data/component-history-2025.json';
import {calibrateComponents,type ComponentObservation} from '../src/lib/component-calibration';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const rounds=[6,7,8,9,10,11,12,13,14],models=['shared-production-pre-lock','calibrated-reliability-dotd-pits','calibrated-all'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const outcomes:any[]=[],missing:any[]=[];
 for(const round of rounds){
  const weekend=practices.weekends.find(w=>w.round===round)!;
  const calibration=calibrateComponents(components.observations as ComponentObservation[],{season:2025,round,priorStrength:16,halfLife:16});
  for(const model of models){
   const rows=replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:weekend.isSprint,practice:{isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])},...(model===models[0]?{}:{componentOverrides:{calibration,calibrationMode:model==='calibrated-all'?'all' as const:'reliability-dotd-pits' as const}})});
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
 const report={scoringSeason:2025,sprintNCPenalty:-20,note:'Exploratory R6–14 already consumed. Shared baseline, current active cohort, historical pre-event prices, incumbent practice policy, production intensity1.2/3000 draws/seed and rounding. Calibration strength16/halfLife16 came from prior 2026 component research; no new hyperparameter selection here. Scored 2025 component labels use only earlier rounds. Reserved R15–21 component labels/features/errors not imported. No activation.',priorStrength:16,halfLife:16,rounds,missing,summary,pairedRaceBootstrap:intervals,byRound};
 console.table(summary);console.table(intervals);await writeFile('docs/production-calibration-2025-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
