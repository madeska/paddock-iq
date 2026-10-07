import {applyPracticePositionModifier} from './openf1-weekend';
import {simulateComponentWeekend} from './component-simulation';
export const PRODUCTION_FORECAST_CONFIG=Object.freeze({ewmaAlpha:.25,ridgeLambda:50,driverRidgeWeight:.5,constructorEwmaWeight:.5,firstTrainingRound:6,componentWeight:.25,overtakeIntensity:1.2,simulations:3000});
const EWMA_ALPHA=PRODUCTION_FORECAST_CONFIG.ewmaAlpha,RIDGE_LAMBDA=PRODUCTION_FORECAST_CONFIG.ridgeLambda,DRIVER_RIDGE_WEIGHT=PRODUCTION_FORECAST_CONFIG.driverRidgeWeight,CONSTRUCTOR_EWMA_WEIGHT=PRODUCTION_FORECAST_CONFIG.constructorEwmaWeight;
export type ProductionForecastAsset={season:number;code:string;type:'DRIVER'|'CONSTRUCTOR';currentPrice:number|null;prices:{round:number;price:number}[];scores:{round:number;points:number}[]};
export type ProductionBaseline={code:string;type:'DRIVER'|'CONSTRUCTOR';current:number;chronological:number[];rawXPts:number;boostXPts:number|null;practicePosition:number|null};
export type ProductionPractice={isSprint:boolean;positions:ReadonlyMap<string,number>};
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
export const productionSampleStdDev=(xs:number[])=>{
 if(xs.length<2)return 0;
 const m=mean(xs);
 return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
};
const ewmaChronological=(scores:number[])=>{
 if(!scores.length)return null;
 let value=scores[0];
 for(const score of scores.slice(1))value=EWMA_ALPHA*score+(1-EWMA_ALPHA)*value;
 return value;
};
const constructorXPts=(scoresChronological:number[])=>{
 const e=ewmaChronological(scoresChronological);
 if(e==null)return null;
 const recent=scoresChronological.slice(-3);
 const mean3=mean(recent);
 return Math.max(-5,CONSTRUCTOR_EWMA_WEIGHT*e+(1-CONSTRUCTOR_EWMA_WEIGHT)*mean3);
};

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let pivot=i;
  for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[pivot][i]))pivot=j;
  [M[i],M[pivot]]=[M[pivot],M[i]];
  const d=M[i][i];
  if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){
   if(j===i)continue;
   const f=M[j][i];
   for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k];
  }
 }
 return M.map(r=>r[n]);
}

type TrainingRow={x:number[];y:number};
function fitRidge(rows:TrainingRow[],lambda=RIDGE_LAMBDA){
 if(!rows.length)return null;
 const d=rows[0].x.length;
 const means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){
  const vals=rows.map(r=>r.x[j]);
  means[j]=mean(vals);
  const s=productionSampleStdDev(vals);
  sds[j]=s>1e-8?s:1;
 }
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]);
 const p=d+1,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){
  b[a]+=X[i][a]*rows[i].y;
  for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c];
 }
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b);
 if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}

function features(historyChronological:number[],price:number){
 const e=ewmaChronological(historyChronological)??0;
 const season=mean(historyChronological);
 return [e,season,price];
}

/** Shared API/benchmark math. Callers supply active, source-validated assets and known quotes. */
export function forecastProductionBaselines(assets:readonly ProductionForecastAsset[],options:{season:number;round:number;practice?:ProductionPractice|null}){
 if(!Number.isInteger(options.season)||!Number.isInteger(options.round)||options.round<1)throw Error('Invalid forecast cutoff');
 const active=assets.filter(a=>a.season===options.season);
 const scoresFor=(a:ProductionForecastAsset)=>a.scores.filter(s=>s.round<options.round).sort((a,b)=>a.round-b.round);
 const driverTraining:TrainingRow[]=[];
 for(const asset of active.filter(a=>a.type==='DRIVER')){
  const scoreMap=new Map(scoresFor(asset).map(s=>[s.round,s.points])),priceMap=new Map(asset.prices.map(p=>[p.round,p.price]));
  for(let target=PRODUCTION_FORECAST_CONFIG.firstTrainingRound;target<options.round;target++){
   const history=[...scoreMap.entries()].filter(([r])=>r<target).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
   const y=scoreMap.get(target),price=priceMap.get(target);if(history.length<2||y==null||price==null)continue;driverTraining.push({x:features(history,price),y});
  }
 }
 const driverModel=fitRidge(driverTraining),baselines=new Map<string,ProductionBaseline>();
 for(const asset of active){
  const current=asset.currentPrice;if(current==null)continue;const chronological=scoresFor(asset).map(s=>s.points);if(!chronological.length)continue;
  let rawXPts:number|null=null,boostXPts:number|null=null,practicePosition:number|null=null;
  if(asset.type==='DRIVER'){
   const e=ewmaChronological(chronological),ridge=driverModel?.predict(features(chronological,current))??null;
   rawXPts=ridge!=null&&e!=null?DRIVER_RIDGE_WEIGHT*ridge+(1-DRIVER_RIDGE_WEIGHT)*e:null;boostXPts=ridge;
   if(rawXPts==null)rawXPts=e==null?null:.7*e+.3*mean(chronological);
   practicePosition=options.practice?.isSprint?null:(options.practice?.positions.get(asset.code)??null);
   if(rawXPts!=null&&practicePosition!=null)rawXPts=applyPracticePositionModifier(rawXPts,practicePosition);
   if(boostXPts!=null&&practicePosition!=null)boostXPts=applyPracticePositionModifier(boostXPts,practicePosition);
  }else rawXPts=constructorXPts(chronological);
  if(rawXPts==null)continue;baselines.set(asset.code,{code:asset.code,type:asset.type,current,chronological,rawXPts,boostXPts,practicePosition});
 }
 return {baselines,trainingRows:driverTraining.length};
}
export function simulateProductionForecast(baselines:ReadonlyMap<string,ProductionBaseline>,teams:Readonly<Record<string,string>>,options:{round:number;sprint:boolean;seed?:number;simulations?:number}){
 const rows=[...baselines.values()];
 const result=simulateComponentWeekend(rows.filter(r=>r.type==='DRIVER'&&Object.hasOwn(teams,r.code)&&teams[r.code]).map(r=>({code:r.code,team:teams[r.code],baselineXPts:r.rawXPts,recentScores:r.chronological.slice(-5)})),rows.filter(r=>r.type==='CONSTRUCTOR').map(r=>({code:r.code,baselineXPts:r.rawXPts})),{sprint:options.sprint,simulations:options.simulations??PRODUCTION_FORECAST_CONFIG.simulations,seed:options.seed??202600+options.round,overtakeIntensity:PRODUCTION_FORECAST_CONFIG.overtakeIntensity});
 const supported=supportedProductionConstructors(baselines,teams);return {...result,constructors:result.constructors.filter(c=>supported.has(c.code))};
}
export function supportedProductionConstructors(baselines:ReadonlyMap<string,ProductionBaseline>,teams:Readonly<Record<string,string>>){
 const counts=new Map<string,number>();for(const row of baselines.values())if(row.type==='DRIVER'&&Object.hasOwn(teams,row.code)&&teams[row.code])counts.set(teams[row.code],(counts.get(teams[row.code])??0)+1);
 return new Set([...baselines.values()].filter(r=>r.type==='CONSTRUCTOR'&&counts.get(r.code)===2).map(r=>r.code));
}
