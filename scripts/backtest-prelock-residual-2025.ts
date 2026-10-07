import {writeFile} from 'node:fs/promises';
import totals from '../src/data/fantasy-totals-2025.json';
import prices from '../src/data/fantasy-prices-2025.json';
import archive from '../src/data/prelock-practice-2025.json';
import {buildPrelockResidualFrames} from '../src/lib/prelock-residual-frames';
import {forecastPrelockResidual} from '../src/lib/prelock-residual-model';
import type {ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
import type {PrelockWeekend} from '../src/lib/prelock-session-archive';
const development=[6,7,8,9,10],diagnostic=[11,12,13,14],types=['DRIVER','CONSTRUCTOR'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,metric=(errors:number[])=>({n:errors.length,MAE:mean(errors.map(Math.abs)),RMSE:Math.sqrt(mean(errors.map(x=>x*x))),Bias:mean(errors)});
async function main(){
 const {frames,missing}=buildPrelockResidualFrames(totals.observations as ReplayScore[],prices.observations as ArchivedFantasyPrice[],archive.weekends as PrelockWeekend[],{season:2025,throughRound:14});
 const grid:any[]=[],selected:Record<string,{ridge:number;weight:number}>={};
 for(const type of types){
  for(const ridge of [10,50,200])for(const weight of [0,.25,.5,1]){
   const errors=development.flatMap(round=>{const target=frames.filter(r=>r.round===round&&r.type===type),predictions=forecastPrelockResidual(frames,target,{season:2025,round,ridge,weight});return target.map(r=>predictions.find(p=>p.code===r.code)!.prediction-r.actualPoints!)});
   grid.push({type,ridge,weight,...metric(errors)});
  }
  const best=grid.filter(r=>r.type===type).sort((a,b)=>a.MAE-b.MAE||a.weight-b.weight||b.ridge-a.ridge)[0];selected[type]={ridge:best.ridge,weight:best.weight};
 }
 const outcomes:any[]=[];
 for(const round of [...development,...diagnostic])for(const type of types){
  const target=frames.filter(r=>r.round===round&&r.type===type),predictions=forecastPrelockResidual(frames,target,{season:2025,round,...selected[type]});
  for(const row of target)for(const [model,prediction] of [['before-practice',row.features[0]],['shared-production-pre-lock',row.baseline],['selected-residual',predictions.find(p=>p.code===row.code)!.prediction]] as const)outcomes.push({round,type,code:row.code,model,error:prediction-row.actualPoints!});
 }
 const models=['before-practice','shared-production-pre-lock','selected-residual'],segments=[['development',development],['later-exploratory',diagnostic],['all-exploratory',[...development,...diagnostic]]] as const;
 const summary=segments.flatMap(([segment,rounds])=>models.flatMap(model=>types.map(type=>({segment,model,type,...metric(outcomes.filter(r=>rounds.includes(r.round)&&r.type===type&&r.model===model).map(r=>r.error))}))));
 const byRound=[...development,...diagnostic].flatMap(round=>models.flatMap(model=>types.map(type=>({round,model,type,...metric(outcomes.filter(r=>r.round===round&&r.type===type&&r.model===model).map(r=>r.error))}))));
 const intervals=[];
 for(const [segment,rounds] of segments)for(const type of types){
  const blocks=rounds.map(round=>{const baseline=byRound.find(r=>r.round===round&&r.type===type&&r.model==='shared-production-pre-lock')!,candidate=byRound.find(r=>r.round===round&&r.type===type&&r.model==='selected-residual')!;return {n:baseline.n,delta:(candidate.MAE-baseline.MAE)*baseline.n}});
  let state=2307;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const samples=Array.from({length:10000},()=>{const draw=blocks.map(()=>blocks[Math.floor(random()*blocks.length)]);return draw.reduce((a,b)=>a+b.delta,0)/draw.reduce((a,b)=>a+b.n,0)}).sort((a,b)=>a-b);
  intervals.push({segment,type,deltaMAE:blocks.reduce((a,b)=>a+b.delta,0)/blocks.reduce((a,b)=>a+b.n,0),low:samples[250],high:samples[9749]});
 }
 const report={note:'Exploratory only: R1–14 was previously consumed. Select ridge/weight on R6–10, use only earlier labels at every forecast, report R11–14 diagnostically. The incumbent uses its existing normal-GP practice modifier and skips sprint practice; candidate pace features use pre-lock SQ for sprint weekends. No reserved R15–21 features/errors imported. Session-end availability is reconstructed retrospectively, with no exact original publication timestamp proof. No production activation.',features:['pre-practice forecast','pre-event price','sprint indicator','pace signal known','normalized pre-lock pace rank','best-lap gap percent','pace rank surprise versus prior forecast ranking','lap-gap known'],development,diagnostic,selected,grid,missing:missing.filter(r=>r.round>=6),summary,pairedRaceBootstrap:intervals,byRound};
 console.log('Selected on R6–10',selected);console.table(summary);console.table(intervals);await writeFile('docs/prelock-residual-2025-results.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
