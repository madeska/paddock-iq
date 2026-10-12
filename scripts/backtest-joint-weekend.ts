import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const development=[6,7,8,9,10,11],later=[12,13,14,15,16];
type Candidate={name:string;correlation:number;qualifyingNoise?:number;raceNoise?:number;conditional:boolean};
const predict=(round:number,c:Candidate)=>forecast(round,undefined,undefined,3,undefined,c.conditional,c.qualifyingNoise,c.correlation,c.raceNoise);
function summarize(rows:ReturnType<typeof forecast>){const drivers=rows.filter(r=>r.type==='DRIVER');return {...score(rows),qualifyingMAE:mean(drivers.map(r=>Math.abs(r.components.qualifying-r.observed.qualifying!.total))),overtakesMAE:mean(drivers.map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes))),positionsMAE:mean(drivers.map(r=>Math.abs(r.components.positions-r.observed.race!.positionChange)))}}
function interval(values:number[]){let seed=1907;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const samples=Array.from({length:10000},()=>mean(values.map(()=>values[Math.floor(random()*values.length)]))).sort((a,b)=>a-b);return {mean:mean(values),low:samples[250],high:samples[9749],note:'Exploratory paired round-block bootstrap, only five previously inspected rounds; not proof of generalization'}}
async function main(){
 const candidates:any[]=[];
 const current:Candidate={name:'current',correlation:0,conditional:false};
 for(const family of [{name:'joint',qualifyingNoise:undefined,conditional:false},{name:'joint-overtakes',qualifyingNoise:undefined,conditional:true},{name:'joint-qualifying',qualifyingNoise:.15,conditional:false},{name:'joint-qualifying-overtakes',qualifyingNoise:.15,conditional:true}])for(const correlation of [0,.25,.5,.75,1]){const c={...family,correlation};const rows=development.flatMap(round=>predict(round,c));candidates.push({...c,...summarize(rows)})}
 for(const qualifyingNoise of [undefined,.15])for(const raceNoise of [.15,.3,.5,.75,1])for(const correlation of [0,.5])for(const conditional of [false,true]){const c={name:'historical-race-pace',qualifyingNoise,raceNoise,correlation,conditional};const rows=development.flatMap(round=>predict(round,c));candidates.push({...c,...summarize(rows)})}
 candidates.sort((a,b)=>a.objective-b.objective);const selected:Candidate=candidates[0];
 const report:any={note:'All candidate selection uses development rounds 6–11 only. Rounds 12–16 were already inspected; this is exploratory research, not a fresh holdout. Shared Gaussian form is mapped to Gumbel session shocks to retain the existing ranking marginals. Production settings are unchanged.',developmentRounds:development,evaluationRounds:later,selected,candidates,metrics:[],byRound:[],pairedRoundMAEDifference:[]};
 for(const [segment,rounds] of [['development',development],['previously-inspected',later]] as const){
  const base=rounds.flatMap(round=>predict(round,current)),joint=rounds.flatMap(round=>predict(round,selected));
  for(const [model,rows] of [['current',base],['selected-candidate',joint]] as const){const summary=summarize(rows);for(const type of ['DRIVER','CONSTRUCTOR'] as const)report.metrics.push({segment,model,type,...summary[type],...(type==='DRIVER'?{qualifyingMAE:summary.qualifyingMAE,overtakesMAE:summary.overtakesMAE,positionsMAE:summary.positionsMAE}:{})});for(const round of rounds)report.byRound.push({segment,model,round,...summarize(rows.filter(r=>r.round===round))})}
  if(segment==='previously-inspected')for(const type of ['DRIVER','CONSTRUCTOR'] as const){const deltas=rounds.map(round=>score(joint.filter(r=>r.round===round))[type].MAE-score(base.filter(r=>r.round===round))[type].MAE);report.pairedRoundMAEDifference.push({type,...interval(deltas),negativeIsBetter:true})}
 }
 console.table(candidates.map(c=>({family:c.name,rho:c.correlation,raceNoise:c.raceNoise,qualifyingNoise:c.qualifyingNoise,conditional:c.conditional,objective:c.objective,driverMAE:c.DRIVER.MAE,constructorMAE:c.CONSTRUCTOR.MAE})));console.log('Selected on development:',selected.name,selected.correlation);console.table(report.metrics);console.table(report.pairedRoundMAEDifference);await writeFile('docs/joint-weekend-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
