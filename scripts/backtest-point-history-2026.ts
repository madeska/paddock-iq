import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import data from '../src/data/component-history-2026.json';
import {forecast,score} from './backtest-component-calibration';
import {forecastPointHistory,type PointHistoryRow} from '../src/lib/point-history-model';
const history:PointHistoryRow[]=data.observations.map(r=>({...r,sprint:'sprint' in r}));
const mean=(xs:number[])=>xs.reduce((n,x)=>n+x,0)/xs.length;
const metrics=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(e=>e*e))),Bias:mean(errors)});
async function main(){
 const development=[6,7,8,9,10,11],later=[12,13,14,15,16];const candidates=[];
 for(const alpha of [.15,.25,.4])for(const ridge of [10,50,200])for(const sprintFactor of [1,1.3]){
  const options={alpha,ridge,sprintFactor},errors=[];
  for(const round of development){const target=history.filter(r=>r.round===round),prediction=forecastPointHistory(history,target,{...options,season:2026,round,sprint:target.some(r=>r.sprint)});errors.push(...target.map(r=>({type:r.type,error:prediction[r.code]-r.actualPoints})))}
  candidates.push({options,DRIVER:metrics(errors.filter(r=>r.type==='DRIVER').map(r=>r.error)),CONSTRUCTOR:metrics(errors.filter(r=>r.type==='CONSTRUCTOR').map(r=>r.error))});
 }
 const selected={DRIVER:[...candidates].sort((a,b)=>a.DRIVER.MAE-b.DRIVER.MAE)[0].options,CONSTRUCTOR:[...candidates].sort((a,b)=>a.CONSTRUCTOR.MAE-b.CONSTRUCTOR.MAE)[0].options};
 // Freeze the complete selection before an independent-season benchmark may run.
 const protocol={version:'point-history-team-v1',developmentSeason:2026,developmentRounds:development,selectionObjective:'per-type MAE',selected,independentSeason:2025,independentRounds:[6,7,8,9,10,11,12,13,14],independentComparator:'price-free adaptation of current historical baseline and component blend; exact production comparator unavailable without historical prices',featureDefinition:'normalized own EWMA, last-3 mean, overall mean, current-team driver EWMA, trend, score SD, n/(n+5); separate pooled ridge per type; no target/future labels',candidateGrid:{alpha:[.15,.25,.4],ridge:[10,50,200],sprintFactor:[1,1.3]},noProductionActivation:true};
 const frozen=JSON.stringify(protocol,null,2);await writeFile('docs/point-history-frozen-protocol.json',frozen);console.log('Frozen protocol SHA256',createHash('sha256').update(frozen).digest('hex'));
 const comparisons=[];
 for(const [segment,rounds] of [['development',development],['previously-inspected',later]] as const){
  const errors=[];for(const round of rounds){const target=history.filter(r=>r.round===round);for(const type of ['DRIVER','CONSTRUCTOR'] as const){const prediction=forecastPointHistory(history,target.filter(r=>r.type===type),{...selected[type],season:2026,round,sprint:target.some(r=>r.sprint)});errors.push(...target.filter(r=>r.type===type).map(r=>({type,error:prediction[r.code]-r.actualPoints})))} }
  const current=score(rounds.flatMap(r=>forecast(r,undefined,undefined,3)));for(const type of ['DRIVER','CONSTRUCTOR'] as const)comparisons.push({segment,type,current:current[type],candidate:metrics(errors.filter(r=>r.type===type).map(r=>r.error))});
 }
 const report={note:'Price-free team-history ridge, development-only per-type setting selection; 2026 later rounds already inspected. Protocol frozen before independent 2025 error evaluation. No production activation.',selected,candidates,comparisons};console.log(JSON.stringify({selected,comparisons},null,2));await writeFile('docs/point-history-2026-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
