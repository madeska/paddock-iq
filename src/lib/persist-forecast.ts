import type {Prisma,PrismaClient} from '@prisma/client';
import {savedForecastContext} from './maintenance-updates';
import {validateForecastBatch,type ForecastAsset} from './forecast-batch-validation';

export async function persistForecast(db:Pick<PrismaClient,'$transaction'>,input:{leaseToken:string;deadline:Date;grandPrixId:string;assets:ForecastAsset[];predictions:Prisma.AssetPredictionCreateManyInput[];result:any}){
 if(validateForecastBatch(input.assets,input.grandPrixId,input.predictions).length)throw Error('Forecast batch validation failed');
 return db.$transaction(async tx=>{
  const owned=await tx.maintenanceState.updateMany({where:{id:'fantasy:2026',token:input.leaseToken,leaseUntil:{gt:new Date()}},data:{status:'RUNNING'}});
  if(!owned.count)throw Error('Forecast update lease lost');
  if(+input.deadline<=Date.now())throw Error('Team lock passed during calculation');
  await tx.assetPrediction.deleteMany({where:{grandPrixId:input.grandPrixId,assetId:{in:input.assets.map(asset=>asset.id)}}});
  const saved=await tx.assetPrediction.createMany({data:input.predictions});
  if(saved.count!==input.predictions.length)throw Error('Incomplete forecast persistence');
  await tx.maintenanceState.updateMany({where:{id:'fantasy:2026',token:input.leaseToken},data:{forecastRound:input.result.round,forecastAt:new Date(input.result.forecastAt),forecastContext:savedForecastContext(input.result) as Prisma.InputJsonValue}});
 });
}
