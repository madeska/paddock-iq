import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const qualifyingMAE=(rows:ReturnType<typeof forecast>)=>mean(rows.filter(r=>r.type==='DRIVER').map(r=>Math.abs(r.components.qualifying-r.observed.qualifying!.total)));
async function main(){
 const development=[6,7,8,9,10,11],later=[12,13,14,15,16];
 const candidates=[.15,.3,.5,.75,1.05].map(noise=>{const rows=development.flatMap(round=>forecast(round,undefined,undefined,1,undefined,false,noise));return {noise,qualifyingMAE:qualifyingMAE(rows),...score(rows)}}).sort((a,b)=>a.qualifyingMAE-b.qualifyingMAE);
 const selected=candidates[0].noise;
 const report:any={note:'Exploratory on previously inspected data, not a fresh holdout. Noise selected using qualifying points on development rounds only; overall xPts must also be assessed. No production activation.',selectedNoise:selected,candidates,metrics:[],byRound:[]};
 for(const [segment,rounds] of [['development',development],['previously-inspected',later]] as const)for(const [model,noise,conditional] of [['current',undefined,false],['qualifying-history',selected,false],['qualifying-plus-overtakes',selected,true]] as const){
  const rows=rounds.flatMap(round=>forecast(round,undefined,undefined,3,undefined,conditional,noise));const scores=score(rows);
  for(const type of ['DRIVER','CONSTRUCTOR'] as const)report.metrics.push({segment,model,type,...scores[type],...(type==='DRIVER'?{qualifyingMAE:qualifyingMAE(rows),overtakesMAE:mean(rows.filter(r=>r.type==='DRIVER').map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes)))}:{})});
  for(const round of rounds)report.byRound.push({segment,model,round,...score(rows.filter(r=>r.round===round))});
 }
 console.table(candidates.map(c=>({noise:c.noise,qualifyingMAE:c.qualifyingMAE,driverMAE:c.DRIVER.MAE,constructorMAE:c.CONSTRUCTOR.MAE})));console.table(report.metrics);await writeFile('docs/qualifying-model-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
