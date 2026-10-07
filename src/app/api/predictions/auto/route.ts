import {EXCLUDED_SCORE_SOURCE,reconcileOfficialHistory} from '../../../../lib/official-history-reconciliation';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictFantasyPrice } from '../../../../lib/fantasy-price-model';
import { getPracticeSnapshot } from '../../../../lib/openf1-weekend';
import { syncOfficialFantasyMarket } from '../../../../lib/fantasy-official-sync';
import {forecastProductionBaselines,simulateProductionForecast,productionSampleStdDev as sampleStdDev,PRODUCTION_FORECAST_CONFIG} from '../../../../lib/production-forecast';

const DRIVER_REACTIVATION_ROUND_2026:Record<string,number>={LAW:15,HAD:15};
const COMPONENT_WEIGHT=PRODUCTION_FORECAST_CONFIG.componentWeight;
const COMPONENT_OVERTAKE_INTENSITY=PRODUCTION_FORECAST_CONFIG.overtakeIntensity;
const SPRINT_ROUNDS_2026=new Set([2,4,5,9,12,17]);
export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const season=Number(body.season??2026),round=Number(body.round??17);
  const officialSync=await syncOfficialFantasyMarket(prisma,season,round);
  const historyReconciliation=await reconcileOfficialHistory(prisma,season,round);
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});

  const practiceSnapshot=await getPracticeSnapshot(season,gp.deadline);

  const assets=await prisma.asset.findMany({
   where:{season,active:true},
   include:{
    prices:{include:{grandPrix:true}},
    fantasyScores:{where:{source:{not:EXCLUDED_SCORE_SOURCE},grandPrix:{round:{lt:round}}},include:{grandPrix:true}}
   }
  });

  const production=forecastProductionBaselines(assets.map(asset=>{
   const currentPriceRow=asset.prices.filter(p=>p.grandPrix.round===round).sort((a,b)=>+new Date(b.recordedAt)-+new Date(a.recordedAt))[0];
   return {season:asset.season,code:asset.code,type:asset.type,currentPrice:currentPriceRow?Number(currentPriceRow.price):null,prices:asset.prices.map(p=>({round:p.grandPrix.round,price:Number(p.price)})),scores:asset.fantasyScores.map(s=>({round:s.grandPrix.round,points:s.points}))};
  }),{season,round,practice:practiceSnapshot});
  const baselineByCode=new Map<string,{
   asset:(typeof assets)[number];current:number;scoreRows:(typeof assets)[number]['fantasyScores'];chronological:number[];rawXPts:number;boostXPts:number|null;practicePosition:number|null;
  }>();
  for(const asset of assets){
   const baseline=production.baselines.get(asset.code);if(!baseline)continue;
   const scoreRows=asset.fantasyScores.slice().sort((a,b)=>a.grandPrix.round-b.grandPrix.round);
   baselineByCode.set(asset.code,{...baseline,asset,scoreRows});
  }

  const component=simulateProductionForecast(production.baselines,officialSync.driverTeams,{sprint:SPRINT_ROUNDS_2026.has(round),round});
  const componentDriverByCode=new Map(component.drivers.map(x=>[x.code,x]));
  const componentConstructorByCode=new Map(component.constructors.map(x=>[x.code,x]));

  const created:{code:string;type:string;expectedPoints:number;expectedDelta:number|null;modelVersion:string;id:string}[]=[];
  for(const asset of assets){
   const baseline=baselineByCode.get(asset.code);
   if(!baseline)continue;
   const {current,scoreRows,chronological,rawXPts,boostXPts,practicePosition}=baseline;
   const componentXPts=asset.type==='DRIVER'
    ?componentDriverByCode.get(asset.code)?.total
    :componentConstructorByCode.get(asset.code)?.total;
   const blendedXPts=componentXPts==null
    ?rawXPts
    :(1-COMPONENT_WEIGHT)*rawXPts+COMPONENT_WEIGHT*componentXPts;
   const pts=Math.round(blendedXPts*10)/10;

   const newest=[...chronological].reverse();
   const trailingConsecutive:number[]=[];
   const activationRound=season===2026&&asset.type==='DRIVER'
    ?(DRIVER_REACTIVATION_ROUND_2026[asset.code]??1)
    :1;
   for(let r=round-1;r>=Math.max(activationRound,round-2);r--){
    const row=scoreRows.find(s=>s.grandPrix.round===r);
    if(!row)break;
    trailingConsecutive.unshift(row.points);
   }
   const sd=sampleStdDev(newest.slice(0,5));
   const price=predictFantasyPrice({
    currentPrice:current,
    previousFantasyPoints:trailingConsecutive,
    expectedPoints:pts,
    pointsStdDev:sd
   });

   const rise=price?price.probabilities.smallRise+price.probabilities.maxRise:null;
   const fall=price?
    (price.effectiveDeltas.smallFall<0?price.probabilities.smallFall:0)+
    (price.effectiveDeltas.maxFall<0?price.probabilities.maxFall:0):null;

   await prisma.assetPrediction.deleteMany({where:{assetId:asset.id,grandPrixId:gp.id}});
   const modelVersion=asset.type==='DRIVER'
    ?(practicePosition!=null
      ?'xpts-driver-baseline75-component25-practice-v2 + price-probability-v0.4-bounded'
      :'xpts-driver-baseline75-component25-v2 + price-probability-v0.4-bounded')
    :'xpts-constructor-baseline75-component25-v4 + price-probability-v0.4-bounded';

   const row=await prisma.assetPrediction.create({data:{
    assetId:asset.id,grandPrixId:gp.id,expectedPoints:pts,
    expectedPriceDelta:price?.expectedDelta??null,
    probabilityRise:rise,probabilityFlat:price?.probabilityFlat??null,probabilityFall:fall,
    probabilityMaxRise:price?.probabilities.maxRise??null,
    probabilitySmallRise:price?.probabilities.smallRise??null,
    probabilitySmallFall:price?.probabilities.smallFall??null,
    probabilityMaxFall:price?.probabilities.maxFall??null,
    requiredPointsMaxRise:price?.thresholds.maxRiseAt??null,
    requiredPointsSmallRise:price?.thresholds.smallRiseAt??null,
    requiredPointsAvoidMaxFall:price?.thresholds.maxFallBelow??null,
    confidence:Math.min(.85,.4+Math.min(5,chronological.length)*.08),
    source:asset.type==='DRIVER'
     ?(practicePosition!=null
       ?'75% calibrated baseline + 25% component simulation (quali/sprint/race/positions/overtakes/FL/DOTD/DNF) + validated normal-GP Practice modifier from '+practiceSnapshot?.sessionName+' + bounded rolling-3 PPM price model'
       :'75% calibrated baseline + 25% component simulation (quali/sprint/race/positions/overtakes/FL/DOTD/DNF) + bounded rolling-3 PPM price model')
     :componentXPts==null
      ?'Constructor baseline; official driver lineup incomplete + bounded rolling-3 PPM price model'
      :'75% constructor baseline + 25% component simulation (official driver lineup/quali teamwork/pit stops) + bounded rolling-3 PPM price model',
    modelVersion
   }});

   created.push({code:asset.code,type:asset.type,expectedPoints:pts,expectedDelta:price?.expectedDelta??null,modelVersion,id:row.id});

   if(asset.type==='DRIVER'&&boostXPts!=null){
    const boostPts=Math.round(boostXPts*10)/10;
    await prisma.assetPrediction.create({data:{
     assetId:asset.id,
     grandPrixId:gp.id,
     expectedPoints:boostPts,
     confidence:Math.min(.85,.4+Math.min(5,chronological.length)*.08),
     source:practicePosition!=null
      ?'Pure ridge(lambda=50) x2 selector + validated normal-GP Practice position modifier from '+practiceSnapshot?.sessionName
      :'Pure walk-forward ridge(lambda=50) x2 selector',
     modelVersion:practicePosition!=null
      ?'xpts-driver-ridge50-boost-practice-v1'
      :'xpts-driver-ridge50-boost-v1'
    }});
   }
  }

  const missing=assets.filter(a=>!created.some(p=>p.code===a.code)).map(a=>a.code);
  return NextResponse.json({
   ok:missing.length===0,created:created.length,totalAssets:assets.length,missing,
   driverModel:'50% ridge(lambda=50: ewma025, seasonMean, currentPrice) + 50% EWMA(0.25); normal-GP Practice modifier 0.5*(11.5-position) when available',
   practiceSnapshot:practiceSnapshot?{
    sessionName:practiceSnapshot.sessionName,
    isSprint:practiceSnapshot.isSprint,
    drivers:practiceSnapshot.positions.size
   }:null,
   constructorModel:'max(-5, 50% EWMA(0.25) + 50% recent-3 mean)',
   driverTrainingRows:production.trainingRows,
   componentSimulation:{weight:COMPONENT_WEIGHT,overtakeIntensity:COMPONENT_OVERTAKE_INTENSITY,simulations:component.simulations,sprint:SPRINT_ROUNDS_2026.has(round)},
   officialSync,historyReconciliation,
   predictions:created
  });
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Auto prediction failed'},{status:500});
 }
}
