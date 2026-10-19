import type {Prisma,PrismaClient} from '@prisma/client';
import {savedForecastContext} from './maintenance-updates';

export async function persistForecast(db:Pick<PrismaClient,'$transaction'>,input:{leaseToken:string;deadline:Date;grandPrixId:string;assetIds:string[];predictions:Prisma.AssetPredictionCreateManyInput[];result:any}){
 return db.$transaction(async tx=>{
  const owned=await tx.maintenanceState.updateMany({where:{id:'fantasy:2026',token:input.leaseToken,leaseUntil:{gt:new Date()}},data:{status:'RUNNING'}});
  if(!owned.count)throw Error('Forecast update lease lost');
  if(+input.deadline<=Date.now())throw Error('Team lock passed during calculation');
  await tx.assetPrediction.deleteMany({where:{grandPrixId:input.grandPrixId,assetId:{in:input.assetIds}}});
  await tx.assetPrediction.createMany({data:input.predictions});
  await tx.maintenanceState.updateMany({where:{id:'fantasy:2026',token:input.leaseToken},data:{forecastRound:input.result.round,forecastAt:new Date(input.result.forecastAt),forecastContext:savedForecastContext(input.result) as Prisma.InputJsonValue}});
 });
}
