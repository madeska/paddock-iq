import {forecastProductionBaselines,simulateProductionForecast,PRODUCTION_FORECAST_CONFIG} from './production-forecast';
import type {ArchivedFantasyPrice} from './fantasy-price-archive';
export type ReplayScore={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';actualPoints:number};
/** Replay before practice. Target labels and later quotes never enter forecast inputs. */
export function replayProductionHistory(history:readonly ReplayScore[],prices:readonly ArchivedFantasyPrice[],options:{season:number;round:number;sprint:boolean}){
 const roster=prices.filter(p=>p.round===options.round),teams=Object.fromEntries(roster.filter(p=>p.type==='DRIVER').map(p=>[p.code,p.team]));
 const assets=roster.map(row=>({season:options.season,code:row.code,type:row.type,currentPrice:row.priceBefore,prices:prices.filter(p=>p.code===row.code&&p.type===row.type&&p.round<=options.round).map(p=>({round:p.round,price:p.priceBefore})),scores:history.filter(h=>h.season===options.season&&h.code===row.code&&h.type===row.type&&h.round<options.round).map(h=>({round:h.round,points:h.actualPoints}))}));
 const production=forecastProductionBaselines(assets,options),component=simulateProductionForecast(production.baselines,teams,options);
 const round1=(x:number)=>Math.round(x*10)/10;
 return roster.map(row=>{
  const baseline=production.baselines.get(row.code),value=(row.type==='DRIVER'?component.drivers:component.constructors).find(r=>r.code===row.code)?.total;
  if(!baseline)return {code:row.code,type:row.type,baseline:null,prediction:null};
  return {code:row.code,type:row.type,baseline:round1(baseline.rawXPts),prediction:round1(value==null?baseline.rawXPts:(1-PRODUCTION_FORECAST_CONFIG.componentWeight)*baseline.rawXPts+PRODUCTION_FORECAST_CONFIG.componentWeight*value)};
 });
}
