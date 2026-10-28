import type {PrismaClient} from '@prisma/client';
import {CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL,BOOST_MODELS} from './current-prediction-models';
import {validateForecastBatch} from './forecast-batch-validation';
/** Independent read-back through the registered production models; no writes or source fetches. */
export async function readForecastHealth(db:Pick<PrismaClient,'asset'|'grandPrix'|'maintenanceState'>,season:number,round:number){
 const gp=await db.grandPrix.findUnique({where:{season_round:{season,round}}});
 if(!gp)return {ok:false,code:'ROUND_NOT_READY',round,total:0,drivers:0,constructors:0,missing:[] as string[],issues:['Race market missing'],forecastAt:null};
 const [assets,metadata]=await Promise.all([
  db.asset.findMany({where:{season,active:true},include:{prices:{where:{grandPrixId:gp.id},orderBy:{recordedAt:'desc'},take:1},predictions:{where:{grandPrixId:gp.id,modelVersion:{in:[CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL,...BOOST_MODELS]}}}}}),
  db.maintenanceState.findUnique({where:{id:'fantasy:2026'},select:{forecastRound:true,forecastAt:true}})
 ]);
 const expected=assets.map(asset=>({id:asset.id,type:asset.type,currentPrice:asset.prices[0]?Number(asset.prices[0].price):null}));
 const issues=validateForecastBatch(expected,gp.id,assets.flatMap(asset=>asset.predictions));
 if(metadata?.forecastRound!==round||!metadata.forecastAt)issues.push('Forecast metadata missing for this round');
 const missing=assets.filter(asset=>validateForecastBatch(expected.filter(row=>row.id===asset.id),gp.id,asset.predictions).length).map(asset=>asset.code).sort();
 return {ok:issues.length===0,code:issues.length?'FORECAST_INCOMPLETE':'FORECAST_READY',round,total:assets.length,drivers:assets.filter(asset=>asset.type==='DRIVER').length,constructors:assets.filter(asset=>asset.type==='CONSTRUCTOR').length,missing,issues:[...new Set(issues)],forecastAt:metadata?.forecastRound===round?metadata.forecastAt:null};
}
