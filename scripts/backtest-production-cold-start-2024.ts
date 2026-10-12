import assert from 'node:assert/strict';
import {forecastWithColdStartPriors} from '../src/lib/cold-start-prior';
import components from '../src/data/component-history-2024.json';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {causalQuoteFromPriorChanges} from '../src/lib/causal-price-history';
import {forecastProductionBaselines,supportedProductionConstructors} from '../src/lib/production-forecast';
import {simulateComponentWeekend,type ComponentSimulationOptions} from '../src/lib/component-simulation';
import {writeFile} from 'node:fs/promises';


import practices from '../src/data/prelock-practice-2024.json';


import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const rounds=Array.from({length:23},(_,i)=>i+2),models=['shared-production-pre-lock','cold-start-prior'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const raw=await readFile('../simulation-research/f1fantasytools-statistics-2024.json');if(createHash('sha256').update(raw).digest('hex')!==components.sourceSHA256)throw Error('Source changed');const source=JSON.parse(raw.toString());
 const totals={observations:components.observations};
 const quoteOmissions:any[]=[];
 const prices={observations:components.observations.flatMap(o=>{let priceBefore=o.priceBefore;if(process.argv.includes('--causal')){const collection=o.type==='DRIVER'?'drivers':'constructors';const current=source.seasonResult.raceResults[o.round][collection].find((r:any)=>(collection==='constructors'||r.isActive===true)&&(r.abbreviation===o.code||({AST:'AMR',HAA:'HAS',KCK:'SAU',RED:'RBR',VRB:'RB'} as Record<string,string>)[r.abbreviation]===o.code));const initial=source.seasonResult.raceResults[1][collection].find((r:any)=>r.id===current?.id);if(!initial){quoteOmissions.push({round:o.round,code:o.code,type:o.type,reason:'No matching initial quote identity'});return []}try{priceBefore=causalQuoteFromPriorChanges(initial.price,Array.from({length:o.round-1},(_,i)=>{const r=source.seasonResult.raceResults[i+1][collection].find((r:any)=>r.id===current.id);return {round:i+1,change:r?.priceChange}}),o.round)}catch(error){quoteOmissions.push({round:o.round,code:o.code,type:o.type,reason:String(error)});return []}}return [{round:o.round,code:o.code,type:o.type as 'DRIVER'|'CONSTRUCTOR',team:o.team,priceBefore}]})};
 const outcomes:any[]=[],missing:any[]=[],newCoverage:any[]=[],cohortAudit:any[]=[];
 for(const round of rounds){
  const weekend=practices.weekends.find(w=>w.round===round)!;
  
  for(const model of models){
   const practice={isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])};
   const roster=prices.observations.filter(p=>p.round===round),teams=Object.fromEntries(roster.filter(p=>p.type==='DRIVER').map(p=>[p.code,p.team]));
   const assets=roster.map(p=>({season:2024,code:p.code,type:p.type as 'DRIVER'|'CONSTRUCTOR',currentPrice:p.priceBefore,prices:prices.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<=round).map(v=>({round:v.round,price:v.priceBefore})),scores:totals.observations.filter(v=>v.code===p.code&&v.type===p.type&&v.round<round).map(v=>({round:v.round,points:v.actualPoints}))}));
   const forecast=model===models[0]?forecastProductionBaselines(assets,{season:2024,round,practice}):forecastWithColdStartPriors(assets,teams,{season:2024,round,practice});const {baselines}=forecast;
   if(model!==models[0])assert.deepEqual(forecastWithColdStartPriors(assets.map(a=>({...a,scores:[...a.scores,{round,points:99999},{round:round+1,points:-99999}]})),teams,{season:2024,round,practice}),forecast);
   const extra:Partial<ComponentSimulationOptions>={};
   const weight=.25;
   const values=[...baselines.values()],sim=simulateComponentWeekend(values.filter(v=>v.type==='DRIVER').map(v=>({code:v.code,team:teams[v.code],baselineXPts:v.rawXPts,recentScores:v.chronological.slice(-5)})),values.filter(v=>v.type==='CONSTRUCTOR').map(v=>({code:v.code,baselineXPts:v.rawXPts})),{scoringSeason:2024,sprint:weekend.isSprint,simulations:3000,seed:202600+round,overtakeIntensity:1.2,...extra});
   const supported=supportedProductionConstructors(baselines,teams);cohortAudit.push({round,model,quotedDrivers:roster.filter(r=>r.type==='DRIVER').length,simulatedDrivers:values.filter(r=>r.type==='DRIVER').length,unsupportedConstructors:values.filter(r=>r.type==='CONSTRUCTOR'&&!supported.has(r.code)).map(r=>r.code)});
   const rows=roster.map(v=>{const b=baselines.get(v.code),c=(v.type==='DRIVER'?sim.drivers:sim.constructors.filter(c=>supported.has(c.code))).find(c=>c.code===v.code);return {code:v.code,type:v.type,baseline:b?Math.round(b.rawXPts*10)/10:null,prediction:b?Math.round((c?.total==null?b.rawXPts:(1-weight)*b.rawXPts+weight*c.total)*10)/10:null}});
   if(model===models[0])assert.deepEqual(rows,replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2024,round,sprint:weekend.isSprint,practice}));
   if(model===models[0]){const opts={season:2024,round,sprint:weekend.isSprint,practice};assert.deepEqual(replayProductionHistory(totals.observations.map(r=>r.round>=round?{...r,actualPoints:99999}:r) as ReplayScore[],prices.observations.map(p=>p.round>round?{...p,priceBefore:99999}:p) as ArchivedFantasyPrice[],opts),rows)}
   const reference=model===models[0]?rows:replayProductionHistory(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2024,round,sprint:weekend.isSprint,practice});
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
 const report={scoringSeason:2024,sprintNCPenalty:-20,quoteMode:process.argv.includes('--causal')?'initial-plus-prior-changes':'reported-unverified-retrospective',note:'Exploratory2024 cold-start comparison after consuming other2024 model errors; fixed prior from2025, componentweight25% both, newcoverage separate; limited historical adapter sensitivity, not certified independent production validation. Quote timing lacks primary corroboration. Causal quotes exclude new identities with no initial quote and invalid/gapped prior changes. Fixed2024 pit heuristic two synthetic stops per constructor and absent explicit DSQ subtype apply equally. No tuning/activation.',rounds,newCoverage,quoteOmissions,cohortAudit,missing,summary,pairedRaceBootstrap:intervals,byRound};
 console.table(summary);console.table(intervals);await writeFile(process.argv.includes('--causal')?'docs/production-cold-start-2024-causal-results.json':'docs/production-cold-start-2024-reported-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
