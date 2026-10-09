import {fitRaceProgress,fitClassifiedProgress} from '../src/lib/race-progress-model';
import {fitOvertakeModel,type OvertakeRecencyOptions} from '../src/lib/overtake-model';
import {writeFile} from 'node:fs/promises';
import data from '../src/data/component-history-2026.json';
import {calibrateComponents,type ComponentObservation} from '../src/lib/component-calibration';
import {simulateComponentWeekend} from '../src/lib/component-simulation';
type HistoryRow=ComponentObservation&{actualPoints:number;priceBefore:number};
const history=data.observations as HistoryRow[];
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const std=(xs:number[])=>{const m=mean(xs);return xs.length>1?Math.sqrt(mean(xs.map(x=>(x-m)**2))):0};
const ewma=(xs:number[])=>xs.reduce((v,x,i)=>i?.25*x+.75*v:x,0);
const features=(xs:number[],price:number)=>[ewma(xs),mean(xs),price];
const metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
function ridgeFit(rows:{x:number[];y:number}[],lambda=50){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);sds[j]=std(vals)||1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<p;i++){
  let pivot=i;for(let j=i+1;j<p;j++)if(Math.abs(M[j][i])>Math.abs(M[pivot][i]))pivot=j;
  [M[i],M[pivot]]=[M[pivot],M[i]];const div=M[i][i];if(Math.abs(div)<1e-9)return null;
  for(let k=i;k<=p;k++)M[i][k]/=div;
  for(let j=0;j<p;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=p;k++)M[j][k]-=f*M[i][k]}
 }
 const beta=M.map(r=>r[p]);
 return (x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0);
}


export function forecast(round:number,priorStrength?:number,halfLife?:number,seeds=1,calibrationMode?:'all'|'reliability-dotd-pits',conditionalOvertakes=false,qualifyingNoise?:number,rankingCorrelation?:number,raceNoise?:number,gridRelativeProgress=false,overtakeOptions?:OvertakeRecencyOptions,classifiedProgress=false){
 const train:{x:number[];y:number}[]=[];
 for(const actual of history.filter(o=>o.type==='DRIVER'&&o.round<round&&o.round>=3)){const prior=history.filter(o=>o.type==='DRIVER'&&o.code===actual.code&&o.round<actual.round).sort((a,b)=>a.round-b.round).map(o=>o.actualPoints);if(prior.length>=2)train.push({x:features(prior,actual.priceBefore),y:actual.actualPoints})}
 const ridge=ridgeFit(train,50);const target=history.filter(o=>o.round===round);
 const baseline=new Map<string,number>();const drivers:any[]=[],constructors:any[]=[];
 for(const row of target){const scores=history.filter(o=>o.type===row.type&&o.code===row.code&&o.round<round).sort((a,b)=>a.round-b.round).map(o=>o.actualPoints);const e=ewma(scores);const b=row.type==='DRIVER'?.5*(ridge?.(features(scores,row.priceBefore))??e)+.5*e:.5*e+.5*mean(scores.slice(-3));baseline.set(row.type+':'+row.code,b);if(row.type==='DRIVER')drivers.push({code:row.code,team:row.team,baselineXPts:b,recentScores:scores.slice(-5)});else constructors.push({code:row.code,baselineXPts:b})}
 const calibration=priorStrength===undefined?undefined:calibrateComponents(history,{season:2026,round,priorStrength,halfLife});const results:any[]=[];const raceProgress=gridRelativeProgress?(classifiedProgress?fitClassifiedProgress:fitRaceProgress)(history,{season:2026,round}).progress:undefined;const overtakeModel=conditionalOvertakes||qualifyingNoise!==undefined||raceNoise!==undefined?fitOvertakeModel(history,{...overtakeOptions,season:2026,round}):undefined;
 for(let seed=0;seed<seeds;seed++)results.push(simulateComponentWeekend(drivers,constructors,{sprint:target.some(o=>o.sprint),simulations:1200,seed:202600+round+seed*1000,overtakeIntensity:1.8,calibration,calibrationMode,rankingCorrelation,raceProgress,racePace:raceNoise===undefined||gridRelativeProgress?undefined:overtakeModel!.racePace,raceNoise,qualifyingPace:qualifyingNoise===undefined?undefined:overtakeModel!.pace,qualifyingNoise,overtakeModel:conditionalOvertakes?overtakeModel:undefined}));
 return target.map(actual=>{const sims=results.map(s=>actual.type==='DRIVER'?s.drivers.find((d:any)=>d.code===actual.code):s.constructors.find((c:any)=>c.code===actual.code));const c:any={};for(const key of Object.keys(sims[0]))if(typeof sims[0][key]==='number')c[key]=mean(sims.map(s=>s[key]));const base=baseline.get(actual.type+':'+actual.code)!;return {round,code:actual.code,type:actual.type,actual:actual.actualPoints,prediction:.75*base+.25*c.total,baseline:base,components:c,observed:actual}});
}
export function score(rows:ReturnType<typeof forecast>){const d=metric(rows.filter(r=>r.type==='DRIVER').map(r=>r.prediction-r.actual)),c=metric(rows.filter(r=>r.type==='CONSTRUCTOR').map(r=>r.prediction-r.actual));return {DRIVER:d,CONSTRUCTOR:c,objective:d.MAE+.5*c.MAE}}
async function main(){
 const development=[6,7,8,9,10,11],holdout=[12,13,14,15,16];const candidates:any[]=[];
 for(const strength of [4,8,16])for(const halfLife of [4,8,16]){const rows=development.flatMap(round=>forecast(round,strength,halfLife));candidates.push({strength,halfLife,...score(rows)})}
 candidates.sort((a,b)=>a.objective-b.objective);const selected=candidates[0];console.log('DEVELOPMENT ONLY PARAMETER SELECTION');console.table(candidates.map(c=>({prior:c.strength,halfLife:c.halfLife,driverMAE:c.DRIVER.MAE,constructorMAE:c.CONSTRUCTOR.MAE,objective:c.objective})));
 const report:any={dataset:{rounds:data.lastCompletedRound,drivers:history.filter(o=>o.type==='DRIVER').length,constructors:history.filter(o=>o.type==='CONSTRUCTOR').length},developmentRounds:development,holdoutRounds:holdout,selected:{priorStrength:selected.strength,halfLife:selected.halfLife},metrics:[],componentMetrics:[],byRound:[]};
 for(const [segment,rounds] of [['development',development],['holdout',holdout]] as const){const legacy=rounds.flatMap(round=>forecast(round,undefined,undefined,3)),calibrated=rounds.flatMap(round=>forecast(round,selected.strength,selected.halfLife,3));for(const [model,rows] of [['uncalibrated',legacy],['calibrated',calibrated],['hybrid',rounds.flatMap(round=>forecast(round,selected.strength,selected.halfLife,3,'reliability-dotd-pits'))]] as const){const scored=score(rows);for(const type of ['DRIVER','CONSTRUCTOR'] as const)report.metrics.push({segment,model,type,...scored[type]});const dr=rows.filter(r=>r.type==='DRIVER');report.componentMetrics.push({segment,model,dnfBrier:mean(dr.map(r=>(-r.components.dnfPenalty/20-Number(r.observed.race!.failed))**2)),overtakesMAE:mean(dr.map(r=>Math.abs(r.components.overtakes-r.observed.race!.overtakes))),fastestLapBrier:mean(dr.map(r=>(r.components.fastestLap/10-Number(r.observed.race!.fastestLap))**2)),dotdBrier:mean(dr.map(r=>(r.components.driverOfTheDay/10-Number(r.observed.race!.dotd))**2)),pitMAE:mean(rows.filter(r=>r.type==='CONSTRUCTOR').map(r=>Math.abs(r.components.pitStops-r.observed.pitPoints!)))});for(const round of rounds)report.byRound.push({segment,model,round,...score(rows.filter(r=>r.round===round))})}}
 console.log('75% BASELINE + 25% COMPONENT FORECAST');console.table(report.metrics);console.log('COMPONENT METRICS (lower is better)');console.table(report.componentMetrics);await writeFile('docs/component-calibration-results.json',JSON.stringify(report,null,2));
}
if(process.argv[1]?.endsWith('backtest-component-calibration.ts'))main().catch(e=>{console.error(e);process.exitCode=1});
