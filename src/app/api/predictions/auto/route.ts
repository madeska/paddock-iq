import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictFantasyPrice } from '../../../../lib/fantasy-price-model';

const EWMA_ALPHA=.25;

const ewma=(scoresNewestFirst:number[])=>{
 const chronological=[...scoresNewestFirst].reverse();
 if(!chronological.length)return null;
 let value=chronological[0];
 for(const score of chronological.slice(1))value=EWMA_ALPHA*score+(1-EWMA_ALPHA)*value;
 return value;
};

const seasonMean=(scoresNewestFirst:number[])=>scoresNewestFirst.length?scoresNewestFirst.reduce((a,b)=>a+b,0)/scoresNewestFirst.length:null;

const hybridXPts=(type:string,scoresNewestFirst:number[])=>{
 const e=ewma(scoresNewestFirst);
 if(e==null)return null;
 if(type==='DRIVER'){
  const s=seasonMean(scoresNewestFirst);
  return s==null?e:.7*e+.3*s;
 }
 return Math.max(-5,e);
};

const sampleStdDev=(scores:number[])=>{
 if(scores.length<2)return undefined;
 const mean=scores.reduce((a,b)=>a+b,0)/scores.length;
 const variance=scores.reduce((sum,x)=>sum+(x-mean)**2,0)/(scores.length-1);
 return Math.sqrt(variance);
};

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const season=Number(body.season??2026),round=Number(body.round??16);
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});

  const assets=await prisma.asset.findMany({
   where:{season,active:true},
   include:{
    prices:{orderBy:{recordedAt:'desc'},take:1},
    fantasyScores:{
     where:{grandPrix:{round:{lt:round}}},
     orderBy:{grandPrix:{round:'desc'}},
     include:{grandPrix:true}
    }
   }
  });

  const created=[];
  for(const asset of assets){
   const current=asset.prices[0]?Number(asset.prices[0].price):null;
   if(current==null)continue;

   const scores=asset.fantasyScores.map(s=>s.points);
   const rawXPts=hybridXPts(asset.type,scores);
   if(rawXPts==null)continue;
   const pts=Math.round(rawXPts*10)/10;

   const previousTwo=scores.slice(0,2);
   const sd=sampleStdDev(scores.slice(0,5));
   const price=previousTwo.length===2?predictFantasyPrice({
    currentPrice:current,
    previousFantasyPoints:[previousTwo[1],previousTwo[0]],
    expectedPoints:pts,
    pointsStdDev:sd
   }):null;

   const rise=price?price.probabilities.smallRise+price.probabilities.maxRise:null;
   const fall=price?
    (price.effectiveDeltas.smallFall<0?price.probabilities.smallFall:0)+
    (price.effectiveDeltas.maxFall<0?price.probabilities.maxFall:0):null;

   await prisma.assetPrediction.deleteMany({where:{assetId:asset.id,grandPrixId:gp.id}});
   const row=await prisma.assetPrediction.create({
    data:{
     assetId:asset.id,
     grandPrixId:gp.id,
     expectedPoints:pts,
     expectedPriceDelta:price?.expectedDelta??null,
     probabilityRise:rise,
     probabilityFlat:price?.probabilityFlat??null,
     probabilityFall:fall,
     probabilityMaxRise:price?.probabilities.maxRise??null,
     probabilitySmallRise:price?.probabilities.smallRise??null,
     probabilitySmallFall:price?.probabilities.smallFall??null,
     probabilityMaxFall:price?.probabilities.maxFall??null,
     requiredPointsMaxRise:price?.thresholds.maxRiseAt??null,
     requiredPointsSmallRise:price?.thresholds.smallRiseAt??null,
     requiredPointsAvoidMaxFall:price?.thresholds.maxFallBelow??null,
     confidence:Math.min(.8,.35+scores.length*.09),
     source:price?'Official F1 Fantasy hybrid xPts + validated rolling-3 PPM price model':'Official F1 Fantasy hybrid xPts',
     modelVersion:price?'xpts-fantasy-hybrid-v1 + price-probability-v0.3-floor-aware':'xpts-fantasy-hybrid-v1'
    }
   });

   created.push({
    code:asset.code,
    type:asset.type,
    expectedPoints:pts,
    expectedDelta:price?.expectedDelta??null,
    history:scores,
    historyStdDev:sd==null?null:Math.round(sd*10)/10,
    priceReady:Boolean(price),
    id:row.id
   });
  }

  const missing=assets.filter(a=>!created.some(p=>p.code===a.code)).map(a=>a.code);
  return NextResponse.json({
   ok:missing.length===0,
   created:created.length,
   totalAssets:assets.length,
   missing,
   model:'xpts-fantasy-hybrid-v1',
   driverModel:'0.70*EWMA(0.25)+0.30*seasonMean',
   constructorModel:'max(-5, EWMA(0.25))',
   predictions:created,
   warning:'xPts use a backtested hybrid model: drivers blend EWMA(0.25) with season mean; constructors use EWMA(0.25) clipped at -5. Track/session-specific modifiers are not yet included.'
  });
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Auto prediction failed'},{status:500});
 }
}
