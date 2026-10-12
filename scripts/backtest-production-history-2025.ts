import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import totals from '../src/data/fantasy-totals-2025.json';
import prices from '../src/data/fantasy-prices-2025.json';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
import {forecastPointHistory,type PointHistoryRow} from '../src/lib/point-history-model';
const sprint=new Set([2,6,13,19,21,23]),rounds=[6,7,8,9,10,11,12,13,14];
const history=totals.observations.map(r=>({...r,season:2025,sprint:sprint.has(r.round)})) as PointHistoryRow[];
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const metrics=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function protocol(path:string,hash:string){const data=JSON.parse(await readFile(path,'utf8'));if(createHash('sha256').update(JSON.stringify(data,null,2)).digest('hex')!==hash)throw Error('Frozen protocol changed');return data}
async function main(){
 const direct=await protocol('docs/point-history-frozen-protocol.json','4d800dfc98ab371adb92de95ce2988f57923c72bd8e3113ad7375c37e866ba6d'),ensemble=await protocol('docs/point-history-ensemble-frozen-protocol.json','6127611f7b318795b9661742adc84669fd853735f639befec0c958fc2291959b');
 const outcomes:{round:number;code:string;type:string;model:string;error:number}[]=[],missing:{round:number;code:string;type:string}[]=[];
 for(const round of rounds){
  const reference=replayProductionHistory(history as ReplayScore[],prices.observations as ArchivedFantasyPrice[],{season:2025,round,sprint:sprint.has(round)});
  for(const type of ['DRIVER','CONSTRUCTOR'] as const){
   const roster=history.filter(r=>r.round===round&&r.type===type),point=forecastPointHistory(history,roster,{...direct.selected[type],season:2025,round,sprint:sprint.has(round)}),ens=forecastPointHistory(history,roster,{...ensemble.selected[type],season:2025,round,sprint:sprint.has(round)});
   for(const row of roster){const ref=reference.find(r=>r.code===row.code&&r.type===type);if(ref?.prediction==null||ref.baseline==null){missing.push({round,code:row.code,type});continue}
    const candidates=[['shared-production-pre-practice',ref.prediction],['baseline-only',ref.baseline],['frozen-direct-v1',Math.round(point[row.code]*10)/10],['frozen-ensemble-v2',Math.round(((1-ensemble.selected[type].pointWeight)*ref.prediction+ensemble.selected[type].pointWeight*ens[row.code])*10)/10]] as const;
    for(const [model,prediction] of candidates){if(!Number.isFinite(prediction))throw Error('Missing paired forecast');outcomes.push({round,code:row.code,type,model,error:prediction-row.actualPoints})}
   }
  }
 }
 const models=['shared-production-pre-practice','baseline-only','frozen-direct-v1','frozen-ensemble-v2'];
 const summary=models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metrics(outcomes.filter(r=>r.model===model&&r.type===type).map(r=>r.error))})));
 const byRound=rounds.flatMap(round=>models.flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({round,model,type,...metrics(outcomes.filter(r=>r.round===round&&r.model===model&&r.type===type).map(r=>r.error))}))));
 const pairedIntervals=[];
 for(const model of models.slice(1))for(const type of ['DRIVER','CONSTRUCTOR']){
  const blocks=rounds.map(round=>{const ref=byRound.find(r=>r.round===round&&r.model===models[0]&&r.type===type)!,other=byRound.find(r=>r.round===round&&r.model===model&&r.type===type)!;if(ref.n!==other.n)throw Error('Unpaired cohort');return {n:ref.n,delta:(other.MAE-ref.MAE)*ref.n}});
  let state=20251007;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((a,b)=>a+b.delta,0)/draw.reduce((a,b)=>a+b.n,0)}).sort((a,b)=>a-b);
  pairedIntervals.push({model,type,deltaMAE:blocks.reduce((a,b)=>a+b.delta,0)/blocks.reduce((a,b)=>a+b.n,0),low:samples[250],high:samples[9749]});
 }
 const report={scoringSeason:2025,sprintNCPenalty:-20,scope:'Shared API baseline+component calculations replayed before practice with audited historical pre-event quotes and rosters. Current active cohort, training start6, sample SD, overtake1.2, simulations3000, production seed202600+round, constructor fallback and 0.1-point output rounding retained. This is not a recreation of a stored API database or a forecast made after practice. R6–14 was consumed in previous research; this comparison is exploratory. Reserved R15–21 errors remain unused. No parameter selection or production activation.',season:2025,rounds,priceSource:prices.source,priceSourceSHA256:prices.sourceSHA256,missing,summary,pairedRaceBootstrap:pairedIntervals,byRound};
 console.table(summary);console.table(pairedIntervals);console.log('Missing production coverage',missing);await writeFile('docs/production-history-2025-rules-aware-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
