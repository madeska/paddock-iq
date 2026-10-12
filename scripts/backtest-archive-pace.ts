import {writeFile} from 'node:fs/promises';
import data from '../src/data/race-archive-2025.json';
import {fitArchivedPace} from '../src/lib/archive-pace';
import type {ArchivedRace} from '../src/lib/race-archive';
import {calibrateComponents} from '../src/lib/component-calibration';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
const meetings=data.meetings as ArchivedRace[];
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:NaN;
const metrics=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(e=>e*e))),Bias:mean(errors)});
async function main(){
 const outcomes:any[]=[],excluded:any[]=[];
 for(const race of meetings.filter(r=>r.round>=6)){
  const grid=Object.fromEntries(race.drivers.map(d=>[d.code,d.grid??(d.pitLane?race.drivers.length+1:null)]));if(Object.values(grid).some(v=>v===null)){excluded.push({round:race.round,reason:'Unknown actual race grid'});continue}
  const pace=fitArchivedPace(meetings,{year:2025,round:race.round,fieldSize:20});
  const drivers=race.drivers.map(d=>({code:d.code,team:d.team,baselineXPts:pace.performanceIndex[d.code]??10.5,recentScores:[]}));
  const calibration=calibrateComponents([],{season:2025,round:race.round});calibration.driverSessions=1;calibration.globalDriverRates={...calibration.globalDriverRates,dnfProbability:pace.globalFailureProbability,noTimeProbability:0,raceOvertakesMean:0,failedRaceOvertakesMean:0};
  for(const d of race.drivers)calibration.drivers[d.code]={...calibration.globalDriverRates,dnfProbability:pace.failureProbability[d.code]??pace.globalFailureProbability};
  for(const timing of ['pre-qualifying','known-grid'] as const)for(const model of ['ordinal-index','historical-race-pace','grid-progress'] as const){
   const runs=Array.from({length:5},(_,seed)=>simulateComponentWeekend(drivers,[],{sprint:false,simulations:2000,seed:202500+race.round+1000*seed,calibration,overtakeIntensity:0,qualifyingPace:pace.qualifyingPace,qualifyingNoise:.15,...(timing==='known-grid'?{raceStartingGrid:grid as Record<string,number>}:{}),includeRankDiagnostics:true,...(model==='historical-race-pace'?{racePace:pace.racePace,raceNoise:.15}:model==='grid-progress'?{raceProgress:pace.progress,raceNoise:0}:{})}));
   for(const driver of race.drivers){
    const diagnostics=runs.map(r=>r.rankDiagnostics!.find(d=>d.code===driver.code)!);
    const expectedFinish=mean(diagnostics.map(d=>d.expectedClassifiedFinish!)),expectedGain=mean(diagnostics.map(d=>d.expectedClassifiedPositionChange!)),failure=1-mean(diagnostics.map(d=>d.finishProbability));
    const failed=driver.dnf===true||driver.dns===true||driver.dsq===true;
    outcomes.push({round:race.round,code:driver.code,model,timing,resultKnown:driver.resultKnown,failed,rankError:driver.resultKnown&&!failed&&driver.finish!==null?expectedFinish-driver.finish:null,gainError:driver.resultKnown&&!failed&&driver.finish!==null?expectedGain-(grid[driver.code]!-driver.finish):null,failureSquaredError:driver.resultKnown?(failure-Number(failed))**2:null});
   }
  }
 }
 const summary=[];for(const timing of ['pre-qualifying','known-grid'])for(const model of ['ordinal-index','historical-race-pace','grid-progress']){const rows=outcomes.filter(r=>r.model===model&&r.timing===timing);summary.push({model,timing,finishRank:metrics(rows.filter(r=>r.rankError!==null).map(r=>r.rankError)),positionChange:metrics(rows.filter(r=>r.gainError!==null).map(r=>r.gainError)),physicalFailureBrier:mean(rows.filter(r=>r.failureSquaredError!==null).map(r=>r.failureSquaredError))})}
 const byRound=[];for(const round of [...new Set(outcomes.map(o=>o.round))])for(const timing of ['pre-qualifying','known-grid'])for(const model of ['ordinal-index','historical-race-pace','grid-progress']){const rows=outcomes.filter(r=>r.round===round&&r.model===model&&r.timing===timing);byRound.push({round,model,timing,finishRank:metrics(rows.filter(r=>r.rankError!==null).map(r=>r.rankError))})}
 const pairedRoundIntervals=[];let state=5517;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(const timing of ['pre-qualifying','known-grid']){
  const blocks=byRound.filter(r=>r.model==='ordinal-index'&&r.timing===timing).map(base=>{const candidate=byRound.find(r=>r.round===base.round&&r.model==='grid-progress'&&r.timing===timing)!;if(base.finishRank.n!==candidate.finishRank.n)throw Error('Mismatched paired sample');return {n:base.finishRank.n,sum:(candidate.finishRank.MAE-base.finishRank.MAE)*base.finishRank.n}});
  const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((n,b)=>n+b.sum,0)/draw.reduce((n,b)=>n+b.n,0)}).sort((a,b)=>a-b);
  pairedRoundIntervals.push({timing,mean:blocks.reduce((n,b)=>n+b.sum,0)/blocks.reduce((n,b)=>n+b.n,0),low:samples[250],high:samples[9749],negativeIsBetter:true,note:'Paired race-block bootstrap for conditional-finisher rank MAE; fixed settings on a new retrospective season, not full Fantasy forecasts'});
 }
 const report={note:'Cross-season retrospective test with fixed previously selected settings, not an as-if-live 2025 forecast or full Fantasy xPts validation. Current comparator uses an ordinal qualifying/finishing-history index because 2025 Fantasy prices/points are unavailable. Pre-qualifying forecasts use simulated qualifying from prior sessions; known-grid forecasts use actual starting grid available before race. Target failure/finish labels enter evaluation only. Physical OpenF1 flags do not imply Fantasy non-classification. No overtake labels are fabricated. No production activation.',year:2025,settings:{firstEvaluationRound:6,seeds:5,simulationsPerSeed:2000,historyPrior:5,racePaceNoise:.15,progressRaceNoise:0},coverage:{races:meetings.length,driverRecords:meetings.reduce((n,r)=>n+r.drivers.length,0),unknownResults:meetings.flatMap(r=>r.drivers).filter(d=>!d.resultKnown).length,unknownQualifying:meetings.flatMap(r=>r.drivers).filter(d=>d.qualifyingDns===null).length,excluded},summary,byRound,pairedRoundIntervals};
 console.table(summary.map(s=>({model:s.model,timing:s.timing,n:s.finishRank.n,finishMAE:s.finishRank.MAE,finishRMSE:s.finishRank.RMSE,gainMAE:s.positionChange.MAE,physicalFailureBrier:s.physicalFailureBrier})));console.table(pairedRoundIntervals);console.log(JSON.stringify(report.coverage));await writeFile('docs/archive-pace-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
