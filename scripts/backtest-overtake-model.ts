import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
import {expectedRaceOvertakes,fitOvertakeModel} from '../src/lib/overtake-model';
import data from '../src/data/component-history-2026.json';
import type {ComponentObservation} from '../src/lib/component-calibration';
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
async function main(){
 const report:any={note:'Exploratory rolling evaluation on previously inspected rounds, not a new holdout. No target/future rounds train the model. Fixed Poisson ridge=8. Only race overtakes changed; sprint and other components unchanged.',metrics:[],byRound:[],knownGrid:[],qualifyingDiagnostics:[]};
 for(const [segment,rounds] of [['development',[6,7,8,9,10,11]],['previously-inspected',[12,13,14,15,16]]] as const){
  for(const conditional of [false,true]){
   const rows=rounds.flatMap(round=>forecast(round,undefined,undefined,3,undefined,conditional));const scored=score(rows);const dr=rows.filter(r=>r.type==='DRIVER');
   if(!conditional)report.qualifyingDiagnostics.push({segment,currentQualifyingPointsMAE:mean(dr.map(r=>Math.abs(r.components.qualifying-r.observed.qualifying!.total))),priorQualifyingMeanMAE:mean(dr.map(r=>{const prior=data.observations.filter(o=>o.type==='DRIVER'&&o.code===r.code&&o.round<r.round&&o.qualifying);return Math.abs(mean((prior.length?prior:data.observations.filter(o=>o.type==='DRIVER'&&o.round<r.round&&o.qualifying)).map(o=>o.qualifying!.total))-r.observed.qualifying!.total)})),note:'Qualifying-point error is only a proxy; it does not measure full grid-ranking error'});
   for(const type of ['DRIVER','CONSTRUCTOR'] as const)report.metrics.push({segment,model:conditional?'conditional-overtakes':'current',type,...scored[type],...(type==='DRIVER'?{overtakesMAE:mean(dr.map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes)))}:{})});
   for(const round of rounds)report.byRound.push({segment,model:conditional?'conditional-overtakes':'current',round,...score(rows.filter(r=>r.round===round))});
  }
  const known=rounds.flatMap(round=>{const model=fitOvertakeModel(data.observations as ComponentObservation[],{season:2026,round});return data.observations.filter(o=>o.round===round&&o.type==='DRIVER').map((o:any)=>{const start=o.race.failed?o.qualifying.position:o.race.finishPosition+o.race.positionChange;return Math.abs(expectedRaceOvertakes(model,o.code,start,!o.race.failed)-o.race.overtakes)})});
  report.knownGrid.push({segment,n:known.length,MAE:mean(known),note:'Diagnostic using known start and classification, not a pre-weekend forecast'});
 }
 console.table(report.metrics);console.table(report.knownGrid);console.table(report.qualifyingDiagnostics);await writeFile('docs/overtake-model-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
