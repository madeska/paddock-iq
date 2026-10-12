import {writeFile} from 'node:fs/promises';
import components25 from '../src/data/component-history-2025.json';
import components26 from '../src/data/component-history-2026.json';
import totals25 from '../src/data/fantasy-totals-2025.json';
import prices25 from '../src/data/fantasy-prices-2025.json';
import practices25 from '../src/data/prelock-practice-2025.json';
import practices26 from '../src/data/session-pace-practice-2026.json';
import {fitSessionPace} from '../src/lib/session-pace';
import type {ComponentObservation} from '../src/lib/component-calibration';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
type Row={season:number;round:number;code:string;type:string;model:string;error:number};
const policies=['incumbent','classification-pace','classification-pace-practice'] as const;
const without2026Practice=process.argv.includes('--without-2026-practice');
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
async function main(){
 const rows:Row[]=[],missing:any[]=[],contexts:any[]=[];
 for(const season of [2025,2026]){
  const history=(season===2025?totals25.observations:components26.observations) as ReplayScore[];
  const quotes=(season===2025?prices25.observations:components26.observations.map(r=>({round:r.round,code:r.code,type:r.type,team:r.team,priceBefore:r.priceBefore}))) as ArchivedFantasyPrice[];
  const components=(season===2025?components25.observations:components26.observations) as ComponentObservation[];
  for(const round of season===2025?[6,7,8,9,10,11,12,13,14]:[6,7,8,9,10,11,12,13,14,15,16]){
   const weekend=season===2025?practices25.weekends.find(w=>w.round===round):without2026Practice?undefined:practices26.weekends.find(w=>w.round===round);
   if(weekend?.isSprint??[2,4,5,9,12,17].includes(round))continue;
   const practice=weekend?.practice?{isSprint:false,positions:new Map(weekend.practice.positions.map(p=>[p.code,p.position]))}:null;
   if(weekend?.practice&&Date.parse(weekend.practice.endedAt)>=Date.parse(weekend.lockTime))throw Error('Practice result after lock');
   const drivers=quotes.filter(r=>r.round===round&&r.type==='DRIVER').map(r=>r.code);
   const historical=fitSessionPace(components,{season,round,drivers}),withPractice=fitSessionPace(components,{season,round,drivers,practice:practice?.positions});
   contexts.push({season,round,practiceApplied:withPractice.practiceApplied,sourceRounds:historical.sourceRounds});
   for(const model of policies){
    const pace=model===policies[1]?historical:withPractice;
    const forecasts=replayProductionHistory(history,quotes,{season,round,sprint:false,practice,...(model===policies[0]?{}:{componentOverrides:{qualifyingPace:pace.qualifying,racePace:pace.race}})});
    for(const actual of history.filter(r=>r.season===season&&r.round===round)){
     const forecast=forecasts.find(r=>r.code===actual.code&&r.type===actual.type)?.prediction;
     if(forecast==null){if(model===policies[0])missing.push({season,round,code:actual.code,type:actual.type});continue}
     rows.push({season,round,code:actual.code,type:actual.type,model,error:forecast-actual.actualPoints});
    }
   }
  }
 }
 const summary=[2025,2026].flatMap(season=>policies.flatMap(model=>['ALL','DRIVER','CONSTRUCTOR'].map(type=>{
  const cohort=rows.filter(r=>r.season===season&&r.model===model&&(type==='ALL'||r.type===type));const e=cohort.map(r=>r.error);
  return {season,model,type,n:e.length,MAE:mean(e.map(Math.abs)),RMSE:e.length?Math.sqrt(mean(e.map(x=>x*x))!):null,Bias:mean(e)};
 })));
 const intervals=[2025,2026].flatMap(season=>policies.slice(1).flatMap(model=>['ALL','DRIVER','CONSTRUCTOR'].map(type=>{
  const original=rows.filter(r=>r.season===season&&r.model===policies[0]&&(type==='ALL'||r.type===type)),candidate=rows.filter(r=>r.season===season&&r.model===model&&(type==='ALL'||r.type===type));
  if(candidate.length!==original.length||original.some(r=>!candidate.some(c=>c.round===r.round&&c.code===r.code&&c.type===r.type)))throw Error('Unpaired pace cohort');
  const blocks=[...new Set(original.map(r=>r.round))].map(round=>{const a=original.filter(r=>r.round===round),b=candidate.filter(r=>r.round===round);return {n:a.length,delta:b.reduce((s,r)=>s+Math.abs(r.error),0)-a.reduce((s,r)=>s+Math.abs(r.error),0)}});
  let state=771;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const draws=Array.from({length:10000},()=>{const selected=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return selected.reduce((s,b)=>s+b.delta,0)/selected.reduce((s,b)=>s+b.n,0)}).sort((a,b)=>a-b);
  return {season,model,type,rounds:blocks.length,deltaMAE:blocks.reduce((s,b)=>s+b.delta,0)/original.length,low:draws[250],high:draws[9749]};
 })));
 const report={capturedAt:new Date().toISOString(),scope:'Normal weekends only. Exploratory previously consumed 2025 R6–14 and 2026 R6–16. No R15–21 2025 errors evaluated by this experiment; that window was already consumed by earlier half-blend research. 2025 uses tracked completed practice; 2026 '+(without2026Practice?'has no practice in all policies.':'uses the derived normal-weekend practice archive in all policies.'),policy:'Component ranking uses earlier normalized classification ranks with half-life4 and neutral prior5. Complete practice contributes a fixed25% strength signal; no tuning/search. Incumbent baseline practice modifier is retained identically in all policies. Reliability/overtakes/awards/pits/noise/blend unchanged. No production activation.',summary,pairedRaceBootstrap:intervals,contexts,missing};
 console.table(summary);console.table(intervals);
 await writeFile(without2026Practice?'docs/session-pace-results.json':'docs/session-pace-with-practice-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1});
