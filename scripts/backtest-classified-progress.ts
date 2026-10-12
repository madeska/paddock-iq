import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
function evaluate(rounds:number[],noise?:number,net=false){const rows=rounds.flatMap(r=>noise===undefined?forecast(r,undefined,undefined,3):forecast(r,undefined,undefined,3,undefined,false,.3,0,noise,true,undefined,net));const dr=rows.filter(r=>r.type==='DRIVER');return {...score(rows),positionsMAE:mean(dr.map(r=>Math.abs(r.components.positions-r.observed.race!.positionChange))),overtakesMAE:mean(dr.map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes)))}}
async function main(){
 const development=[6,7,8,9,10,11],later=[12,13,14,15,16];
 const candidates=[0,.05,.15,.3,.5,1].map(noise=>({noise,development:evaluate(development,noise,true)})).sort((a,b)=>a.development.objective-b.development.objective);const selected=candidates[0];
 const comparisons=[{model:'current',development:evaluate(development),later:evaluate(later)},{model:'raw-progress-matched-noise',noise:selected.noise,development:evaluate(development,selected.noise),later:evaluate(later,selected.noise)},{model:'classified-progress',noise:selected.noise,development:selected.development,later:evaluate(later,selected.noise,true)}];
 const report={note:'Exploratory previously inspected data; development-only aggregate xPts selection. Classified progress ranks starting positions among observed finishers, removing retirement promotions. Missing non-tail finishing rows cause exclusion; missing tail rows cannot be detected from contiguous ranks alone. This is net classified reordering, not a measure of legal on-track overtakes. Historical qualifying noise fixed at 0.3. No production activation.',selectedNoise:selected.noise,candidates,comparisons};console.table(comparisons.map(c=>({model:c.model,noise:c.noise,driverMAE:c.later.DRIVER.MAE,constructorMAE:c.later.CONSTRUCTOR.MAE,positionsMAE:c.later.positionsMAE,overtakesMAE:c.later.overtakesMAE})));await writeFile('docs/classified-progress-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
