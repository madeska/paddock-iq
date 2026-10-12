import {writeFile} from 'node:fs/promises';
import {forecast} from './backtest-component-calibration';
type Row=ReturnType<typeof forecast>[number];
const families=['current','classified-progress','conditional-overtakes','conditional-driver-prior'] as const;
const weights=[0,.1,.25,.5,1];
function predict(round:number,family:typeof families[number]){return family==='current'?forecast(round,undefined,undefined,3):forecast(round,undefined,undefined,3,undefined,family.startsWith('conditional'),.3,0,0,true,family==='conditional-driver-prior'?{driverPrior:5}:undefined,true)}
const value=(row:Row,weight:number)=>(1-weight)*row.baseline+weight*row.components.total;
const metric=(rows:{error:number}[])=>({n:rows.length,MAE:rows.reduce((n,r)=>n+Math.abs(r.error),0)/rows.length,RMSE:Math.sqrt(rows.reduce((n,r)=>n+r.error*r.error,0)/rows.length)});
async function main(){
 const cache=new Map<string,Row[]>();for(let round=6;round<=16;round++)for(const family of families)cache.set(family+':'+round,predict(round,family));
 const decisions=[],outcomes=[];
 for(let round=9;round<=16;round++)for(const type of ['DRIVER','CONSTRUCTOR'] as const){
  const candidates=families.flatMap(family=>weights.map(weight=>{const past=Array.from({length:round-6},(_,i)=>cache.get(family+':'+(i+6))!).flat().filter(r=>r.type===type);return {family,weight,trainingRounds:Array.from({length:round-6},(_,i)=>i+6),MAE:metric(past.map(r=>({error:value(r,weight)-r.actual}))).MAE}})).sort((a,b)=>a.MAE-b.MAE||a.weight-b.weight||families.indexOf(a.family)-families.indexOf(b.family));
  const selected=candidates[0];if(selected.trainingRounds.some(r=>r>=round))throw Error('Target leakage');decisions.push({round,type,...selected});
  const current=cache.get('current:'+round)!.filter(r=>r.type===type),chosen=cache.get(selected.family+':'+round)!.filter(r=>r.type===type);
  current.forEach((row,i)=>{if(row.code!==chosen[i].code)throw Error('Mismatched roster');for(const [model,prediction] of [['current',value(row,.25)],['baseline-only',row.baseline],['past-selected',value(chosen[i],selected.weight)]] as const)outcomes.push({round,type,code:row.code,model,error:prediction-row.actual})});
 }
 const summary=['current','baseline-only','past-selected'].flatMap(model=>['DRIVER','CONSTRUCTOR'].map(type=>({model,type,...metric(outcomes.filter(r=>r.model===model&&r.type===type))})));
 const byRound=decisions.map(d=>({round:d.round,type:d.type,models:['current','baseline-only','past-selected'].map(model=>({model,...metric(outcomes.filter(r=>r.round===d.round&&r.type===d.type&&r.model===model))}))}));
 const intervals=['DRIVER','CONSTRUCTOR'].map(type=>{
  const blocks=byRound.filter(r=>r.type===type).map(r=>{const base=r.models.find(m=>m.model==='current')!,chosen=r.models.find(m=>m.model==='past-selected')!;return {n:base.n,sum:(chosen.MAE-base.MAE)*base.n}});
  let state=881;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((n,b)=>n+b.sum,0)/draw.reduce((n,b)=>n+b.n,0)}).sort((a,b)=>a-b);
  return {type,deltaMAE:blocks.reduce((n,b)=>n+b.sum,0)/blocks.reduce((n,b)=>n+b.n,0),low:samples[250],high:samples[9749],note:'Descriptive paired race bootstrap, does not account for adaptive research on reused data'};
 });
 const report={note:'Exploratory reused 2026 data, not fresh evidence. Algorithm chooses model family and blend weight independently by asset type from earlier out-of-sample round forecasts only; target scores enter evaluation after selection. Starts R9 after three validation rounds. Preset four families and five weights, common seed schedule, 3×1200 simulations. This is an expanding-window past-performance policy, not a guarantee of best future accuracy. No production activation.',families,weights,summary,decisions,byRound,intervals};console.table(summary);console.table(intervals);console.table(decisions.map(d=>({round:d.round,type:d.type,family:d.family,weight:d.weight,trainingMAE:d.MAE})));await writeFile('docs/past-selected-weekend-results.json',JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
