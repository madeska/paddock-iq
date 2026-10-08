import {forecastProductionBaselines,simulateProductionForecast,productionSampleStdDev,PRODUCTION_FORECAST_CONFIG,type ProductionPractice} from '../src/lib/production-forecast';
import type {ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
export const TREE_FEATURE_NAMES=['baseline','price','component','recentMean','seasonMean','scoreStdDev','historyCount','sprint','practicePosition','componentSupported'] as const;
export type TreeForecastFrame={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';incumbent:number;x:number[]};
/** Frozen pre-weekend-v3 reference shared math. Sprint signals remain excluded for reproducible historical/prospective tree protocols. No outcome label is returned. */
export function buildTreeForecastFrames(history:readonly ReplayScore[],quotes:readonly ArchivedFantasyPrice[],options:{season:number;round:number;sprint:boolean;practice?:ProductionPractice|null}):TreeForecastFrame[]{
 if(!Number.isInteger(options.season)||!Number.isInteger(options.round)||options.round<2)throw Error('Invalid frame scope');
 const scores=history.filter(r=>r.season===options.season&&r.round<options.round);
 const prices=quotes.filter(r=>r.round<=options.round);
 const seenScores=new Set<string>(),seenQuotes=new Set<string>();
 for(const r of scores){
  const key=`${r.round}:${r.type}:${r.code}`;
  if(seenScores.has(key))throw Error('Duplicate score identity');seenScores.add(key);
  if(!Number.isInteger(r.round)||r.round<1||!['DRIVER','CONSTRUCTOR'].includes(r.type)||!r.code||!Number.isFinite(r.actualPoints))throw Error('Invalid score');
 }
 for(const r of prices){
  const key=`${r.round}:${r.type}:${r.code}`;
  if(seenQuotes.has(key))throw Error('Duplicate quote identity');seenQuotes.add(key);
  if(!Number.isInteger(r.round)||r.round<1||!['DRIVER','CONSTRUCTOR'].includes(r.type)||!r.code||!r.team||!Number.isFinite(r.priceBefore)||r.priceBefore<=0)throw Error('Invalid quote');
 }
 const roster=prices.filter(r=>r.round===options.round);if(!roster.length)throw Error('Missing target quote roster');
 if(new Set(roster.map(r=>r.code)).size!==roster.length)throw Error('Ambiguous cross-type roster identity');
 const teams=Object.fromEntries(roster.filter(r=>r.type==='DRIVER').map(r=>[r.code,r.team]));
 const assets=roster.map(r=>({season:options.season,code:r.code,type:r.type,currentPrice:r.priceBefore,prices:prices.filter(p=>p.code===r.code&&p.type===r.type).map(p=>({round:p.round,price:p.priceBefore})),scores:scores.filter(s=>s.code===r.code&&s.type===r.type).map(s=>({round:s.round,points:s.actualPoints}))}));
 // The frozen tree protocol predates live sprint FP1/SQ/news integration. Preserve its reference;
 // future weekend-v3 experiments need a distinct versioned frame artifact, not rewritten fixtures.
 const referenceOptions={...options,practice:options.practice?.isSprint?null:options.practice};
 const result=forecastProductionBaselines(assets,referenceOptions),simulation=simulateProductionForecast(result.baselines,teams,referenceOptions),frames:TreeForecastFrame[]=[];
 const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
 for(const baseline of result.baselines.values()){
  const component=(baseline.type==='DRIVER'?simulation.drivers:simulation.constructors).find(r=>r.code===baseline.code);
  const total=component?.total??baseline.rawXPts;
  const incumbent=Math.round((component===undefined?baseline.rawXPts:(1-PRODUCTION_FORECAST_CONFIG.componentWeight)*baseline.rawXPts+PRODUCTION_FORECAST_CONFIG.componentWeight*total)*10)/10;
  const x=[baseline.rawXPts,baseline.current,total,mean(baseline.chronological.slice(-3)),mean(baseline.chronological),productionSampleStdDev(baseline.chronological),baseline.chronological.length,Number(options.sprint),baseline.practicePosition??0,Number(component!==undefined)];
  if(!Number.isFinite(incumbent)||!x.every(Number.isFinite))throw Error('Nonfinite forecast frame');
  frames.push({season:options.season,round:options.round,code:baseline.code,type:baseline.type,incumbent,x});
 }
 return frames;
}
