import {forecastProductionBaselines,simulateProductionForecast,PRODUCTION_FORECAST_CONFIG,type ProductionForecastAsset,type ProductionPractice} from './production-forecast';
import {fitSessionPace} from './session-pace';
import {fitClassifiedProgress} from './race-progress-model';
import type {ComponentObservation} from './component-calibration';
import type {ComponentSimulationOptions} from './component-simulation';
export function buildCandidateCapture(input:{season:number;round:number;asOf:Date;deadline:Date;sprint:boolean;assets:readonly ProductionForecastAsset[];teams:Record<string,string>;history:readonly ComponentObservation[];practice?:ProductionPractice|null;gridDrops?:ComponentSimulationOptions['gridDrops']}){
 if(input.sprint||!Number.isFinite(+input.asOf)||!Number.isFinite(+input.deadline)||+input.asOf>=+input.deadline||!Number.isInteger(input.round)||input.round<1)throw Error('Capture requires a normal weekend before lock');
 const assets=input.assets.filter(a=>a.season===input.season).map(a=>({...a,scores:a.scores.filter(s=>s.round<input.round),prices:a.prices.filter(p=>p.round<=input.round)}));
 const history=input.history.filter(r=>r.season===input.season&&r.round<input.round);
 const options={season:input.season,round:input.round,sprint:false,practice:input.practice,gridDrops:input.gridDrops};
 const {baselines}=forecastProductionBaselines(assets,options);
 const drivers=[...baselines.values()].filter(r=>r.type==='DRIVER'&&input.teams[r.code]).map(r=>r.code);
 const pace=fitSessionPace(history,{season:input.season,round:input.round,drivers,practice:input.practice?.positions});
 const progress=fitClassifiedProgress(history,{season:input.season,round:input.round,priorStrength:5});
 const incumbent=simulateProductionForecast(baselines,input.teams,options),candidate=simulateProductionForecast(baselines,input.teams,{...options,componentOverrides:{qualifyingPace:pace.qualifying,raceProgress:progress.progress}});
 const points=(code:string,type:'DRIVER'|'CONSTRUCTOR',simulation:typeof incumbent)=>{const baseline=baselines.get(code)!;const c=(type==='DRIVER'?simulation.drivers:simulation.constructors).find(r=>r.code===code);return Math.round((c?(1-PRODUCTION_FORECAST_CONFIG.componentWeight)*baseline.rawXPts+PRODUCTION_FORECAST_CONFIG.componentWeight*c.total:baseline.rawXPts)*10)/10};
 const rows=[...baselines.values()].map(r=>{const original=points(r.code,r.type,incumbent);return {code:r.code,type:r.type,incumbent:original,candidate:r.type==='CONSTRUCTOR'?original:points(r.code,r.type,candidate)}});
 return {schemaVersion:1,protocol:'normal-driver-classified-progress-v1',season:input.season,round:input.round,capturedAt:input.asOf.toISOString(),deadline:input.deadline.toISOString(),config:PRODUCTION_FORECAST_CONFIG,inputs:{assets,teams:input.teams,history,practice:input.practice?{isSprint:false,positions:Object.fromEntries(input.practice.positions)}:null,gridDrops:input.gridDrops??null},pace,progress,rows};
}
