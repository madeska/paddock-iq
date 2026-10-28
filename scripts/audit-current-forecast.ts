import {loadEnvConfig} from '@next/env';
import {writeFileSync} from 'node:fs';

/** Read-only unless --repair is explicitly supplied. Never prints connection/auth secrets. */
async function main(){
 loadEnvConfig(process.env.PADDOCK_ENV_DIR??process.cwd(),true,{info(){},error(){}});
 const {prisma}=await import('../src/lib/prisma');
 try{
  const state=await prisma.forecastSeasonState.findUniqueOrThrow({where:{season:2026}});
  if(process.argv.includes('--repair')){
   const {withMaintenanceLease}=await import('../src/lib/maintenance-updates');
   const {generateForecast}=await import('../src/lib/generate-forecast');
   const run=await withMaintenanceLease(prisma,async token=>{
    const response=await generateForecast({season:2026,round:state.round},token),data=await response.json();
    if(!response.ok||!data.ok)throw Error(JSON.stringify({status:response.status,error:data.error,missing:data.missing}));
    return {value:{created:data.created,total:data.totalAssets,round:data.round,deadline:data.weekendLock?.deadline}};
   });
   console.log(JSON.stringify({repair:run}));
   if(run.busy)throw Error('Another update holds the lease; no repair performed');
  }
  const {CURRENT_DRIVER_MODEL,CURRENT_CONSTRUCTOR_MODEL,BOOST_MODELS}=await import('../src/lib/current-prediction-models');
  const assets=await prisma.asset.findMany({where:{season:2026,active:true},include:{prices:{where:{grandPrix:{season:2026,round:state.round}},orderBy:{recordedAt:'desc'},take:1},predictions:{where:{grandPrix:{season:2026,round:state.round}}}},orderBy:[{type:'asc'},{code:'asc'}]});
  const maintenance=await prisma.maintenanceState.findUnique({where:{id:'fantasy:2026'},select:{forecastRound:true,forecastAt:true,status:true}});
  const rows=assets.map(asset=>{
   const main=asset.predictions.filter(p=>p.modelVersion===(asset.type==='DRIVER'?CURRENT_DRIVER_MODEL:CURRENT_CONSTRUCTOR_MODEL));
   const boosts=asset.predictions.filter(p=>BOOST_MODELS.includes(p.modelVersion));
   const row=main[0],price=asset.prices[0]?Number(asset.prices[0].price):null,issues:string[]=[];
   if(main.length!==1)issues.push('main forecast count '+main.length);
   if(!row||!Number.isFinite(row.expectedPoints))issues.push('missing/nonfinite xPts');
   if(!row||!Number.isFinite(row.expectedPriceDelta))issues.push('missing/nonfinite price change');
   if(price===null||!Number.isFinite(price))issues.push('missing current price');
   if(row&&price!==null&&row.expectedPriceDelta!==null&&(price+row.expectedPriceDelta<2.999||price+row.expectedPriceDelta>34.001))issues.push('price outside bounds');
   const probabilities=[row?.probabilityMaxFall,row?.probabilitySmallFall,row?.probabilitySmallRise,row?.probabilityMaxRise];
   if(probabilities.some(p=>typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)||Math.abs(probabilities.reduce<number>((sum,p)=>sum+(p??0),0)-1)>.0021)issues.push('invalid price probabilities');
   if(asset.type==='DRIVER'&&(boosts.length!==1||!Number.isFinite(boosts[0]?.expectedPoints)))issues.push('missing/duplicate/nonfinite x2 forecast');
   if(asset.type==='CONSTRUCTOR'&&boosts.length!==0)issues.push('unexpected constructor x2 forecast');
   return {code:asset.code,type:asset.type,price,expectedPoints:row?.expectedPoints??null,expectedDelta:row?.expectedPriceDelta??null,boostExpectedPoints:asset.type==='DRIVER'?boosts[0]?.expectedPoints??null:null,mainCount:main.length,boostCount:boosts.length,createdAt:row?.createdAt??null,issues};
  });
  const report={season:2026,round:state.round,checkedAt:new Date().toISOString(),drivers:rows.filter(r=>r.type==='DRIVER').length,constructors:rows.filter(r=>r.type==='CONSTRUCTOR').length,maintenance,complete:rows.length>0&&rows.every(row=>!row.issues.length)&&maintenance?.forecastRound===state.round,rows};
  const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
  if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({round:report.round,drivers:report.drivers,constructors:report.constructors,complete:report.complete,maintenance,invalid:rows.filter(row=>row.issues.length)},null,2));
  if(!report.complete)process.exitCode=1;
 }finally{await prisma.$disconnect()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Forecast audit failed');process.exitCode=1});
