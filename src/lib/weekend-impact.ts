import {PRODUCTION_FORECAST_CONFIG,type ProductionBaseline,type simulateProductionForecast} from './production-forecast';
type Simulation=ReturnType<typeof simulateProductionForecast>;
export type WeekendImpact={code:string;type:'DRIVER'|'CONSTRUCTOR';before:number;after:number;change:number};
const rounded=(value:number)=>Math.round(value*10)/10;
/** Same history, price, seed and penalties; only practice/SQ differ between runs. */
export function compareWeekendImpact(before:ReadonlyMap<string,ProductionBaseline>,beforeSimulation:Simulation,after:ReadonlyMap<string,ProductionBaseline>,afterSimulation:Simulation):WeekendImpact[]{
 const points=(baseline:ProductionBaseline,simulation:Simulation)=>{
  const component=(baseline.type==='DRIVER'?simulation.drivers:simulation.constructors).find(r=>r.code===baseline.code);
  return rounded(component==null?baseline.rawXPts:(1-PRODUCTION_FORECAST_CONFIG.componentWeight)*baseline.rawXPts+PRODUCTION_FORECAST_CONFIG.componentWeight*component.total);
 };
 return [...after.values()].flatMap(baseline=>{
  const previous=before.get(baseline.code);if(!previous||previous.type!==baseline.type)return [];
  const from=points(previous,beforeSimulation),to=points(baseline,afterSimulation);
  return [{code:baseline.code,type:baseline.type,before:from,after:to,change:rounded(to-from)}];
 });
}
