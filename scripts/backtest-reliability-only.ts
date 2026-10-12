import {writeFile} from 'node:fs/promises';
import components25 from '../src/data/component-history-2025.json';
import components26 from '../src/data/component-history-2026.json';
import totals25 from '../src/data/fantasy-totals-2025.json';
import prices25 from '../src/data/fantasy-prices-2025.json';
import practices25 from '../src/data/prelock-practice-2025.json';
import {calibrateComponents,type ComponentObservation} from '../src/lib/component-calibration';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
type ErrorRow={season:number;round:number;sprint:boolean;code:string;type:string;base:number;candidate:number};
type FailureRow={season:number;round:number;session:'RACE'|'SPRINT';sprintWeekend:boolean;failed:boolean;base:number;candidate:number};
const errors:ErrorRow[]=[],failures:FailureRow[]=[],missing:any[]=[];
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const metrics=(rows:ErrorRow[],key:'base'|'candidate')=>({n:rows.length,MAE:mean(rows.map(r=>Math.abs(r[key]))),RMSE:rows.length?Math.sqrt(mean(rows.map(r=>r[key]**2))!):null,Bias:mean(rows.map(r=>r[key]))});
function bootstrap(rows:ErrorRow[]){
 const rounds=[...new Set(rows.map(r=>r.round))];if(!rounds.length)return null;
 const blocks=rounds.map(round=>{const block=rows.filter(r=>r.round===round);return {n:block.length,delta:block.reduce((sum,r)=>sum+Math.abs(r.candidate)-Math.abs(r.base),0)}});
 let state=771;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const draws=Array.from({length:10000},()=>{const selected=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return selected.reduce((s,b)=>s+b.delta,0)/selected.reduce((s,b)=>s+b.n,0)}).sort((a,b)=>a-b);
 return {rounds:rounds.length,deltaMAE:blocks.reduce((s,b)=>s+b.delta,0)/rows.length,low:draws[250],high:draws[9749]};
}
async function main(){
 for(const season of [2025,2026]){
  const history=(season===2025?totals25.observations:components26.observations) as ReplayScore[];
  const quotes=(season===2025?prices25.observations:components26.observations.map(r=>({round:r.round,code:r.code,type:r.type,team:r.team,priceBefore:r.priceBefore}))) as ArchivedFantasyPrice[];
  const componentHistory=(season===2025?components25.observations:components26.observations) as ComponentObservation[];
  const rounds=season===2025?[6,7,8,9,10,11,12,13,14]:[6,7,8,9,10,11,12,13,14,15,16];
  for(const round of rounds){
   const weekend=season===2025?practices25.weekends.find(w=>w.round===round):undefined;
   const sprint=weekend?.isSprint??[2,4,5,9,12,17].includes(round);
   const practice=weekend?.practice?{isSprint:sprint,positions:new Map(weekend.practice.positions.map(p=>[p.code,p.position]))}:null;
   const calibration=calibrateComponents(componentHistory,{season,round,priorStrength:16,halfLife:16});
   const options={season,round,sprint,practice};
   const baseline=replayProductionHistory(history,quotes,options),candidate=replayProductionHistory(history,quotes,{...options,componentOverrides:{calibration,calibrationMode:'reliability-only'}});
   for(const row of history.filter(r=>r.season===season&&r.round===round)){
    const from=baseline.find(r=>r.code===row.code&&r.type===row.type)?.prediction,to=candidate.find(r=>r.code===row.code&&r.type===row.type)?.prediction;
    if(from==null||to==null){missing.push({season,round,code:row.code,type:row.type});continue}
    errors.push({season,round,sprint,code:row.code,type:row.type,base:from-row.actualPoints,candidate:to-row.actualPoints});
    if(row.type!=='DRIVER')continue;
    const observation=componentHistory.find(r=>r.season===season&&r.round===round&&r.code===row.code&&r.type==='DRIVER');
    const recent=history.filter(r=>r.season===season&&r.type==='DRIVER'&&r.code===row.code&&r.round<round).sort((a,b)=>a.round-b.round).slice(-5);
    const dnf=Math.max(.035,Math.min(.18,.045+.14*(recent.length?recent.filter(r=>r.actualPoints<0).length/recent.length:0)));
    const calibrated=calibration.driverSessions>0?(calibration.drivers[row.code]??calibration.globalDriverRates):null;
    if(observation?.race)failures.push({season,round,session:'RACE',sprintWeekend:sprint,failed:observation.race.failed,base:dnf,candidate:calibrated?.dnfProbability??dnf});
    if(sprint&&observation?.sprint)failures.push({season,round,session:'SPRINT',sprintWeekend:true,failed:observation.sprint.failed,base:Math.min(.07,dnf*.55),candidate:calibrated?.sprintDnfProbability??Math.min(.07,dnf*.55)});
   }
  }
 }
 const summary=[2025,2026].flatMap(season=>['ALL','NORMAL','SPRINT'].flatMap(weekend=>['ALL','DRIVER','CONSTRUCTOR'].map(type=>{
  const rows=errors.filter(r=>r.season===season&&(weekend==='ALL'||r.sprint===(weekend==='SPRINT'))&&(type==='ALL'||r.type===type));
  return {season,weekend,type,baseline:metrics(rows,'base'),reliabilityOnly:metrics(rows,'candidate'),pairedRaceBootstrap:bootstrap(rows)};
 })));
 const reliability=[2025,2026].flatMap(season=>['RACE','SPRINT'].flatMap(session=>['ALL','NORMAL','SPRINT'].map(weekend=>{
  const rows=failures.filter(r=>r.season===season&&r.session===session&&(weekend==='ALL'||r.sprintWeekend===(weekend==='SPRINT')));
  return {season,session,weekend,n:rows.length,observedRate:mean(rows.map(r=>Number(r.failed))),baselineBrier:mean(rows.map(r=>(r.base-Number(r.failed))**2)),candidateBrier:mean(rows.map(r=>(r.candidate-Number(r.failed))**2))};
 })));
 const report={capturedAt:new Date().toISOString(),scope:'Exploratory previously consumed 2025 R6–14 and 2026 R6–16; not independent validation. No reserved 2025 R15–21 errors are evaluated. 2025 uses the tracked pre-lock practice archive; 2026 deliberately uses no practice for both paired policies. These are separate protocols, not a replay of the saved Singapore live forecast.',policy:'Only race and sprint failure probabilities change. Fixed priorStrength=16/halfLife=16 from earlier research; no parameter search. Every target is forecast from earlier-round scores and components. No production activation.',summary,reliability,missing};
 console.table(summary.filter(r=>r.type==='ALL').map(r=>({season:r.season,weekend:r.weekend,n:r.baseline.n,baselineMAE:r.baseline.MAE,candidateMAE:r.reliabilityOnly.MAE,delta:r.pairedRaceBootstrap?.deltaMAE,low:r.pairedRaceBootstrap?.low,high:r.pairedRaceBootstrap?.high})));
 console.table(reliability.filter(r=>r.n>0));
 await writeFile('docs/reliability-only-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1});
