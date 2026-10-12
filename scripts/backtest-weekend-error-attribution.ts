import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
async function main(){
 const rounds=[12,13,14,15,16],current=rounds.flatMap(r=>forecast(r,undefined,undefined,3)),candidate=rounds.flatMap(r=>forecast(r,undefined,undefined,3,undefined,false,.3));
 const paired=current.map((base,i)=>{const changed=candidate[i];if(base.code!==changed.code||base.round!==changed.round||base.type!==changed.type)throw Error('Unpaired rows');return {base,changed}});
 const components=[];
 for(const type of ['DRIVER','CONSTRUCTOR'] as const){
  const rows=paired.filter(r=>r.base.type===type),keys=type==='DRIVER'?['qualifying','sprint','raceFinish','positions','overtakes','fastestLap','driverOfTheDay','dnfPenalty']:['qualifying','sprint','raceDrivers','pitStops'];
  for(const key of keys){
   const swapped=rows.map(({base,changed})=>({...base,prediction:base.prediction+.25*(changed.components[key]-base.components[key])}));
   const restored=rows.map(({base,changed})=>({...changed,prediction:changed.prediction+.25*(base.components[key]-changed.components[key])}));
   const metric=(xs:typeof current)=>score(xs)[type].MAE;
   components.push({type,component:key,meanComponentShift:mean(rows.map(r=>r.changed.components[key]-r.base.components[key])),swapIntoCurrentMAEDelta:metric(swapped)-metric(rows.map(r=>r.base)),restoreCurrentInCandidateMAEDelta:metric(restored)-metric(rows.map(r=>r.changed))});
  }
 }
 for(const {base,changed} of paired){const keys=base.type==='DRIVER'?['qualifying','sprint','raceFinish','positions','overtakes','fastestLap','driverOfTheDay','dnfPenalty']:['qualifying','sprint','raceDrivers','pitStops'];for(const row of [base,changed])if(Math.abs(keys.reduce((n,k)=>n+row.components[k],0)-row.components.total)>1e-6)throw Error('Component accounting mismatch')}
 const report={note:'Post-hoc attribution on previously inspected R12–16. Component swaps are arithmetic counterfactuals, not realizable coherent simulations and not additive causal effects. They use forecast expectations only, no observed components as oracle replacements. Actual scores enter evaluation only. Negative MAE delta is better. Fixed candidate: historical qualifying pace/noise 0.3. No parameter selection or production activation.',rounds,current:score(current),candidate:score(candidate),components};
 console.table(components);await writeFile('docs/weekend-error-attribution-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
