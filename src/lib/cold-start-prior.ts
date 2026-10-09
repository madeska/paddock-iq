import {forecastProductionBaselines,type ProductionForecastAsset,type ProductionPractice} from './production-forecast';
/** Research-only fixed prior: existing forecast rows remain unchanged; no invented own score history. */
export function forecastWithColdStartPriors(assets:readonly ProductionForecastAsset[],teams:Readonly<Record<string,string>>,options:{season:number;round:number;practice?:ProductionPractice|null}){
 const result=forecastProductionBaselines(assets,options),baselines=new Map(result.baselines),coldStarts:string[]=[];
 const active=assets.filter(a=>a.season===options.season&&a.type==='DRIVER');
 const past=(a:ProductionForecastAsset)=>a.scores.filter(s=>s.round<options.round).sort((a,b)=>a.round-b.round).map(s=>s.points);
 const pooled=active.flatMap(past);if(!pooled.length)return {...result,baselines,coldStarts};
 if(pooled.some(p=>!Number.isFinite(p)))throw Error('Invalid prior score');
 const mean=(xs:number[])=>xs.reduce((n,x)=>n+x,0)/xs.length,global=mean(pooled);
 for(const asset of active){if(baselines.has(asset.code)||past(asset).length||asset.currentPrice==null||!Object.hasOwn(teams,asset.code)||!teams[asset.code])continue;
 if(!Number.isFinite(asset.currentPrice)||asset.currentPrice<=0)throw Error('Invalid cold-start quote');
 const peers=active.filter(a=>a.code!==asset.code&&teams[a.code]===teams[asset.code]).map(past).filter(s=>s.length).map(s=>s.reduce((n,p,i)=>i?.25*p+.75*n:p,0));
 const rawXPts=peers.length?.5*mean(peers)+.5*global:global;
 if(!Number.isFinite(rawXPts))throw Error('Nonfinite cold-start prior');
 baselines.set(asset.code,{code:asset.code,type:'DRIVER',current:asset.currentPrice,chronological:[],rawXPts,boostXPts:null,practicePosition:null});coldStarts.push(asset.code);
 }
 return {...result,baselines,coldStarts:coldStarts.sort()};
}
