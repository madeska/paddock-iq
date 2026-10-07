import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import data from '../src/data/component-history-2026.json';
import {forecast} from './backtest-component-calibration';
import {forecastPointHistory,type PointHistoryRow} from '../src/lib/point-history-model';
const history:PointHistoryRow[]=data.observations.map(r=>({...r,sprint:'sprint' in r}));
const mean=(xs:number[])=>xs.reduce((n,x)=>n+x,0)/xs.length;
const metrics=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(e=>e*e))),Bias:mean(errors)});
async function main(){
 const development=[6,7,8,9,10,11],later=[12,13,14,15,16],cache=new Map<number,ReturnType<typeof forecast>>();for(const r of [...development,...later])cache.set(r,forecast(r,undefined,undefined,3));
 const candidates=[];
 for(const alpha of [.15,.25,.4])for(const ridge of [10,50,200])for(const sprintFactor of [1,1.3]){
  const rows=[];for(const round of development){const target=history.filter(r=>r.round===round),prediction=forecastPointHistory(history,target,{season:2026,round,sprint:target.some(r=>r.sprint),alpha,ridge,sprintFactor});for(const row of cache.get(round)!)rows.push({type:row.type,actual:row.actual,current:row.prediction,direct:prediction[row.code]})}
  for(const pointWeight of [0,.1,.25,.5,1])candidates.push({options:{alpha,ridge,sprintFactor,pointWeight},DRIVER:metrics(rows.filter(r=>r.type==='DRIVER').map(r=>(1-pointWeight)*r.current+pointWeight*r.direct-r.actual)),CONSTRUCTOR:metrics(rows.filter(r=>r.type==='CONSTRUCTOR').map(r=>(1-pointWeight)*r.current+pointWeight*r.direct-r.actual))});
 }
 const selected={DRIVER:[...candidates].sort((a,b)=>a.DRIVER.MAE-b.DRIVER.MAE||a.options.pointWeight-b.options.pointWeight)[0].options,CONSTRUCTOR:[...candidates].sort((a,b)=>a.CONSTRUCTOR.MAE-b.CONSTRUCTOR.MAE||a.options.pointWeight-b.options.pointWeight)[0].options};
 const protocol={version:'point-history-team-ensemble-v2',developmentSeason:2026,developmentRounds:development,selected,selectionObjective:'per-type MAE, ties favor lower point weight',candidateCount:candidates.length,independentSeason:2025,independentRounds:[6,7,8,9,10,11,12,13,14],reservedRounds:[15,16,17,18,19,20,21],independentComparator:'price-free adaptation of current historical baseline and component blend; exact production comparator unavailable without historical prices',featureDefinition:'Same point-history-team-v1 features; combine frozen point model with current forecast at pointWeight. Fit each season only on earlier rows. No production activation.'};const frozen=JSON.stringify(protocol,null,2);await writeFile('docs/point-history-ensemble-frozen-protocol.json',frozen);console.log('Protocol hash',createHash('sha256').update(frozen).digest('hex'));
 const comparisons=[];for(const [segment,rounds] of [['development',development],['previously-inspected',later]] as const){const errors=[];for(const round of rounds){const target=history.filter(r=>r.round===round);for(const type of ['DRIVER','CONSTRUCTOR'] as const){const options=selected[type],prediction=forecastPointHistory(history,target.filter(r=>r.type===type),{...options,season:2026,round,sprint:target.some(r=>r.sprint)});for(const row of cache.get(round)!.filter(r=>r.type===type))errors.push({type,current:row.prediction-row.actual,candidate:(1-options.pointWeight)*row.prediction+options.pointWeight*prediction[row.code]-row.actual})}}
  for(const type of ['DRIVER','CONSTRUCTOR'] as const)comparisons.push({segment,type,current:metrics(errors.filter(r=>r.type===type).map(r=>r.current)),candidate:metrics(errors.filter(r=>r.type===type).map(r=>r.candidate))});}
 console.log(JSON.stringify({selected,comparisons},null,2));await writeFile('docs/point-history-ensemble-2026-results.json',JSON.stringify({note:'Exploratory reused 2026 data, all parameters and blend weights selected on R6–11 only. Frozen before independent 2025 error evaluation. No production activation.',selected,candidates,comparisons},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
