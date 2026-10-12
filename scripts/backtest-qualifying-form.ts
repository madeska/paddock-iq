import {writeFile} from 'node:fs/promises';
import data from '../src/data/race-archive-2025.json';
import type {ArchivedRace} from '../src/lib/race-archive';
import {fitArchivedPace} from '../src/lib/archive-pace';
import {fitQualifyingForm,expectedQualifyingRanks,type QualifyingFormOptions} from '../src/lib/qualifying-form';
const history=data.meetings as ArchivedRace[];
const metrics=(errors:number[])=>({n:errors.length,MAE:errors.reduce((n,e)=>n+Math.abs(e),0)/errors.length,RMSE:Math.sqrt(errors.reduce((n,e)=>n+e*e,0)/errors.length)});
function evaluate(options:Partial<QualifyingFormOptions>&{noise:number},first:number,last:number,baseline=false){
 const rows=[];
 for(const race of history.filter(r=>r.round>=first&&r.round<=last)){
  const historical=baseline?fitArchivedPace(history,{year:2025,round:race.round}):undefined;
  const pace=baseline?Object.fromEntries(race.drivers.map(d=>[d.code,historical!.qualifyingPace[d.code]??0])):fitQualifyingForm(history,race.drivers,{...options,year:2025,round:race.round});
  const runs=Array.from({length:3},(_,seed)=>expectedQualifyingRanks(pace,options.noise,2000,202500+race.round+seed*1000));
  for(const d of race.drivers)if(d.qualifyingPosition!==null&&!d.qualifyingDsq&&!d.qualifyingDns)rows.push({round:race.round,code:d.code,error:runs.reduce((n,r)=>n+r[d.code],0)/runs.length-d.qualifyingPosition});
 }
 return {metrics:metrics(rows.map(r=>r.error)),byRound:[...new Set(rows.map(r=>r.round))].map(round=>({round,...metrics(rows.filter(r=>r.round===round).map(r=>r.error))}))};
}
async function main(){
 const candidates=[];
 for(const halfLife of [undefined,2,4,8])for(const driverPrior of [0,2,5])for(const teamPrior of [0,5])for(const noise of [.1,.15,.3]){
  const options={halfLife,driverPrior,teamPrior,noise};candidates.push({options,development:evaluate(options,6,12)});
 }
 candidates.sort((a,b)=>a.development.metrics.MAE-b.development.metrics.MAE);
 const selected=candidates[0],baselineDevelopment=evaluate({noise:.15},6,12,true),baselineLater=evaluate({noise:.15},13,24,true),selectedLater=evaluate(selected.options,13,24),noiseOnlyLater=evaluate({noise:selected.options.noise},13,24,true);
 const blocks=baselineLater.byRound.map(b=>{const c=selectedLater.byRound.find(r=>r.round===b.round)!;return {n:b.n,sum:(c.MAE-b.MAE)*b.n}});
 let state=771;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const bootstrap=Array.from({length:10000},()=>{const sample=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return sample.reduce((n,b)=>n+b.sum,0)/sample.reduce((n,b)=>n+b.n,0)}).sort((a,b)=>a-b);
 const report={note:'Research only. Settings selected on R6–12; R13–24 already inspected in prior archive research, so exploratory evaluation, not a fresh holdout. Predicts qualifying ranks, not Fantasy xPts or penalty-adjusted starting grid. Current target roster/team assumed known beforehand; target qualifying results used only for evaluation. No production activation.',settings:{seeds:3,simulations:2000,candidates:candidates.length},selected,baselineDevelopment,baselineLater,selectedLater,noiseOnlyLater,pairedRaceBootstrap:{deltaMAE:selectedLater.metrics.MAE-baselineLater.metrics.MAE,low:bootstrap[250],high:bootstrap[9749]},candidates};
 console.log(JSON.stringify({selected:selected.options,development:{baseline:baselineDevelopment.metrics,candidate:selected.development.metrics},later:{baseline:baselineLater.metrics,candidate:selectedLater.metrics,noiseOnly:noiseOnlyLater.metrics},interval:report.pairedRaceBootstrap},null,2));
 await writeFile('docs/qualifying-form-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
