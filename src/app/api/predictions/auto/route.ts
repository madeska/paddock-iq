import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictFantasyPrice } from '../../../../lib/fantasy-price-model';
import { applyPracticePositionModifier, getPracticeSnapshot } from '../../../../lib/openf1-weekend';
import { syncOfficialFantasyMarket } from '../../../../lib/fantasy-official-sync';

const EWMA_ALPHA=.25;
const RIDGE_LAMBDA=50;
const DRIVER_RIDGE_WEIGHT=.5;
const CONSTRUCTOR_EWMA_WEIGHT=.5;
const DRIVER_REACTIVATION_ROUND_2026:Record<string,number>={LAW:15,HAD:15};

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const sampleStdDev=(xs:number[])=>{
 if(xs.length<2)return 0;
 const m=mean(xs);
 return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
};
const ewmaChronological=(scores:number[])=>{
 if(!scores.length)return null;
 let value=scores[0];
 for(const score of scores.slice(1))value=EWMA_ALPHA*score+(1-EWMA_ALPHA)*value;
 return value;
};
const constructorXPts=(scoresChronological:number[])=>{
 const e=ewmaChronological(scoresChronological);
 if(e==null)return null;
 const recent=scoresChronological.slice(-3);
 const mean3=mean(recent);
 return Math.max(-5,CONSTRUCTOR_EWMA_WEIGHT*e+(1-CONSTRUCTOR_EWMA_WEIGHT)*mean3);
};

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let pivot=i;
  for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[pivot][i]))pivot=j;
  [M[i],M[pivot]]=[M[pivot],M[i]];
  const d=M[i][i];
  if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){
   if(j===i)continue;
   const f=M[j][i];
   for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k];
  }
 }
 return M.map(r=>r[n]);
}

type TrainingRow={x:number[];y:number};
function fitRidge(rows:TrainingRow[],lambda=RIDGE_LAMBDA){
 if(!rows.length)return null;
 const d=rows[0].x.length;
 const means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){
  const vals=rows.map(r=>r.x[j]);
  means[j]=mean(vals);
  const s=sampleStdDev(vals);
  sds[j]=s>1e-8?s:1;
 }
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]);
 const p=d+1,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){
  b[a]+=X[i][a]*rows[i].y;
  for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c];
 }
 for(let j=1;j<p;j++)A[j][j]+=lambda;
 const beta=solve(A,b);
 if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}

function features(historyChronological:number[],price:number){
 const e=ewmaChronological(historyChronological)??0;
 const season=mean(historyChronological);
 return [e,season,price];
}

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const season=Number(body.season??2026),round=Number(body.round??17);
  const officialSync=await syncOfficialFantasyMarket(prisma,season,round);
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});

  const practiceSnapshot=await getPracticeSnapshot(season,gp.deadline);

  const assets=await prisma.asset.findMany({
   where:{season,active:true},
   include:{
    prices:{include:{grandPrix:true}},
    fantasyScores:{where:{grandPrix:{round:{lt:round}}},include:{grandPrix:true}}
   }
  });

  const driverTraining:TrainingRow[]=[];
  for(const asset of assets.filter(a=>a.type==='DRIVER')){
   const scoreMap=new Map(asset.fantasyScores.map(s=>[s.grandPrix.round,s.points]));
   const priceMap=new Map(asset.prices.map(p=>[p.grandPrix.round,Number(p.price)]));
   for(let target=6;target<round;target++){
    const history=[...scoreMap.entries()].filter(([r])=>r<target).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
    const y=scoreMap.get(target),price=priceMap.get(target);
    if(history.length<2||y==null||price==null)continue;
    driverTraining.push({x:features(history,price),y});
   }
  }
  const driverModel=fitRidge(driverTraining,RIDGE_LAMBDA);

  const created:{code:string;type:string;expectedPoints:number;expectedDelta:number|null;modelVersion:string;id:string}[]=[];
  for(const asset of assets){
   const currentPriceRow=asset.prices
    .filter(p=>p.grandPrix.round===round)
    .sort((a,b)=>+new Date(b.recordedAt)-+new Date(a.recordedAt))[0];
   const current=currentPriceRow?Number(currentPriceRow.price):null;
   if(current==null)continue;

   const scoreRows=asset.fantasyScores
    .slice()
    .sort((a,b)=>a.grandPrix.round-b.grandPrix.round);
   const chronological=scoreRows.map(s=>s.points);
   if(!chronological.length)continue;

   let rawXPts:number|null=null;
   let boostXPts:number|null=null;
   let practicePosition:number|null=null;
   if(asset.type==='DRIVER'){
    const e=ewmaChronological(chronological);
    const ridge=driverModel?driverModel.predict(features(chronological,current)):null;
    rawXPts=ridge!=null&&e!=null
     ?DRIVER_RIDGE_WEIGHT*ridge+(1-DRIVER_RIDGE_WEIGHT)*e
     :null;
    boostXPts=ridge;
    if(rawXPts==null){
     rawXPts=e==null?null:.7*e+.3*mean(chronological);
    }
    practicePosition=practiceSnapshot?.isSprint?null:(practiceSnapshot?.positions.get(asset.code)??null);
    if(rawXPts!=null&&practicePosition!=null){
      rawXPts=applyPracticePositionModifier(rawXPts,practicePosition);
    }
    if(boostXPts!=null&&practicePosition!=null){
      boostXPts=applyPracticePositionModifier(boostXPts,practicePosition);
    }
   }else{
    rawXPts=constructorXPts(chronological);
   }
   if(rawXPts==null)continue;
   const pts=Math.round(rawXPts*10)/10;

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
      ?'xpts-driver-ridge50-ewma50-practice-v2 + price-probability-v0.3-floor-aware'
      :'xpts-driver-ridge50-ewma50-v2 + price-probability-v0.3-floor-aware')
    :'xpts-constructor-ewma50-mean3-50-v2 + price-probability-v0.3-floor-aware';

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
       ?'50/50 blend of ridge(50) xPts and EWMA(0.25) + validated normal-GP Practice position modifier from '+practiceSnapshot?.sessionName+' + validated rolling-3 PPM price model'
       :'50/50 blend of walk-forward ridge(50) and EWMA(0.25) xPts + validated rolling-3 PPM price model')
     :'50/50 blend of EWMA(0.25) and recent-3 mean constructor xPts + validated rolling-3 PPM price model',
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
   driverTrainingRows:driverTraining.length,
   officialSync,
   predictions:created
  });
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Auto prediction failed'},{status:500});
 }
}
