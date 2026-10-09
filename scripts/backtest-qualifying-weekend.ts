import {writeFile} from 'node:fs/promises';
import {forecast,score} from './backtest-component-calibration';
const development=[6,7,8,9,10,11],later=[12,13,14,15,16];
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
function evaluate(rounds:number[],noise?:number){
 const rows=rounds.flatMap(r=>forecast(r,undefined,undefined,3,undefined,false,noise));
 const dr=rows.filter(r=>r.type==='DRIVER');
 return {...score(rows),qualifyingMAE:mean(dr.map(r=>Math.abs(r.components.qualifying-r.observed.qualifying!.total))),overtakesMAE:mean(dr.map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes))),byRound:rounds.map(round=>({round,...score(rows.filter(r=>r.round===round))}))};
}
async function main(){
 const candidates=[.15,.3,.5,.75,1.05].map(noise=>({noise,development:evaluate(development,noise)})).sort((a,b)=>a.development.objective-b.development.objective);
 const selected=candidates[0];
 const comparisons=[{model:'current',development:evaluate(development),later:evaluate(later)},{model:'development-selected',noise:selected.noise,development:selected.development,later:evaluate(later,selected.noise)},{model:'archive-noise-probe',noise:.3,development:candidates.find(c=>c.noise===.3)!.development,later:evaluate(later,.3)}];
 const report={note:'Exploratory on previously inspected 2026 data. Full 75% baseline + 25% component xPts forecasts. Qualifying pace is historical; current comparator retains baseline-derived qualifying strengths. Noise selected only on R6–11 by driver MAE + 0.5 constructor MAE. R12–16 is not a fresh holdout. Archive noise 0.3 is a fixed secondary probe. No production activation.',developmentRounds:development,laterRounds:later,seeds:3,simulationsPerSeed:1200,selectedNoise:selected.noise,candidates,comparisons};
 console.table(comparisons.map(c=>({model:c.model,noise:c.noise,laterDriverMAE:c.later.DRIVER.MAE,laterConstructorMAE:c.later.CONSTRUCTOR.MAE,qualifyingMAE:c.later.qualifyingMAE,overtakesMAE:c.later.overtakesMAE,objective:c.later.objective})));
 await writeFile('docs/qualifying-weekend-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
