import assert from 'node:assert/strict';
import {coherentConstructorForecast} from '../src/lib/coherent-constructor';
import {parseFantasyToolsComponents} from '../src/lib/fantasy-tools-components';
import componentMetadata from '../src/data/component-history-2025.json';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import auditedPrices from '../src/data/fantasy-prices-2025.json';
import {forecastProductionBaselines,supportedProductionConstructors} from '../src/lib/production-forecast';
import {simulateComponentWeekend,type ComponentSimulationOptions} from '../src/lib/component-simulation';
import {writeFile} from 'node:fs/promises';


import practices from '../src/data/prelock-practice-2025-complete.json';


import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const rounds=Array.from({length:23},(_,i)=>i+2),models=['shared-production-pre-lock','coherent-constructors','half-coherent-constructors'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const raw=await readFile('../simulation-research/f1fantasytools-statistics-2025.json');if(createHash('sha256').update(raw).digest('hex')!==componentMetadata.sourceSHA256)throw Error('Source changed');const source=JSON.parse(raw.toString());const components={...componentMetadata,observations:parseFantasyToolsComponents(source,24)};
 const totals={observations:components.observations};
 const quoteOmissions:any[]=[];const prices=auditedPrices;
 const outcomes:any[]=[],missing:any[]=[],cohortAudit:any[]=[];
 for(const round of rounds){
  const weekend=practices.weekends.find(w=>w.round===round)!;
  
  for(const model of models){
   const practice={isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])};
   const roster=prices.observations.filter(p=>p.round===round),teams=Object.fromEntries(roster.filter(p=>p.type==='DRIVER').map(p=>[p.code,p.team]));
   const assets=roster.map(p=>({season:2025,code:p.code,type:p.type as 'DRIVER'|'CONSTRUCTOR',currentPrice:p.priceBefore,prices:prices.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<=round).map(v=>({round:v.round,price:v.priceBefore})),scores:totals.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<round).map(v=>({round:v.round,points:v.actualPoints}))}));
   const {baselines}=forecastProductionBaselines(assets,{season:2025,round,practice});
   const extra:Partial<ComponentSimulationOptions>={};
   const values=[...baselines.values()],sim=simulateComponentWeekend(values.filter(v=>v.type==='DRIVER').map(v=>({code:v.code,team:teams[v.code],baselineXPts:v.rawXPts,recentScores:v.chronological.slice(-5)})),values.filter(v=>v.type==='CONSTRUCTOR').map(v=>({code:v.code,baselineXPts:v.rawXPts})),{scoringSeason:2025,sprint:weekend.isSprint,simulations:3000,seed:202600+round,overtakeIntensity:1.2,...extra});
   const coherent=coherentConstructorForecast(new Map(sim.drivers.map(d=>[d.code,.75*baselines.get(d.code)!.rawXPts+.25*d.total])),sim.drivers,sim.constructors,teams);
   const supported=supportedProductionConstructors(baselines,teams);if(model===models[0])cohortAudit.push({round,quotedDrivers:roster.filter(r=>r.type==='DRIVER').length,simulatedDrivers:values.filter(r=>r.type==='DRIVER').length,unsupportedConstructors:values.filter(r=>r.type==='CONSTRUCTOR'&&!supported.has(r.code)).map(r=>r.code)});
   const rows=roster.map(v=>{const b=baselines.get(v.code),c=(v.type==='DRIVER'?sim.drivers:sim.constructors.filter(c=>supported.has(c.code))).find(c=>c.code===v.code);const weight=.25;const original=b?(c?.total==null?b.rawXPts:.75*b.rawXPts+.25*c.total):null;const alternate=v.type==='CONSTRUCTOR'?coherent.get(v.code):undefined;const forecast=original==null?null:model===models[0]||alternate==null?original:model===models[1]?alternate:.5*original+.5*alternate;return {code:v.code,type:v.type,baseline:b?Math.round(b.rawXPts*10)/10:null,prediction:forecast==null?null:Math.round(forecast*10)/10}});
   if(model===models[0])assert.deepEqual(rows,replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:weekend.isSprint,practice}));
   if(model===models[0]){const opts={season:2025,round,sprint:weekend.isSprint,practice};assert.deepEqual(replayProductionHistory(totals.observations.map(r=>r.round>=round?{...r,actualPoints:99999}:r) as ReplayScore[],prices.observations.map(p=>p.round>round?{...p,priceBefore:99999}:p) as ArchivedFantasyPrice[],opts),rows)}
   for(const row of totals.observations.filter(r=>r.round===round)){
    const prediction=rows.find(r=>r.code===row.code&&r.type===row.type)?.prediction;
    if(prediction==null){if(model===models[0])missing.push({round,code:row.code,type:row.type});continue}

    if(round<6)continue;
    outcomes.push({round,type:row.type,code:row.code,model,error:prediction-row.actualPoints});
   }
  }
 }
 const summary=models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metric(outcomes.filter(r=>r.model===model&&r.type===type).map(r=>r.error))})));
 const byRound=rounds.filter(r=>r>=6).flatMap(round=>models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({round,model,type,...metric(outcomes.filter(r=>r.round===round&&r.model===model&&r.type===type).map(r=>r.error))}))));
 const intervals=[];
 for(const model of models.slice(1))for(const type of ['DRIVER','CONSTRUCTOR']){
  const blocks=rounds.filter(r=>r>=6).map(round=>{const base=byRound.find(r=>r.round===round&&r.model===models[0]&&r.type===type)!,candidate=byRound.find(r=>r.round===round&&r.model===model&&r.type===type)!;if(base.n!==candidate.n)throw Error('Unpaired calibration cohort');return {n:base.n,delta:(candidate.MAE-base.MAE)*base.n}});
  let state=771;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((n,r)=>n+r.delta,0)/draw.reduce((n,r)=>n+r.n,0)}).sort((a,b)=>a-b);
  intervals.push({model,type,deltaMAE:blocks.reduce((n,r)=>n+r.delta,0)/blocks.reduce((n,r)=>n+r.n,0),low:samples[250],high:samples[9749]});
 }
 const report={scoringSeason:2025,sprintNCPenalty:-20,quoteMode:'audited-2025-pre-event',note:'Exploratory already-consumed2025 R6–24; past forecast frames2 onward. Fixed coherent constructor identity with unchanged25% driver forecasts; full and half coherent variants, no tuning. Uses complete pinned2025 totals, reported pre-event prices previously audited with official anchors, incumbent completed-practice policy and2025 simulation defaults. No2024 adapter here. Both models share field/seed/scoring/rounding; no new cold prior or activation.',rounds,quoteOmissions,cohortAudit,missing,summary,pairedRaceBootstrap:intervals,byRound};
 console.table(summary);console.table(intervals);await writeFile('docs/production-coherent-constructors-2025-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
