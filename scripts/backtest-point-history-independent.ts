import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import data from '../src/data/fantasy-totals-2025.json';
import {forecastPointHistory,type PointHistoryRow} from '../src/lib/point-history-model';
import {priceFreeHistoricalBaseline} from '../src/lib/point-history-reference';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
const schedule=new Set([2,6,13,19,21,23]);
const history:PointHistoryRow[]=data.observations.map(r=>({...r,type:r.type as 'DRIVER'|'CONSTRUCTOR',sprint:schedule.has(r.round)}));
const mean=(xs:number[])=>xs.reduce((n,x)=>n+x,0)/xs.length;
const metrics=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(e=>e*e))),Bias:mean(errors)});
async function frozen(file:string,expected:string){const value=JSON.parse(await readFile(file,'utf8'));const hash=createHash('sha256').update(JSON.stringify(value,null,2)).digest('hex');if(hash!==expected)throw Error('Frozen protocol modified');return {value,hash}}
async function main(){
 const direct=await frozen('docs/point-history-frozen-protocol.json','4d800dfc98ab371adb92de95ce2988f57923c72bd8e3113ad7375c37e866ba6d');
 const ensemble=await frozen('docs/point-history-ensemble-frozen-protocol.json','6127611f7b318795b9661742adc84669fd853735f639befec0c958fc2291959b');
 const rounds=direct.value.independentRounds as number[];if(JSON.stringify(rounds)!==JSON.stringify(ensemble.value.independentRounds)||rounds.some(r=>r>=15)||data.sourceCommit!=='1bb0e02d06e1567e01cda53532e031a4086eac2f')throw Error('Independent protocol/source mismatch');
 const outcomes=[];
 for(const round of rounds){
  const roster=history.filter(r=>r.round===round).sort((a,b)=>a.code.localeCompare(b.code));if(roster.filter(r=>r.type==='DRIVER').length!==20||roster.filter(r=>r.type==='CONSTRUCTOR').length!==10)throw Error('Incomplete independent roster');
  const baseline=priceFreeHistoricalBaseline(history,roster,{season:2025,round});
  const drivers=roster.filter(r=>r.type==='DRIVER').map(r=>({code:r.code,team:r.team,baselineXPts:baseline[r.code],recentScores:history.filter(h=>h.type==='DRIVER'&&h.code===r.code&&h.round<round).sort((a,b)=>a.round-b.round).slice(-5).map(h=>h.actualPoints)}));
  const constructors=roster.filter(r=>r.type==='CONSTRUCTOR').map(r=>({code:r.code,baselineXPts:baseline[r.code]}));
  const runs=Array.from({length:3},(_,seed)=>simulateComponentWeekend(drivers,constructors,{sprint:schedule.has(round),simulations:1200,seed:202500+round+seed*1000,overtakeIntensity:1.8}));
  for(const type of ['DRIVER','CONSTRUCTOR'] as const){
   const targets=roster.filter(r=>r.type===type),directPred=forecastPointHistory(history,targets,{...direct.value.selected[type],season:2025,round,sprint:schedule.has(round)}),options=ensemble.value.selected[type],ensemblePred=forecastPointHistory(history,targets,{...options,season:2025,round,sprint:schedule.has(round)});
   for(const row of targets){const component=mean(runs.map(run=>(type==='DRIVER'?run.drivers:run.constructors).find(d=>d.code===row.code)!.total)),reference=.75*baseline[row.code]+.25*component;
    for(const [model,prediction] of [['price-free-reference',reference],['price-free-baseline',baseline[row.code]],['direct-v1',directPred[row.code]],['ensemble-v2',(1-options.pointWeight)*reference+options.pointWeight*ensemblePred[row.code]]] as const)outcomes.push({round,type,code:row.code,model,prediction,actual:row.actualPoints,error:prediction-row.actualPoints});
   }
  }
 }
 const models=['price-free-reference','price-free-baseline','direct-v1','ensemble-v2'];
 const summary=models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metrics(outcomes.filter(r=>r.model===model&&r.type===type).map(r=>r.error))})));
 const byRound=rounds.flatMap(round=>models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({round,model,type,...metrics(outcomes.filter(r=>r.round===round&&r.model===model&&r.type===type).map(r=>r.error))}))));
 const intervals=[];for(const model of ['direct-v1','ensemble-v2'])for(const type of ['DRIVER','CONSTRUCTOR']){
  const blocks=rounds.map(round=>{const base=byRound.find(r=>r.round===round&&r.type===type&&r.model==='price-free-reference')!,candidate=byRound.find(r=>r.round===round&&r.type===type&&r.model===model)!;if(base.n!==candidate.n)throw Error('Unpaired benchmark');return {n:base.n,sum:(candidate.MAE-base.MAE)*base.n}});
  let state=1911;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((n,b)=>n+b.sum,0)/draw.reduce((n,b)=>n+b.n,0)}).sort((a,b)=>a-b);
  intervals.push({model,type,deltaMAE:blocks.reduce((n,b)=>n+b.sum,0)/blocks.reduce((n,b)=>n+b.n,0),low:samples[250],high:samples[9749]});
 }
 const report={note:'First Fantasy-score error evaluation on these 2025 rounds; model parameters and grids were frozen on 2026 before evaluation. Retrospective cross-season comparison, not as-if-live 2025 design. Source is a third-party archived official-site extraction with audited identities/provenance, not verified official raw feeds. Comparator drops the historical price feature because no reliable 2025 pre-lock prices exist; therefore not exact deployed production. Target scores enter evaluation only. Known sprint calendar and pre-event roster assumed available. R15–21 remains reserved and is not imported by this script. No production activation.',sourceCommit:data.sourceCommit,protocols:{direct:direct.hash,ensemble:ensemble.hash},rounds,seeds:3,simulationsPerSeed:1200,summary,byRound,pairedRaceBootstrap:intervals,outcomes};
 console.table(summary);console.table(intervals);await writeFile('docs/point-history-independent-2025-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
