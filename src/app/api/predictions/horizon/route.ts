import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictFantasyPrice } from '../../../../lib/fantasy-price-model';
import { applyPracticePositionModifier, getPracticeSnapshot } from '../../../../lib/openf1-weekend';

const EWMA_ALPHA=.25;
const RIDGE_LAMBDA=50;
const HORIZON_DRIVER_RIDGE_WEIGHT=.25;
const SPRINT_ROUNDS_2026=new Set([2,4,5,9,12,17]);
const SPRINT_CORRECTION={DRIVER:2.58,CONSTRUCTOR:3.70} as const;
const HORIZON_ERROR={
 DRIVER:[{mae:10.64,rmse:14.50},{mae:10.40,rmse:14.28},{mae:11.35,rmse:15.20}],
 CONSTRUCTOR:[{mae:16.49,rmse:20.78},{mae:16.77,rmse:20.75},{mae:17.90,rmse:22.40}]
} as const;

const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const std=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const ewma=(scores:number[])=>{if(!scores.length)return null;let v=scores[0];for(const x of scores.slice(1))v=EWMA_ALPHA*x+(1-EWMA_ALPHA)*v;return v};
const constructorXPts=(scores:number[])=>{const e=ewma(scores);return e==null?null:Math.max(-5,e)};

function features(history:number[],price:number){
 const e=ewma(history)??0;
 const season=mean(history);
 return [e,season,price];
}

function solve(A:number[][],b:number[]){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){
  let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;
  [M[i],M[p]]=[M[p],M[i]];
  const d=M[i][i];if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k]}
 }
 return M.map(r=>r[n]);
}
function fitRidge(rows:{x:number[];y:number}[]){
 if(!rows.length)return null;
 const d=rows[0].x.length,means=Array(d).fill(0),sds=Array(d).fill(1);
 for(let j=0;j<d;j++){const vals=rows.map(r=>r.x[j]);means[j]=mean(vals);const s=std(vals);sds[j]=s>1e-8?s:1}
 const X=rows.map(r=>[1,...r.x.map((v,j)=>(v-means[j])/sds[j])]),p=d+1;
 const A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(let i=0;i<X.length;i++)for(let a=0;a<p;a++){b[a]+=X[i][a]*rows[i].y;for(let c=0;c<p;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let j=1;j<p;j++)A[j][j]+=RIDGE_LAMBDA;
 const beta=solve(A,b);if(!beta)return null;
 return {predict:(x:number[])=>beta[0]+x.reduce((s,v,j)=>s+beta[j+1]*(v-means[j])/sds[j],0)};
}

const gpName=(round:number)=>({16:'Bahrain GP in Malaysia',17:'Singapore GP',18:'United States GP'} as Record<number,string>)[round]??'Round '+round;

export async function GET(request:NextRequest){
 try{
  const season=Number(request.nextUrl.searchParams.get('season')??2026);
  const startRound=Number(request.nextUrl.searchParams.get('round')??17);
  const length=Math.max(1,Math.min(3,Number(request.nextUrl.searchParams.get('length')??3)));

  const startGp=await prisma.grandPrix.findUnique({where:{season_round:{season,round:startRound}}});
  const practiceSnapshot=await getPracticeSnapshot(season,startGp?.deadline??null);

  const assets=await prisma.asset.findMany({
   where:{season,active:true},
   include:{
    prices:{include:{grandPrix:true}},
    fantasyScores:{where:{grandPrix:{round:{lt:startRound}}},include:{grandPrix:true}}
   }
  });

  const training:{x:number[];y:number}[]=[];
  for(const asset of assets.filter(a=>a.type==='DRIVER')){
   const scores=new Map(asset.fantasyScores.map(s=>[s.grandPrix.round,s.points]));
   const latestPriceByRound=new Map<number,{price:number;recordedAt:Date}>();
   for(const p of asset.prices){
    const existing=latestPriceByRound.get(p.grandPrix.round);
    if(!existing||p.recordedAt>existing.recordedAt)latestPriceByRound.set(p.grandPrix.round,{price:Number(p.price),recordedAt:p.recordedAt});
   }
   for(let target=6;target<startRound;target++){
    const history=[...scores.entries()].filter(([r])=>r<target).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
    const y=scores.get(target),price=latestPriceByRound.get(target)?.price;
    if(history.length<2||y==null||price==null)continue;
    training.push({x:features(history,price),y});
   }
  }
  const driverModel=fitRidge(training);

  const result=[];
  for(const asset of assets){
   const history=asset.fantasyScores.slice().sort((a,b)=>a.grandPrix.round-b.grandPrix.round).map(s=>s.points);
   const startPrice=asset.prices.filter(p=>p.grandPrix.round===startRound).sort((a,b)=>+b.recordedAt-+a.recordedAt)[0];
   if(!history.length||!startPrice)continue;
   let projectedPrice=Number(startPrice.price);
   const projectedHistory=[...history];
   const rounds=[];

   for(let step=0;step<length;step++){
    const round=startRound+step;
    let raw:number|null=null;
    if(asset.type==='DRIVER'){
      const ridge=driverModel?.predict(features(projectedHistory,projectedPrice))??null;
      const e=ewma(projectedHistory)??0;
      raw=ridge!=null
        ?HORIZON_DRIVER_RIDGE_WEIGHT*ridge+(1-HORIZON_DRIVER_RIDGE_WEIGHT)*e
        :e;
    }else{
      raw=constructorXPts(projectedHistory);
    }
    if(raw==null)break;
    if(step===0&&asset.type==='DRIVER'&&practiceSnapshot&&!practiceSnapshot.isSprint){
      const position=practiceSnapshot.positions.get(asset.code);
      if(position!=null)raw=applyPracticePositionModifier(raw,position);
    }
    const sprintCorrection=SPRINT_ROUNDS_2026.has(round)?SPRINT_CORRECTION[asset.type]:0;
    const expectedPoints=Math.round((raw+sprintCorrection)*10)/10;

    const newest=[...projectedHistory].reverse();
    const priceModel=newest.length>=2?predictFantasyPrice({
     currentPrice:projectedPrice,
     previousFantasyPoints:[newest[1],newest[0]],
     expectedPoints,
     pointsStdDev:std(newest.slice(0,5))
    }):null;
    const expectedPriceDelta=priceModel?.expectedDelta??0;
    const nextPrice=Math.min(34,Math.max(3,Math.round((projectedPrice+expectedPriceDelta)*100)/100));

    rounds.push({
     round,
     grandPrix:gpName(round),
     expectedPoints,
     sprint:SPRINT_ROUNDS_2026.has(round),
     sprintCorrection,
     historicalError:HORIZON_ERROR[asset.type][step]??null,
     projectedPrice:Math.round(projectedPrice*100)/100,
     expectedPriceDelta,
     projectedNextPrice:nextPrice
    });

    projectedHistory.push(expectedPoints);
    projectedPrice=nextPrice;
   }

   result.push({code:asset.code,name:asset.name,type:asset.type,rounds,totalExpectedPoints:Math.round(rounds.reduce((s,r)=>s+r.expectedPoints,0)*10)/10,totalExpectedPriceDelta:Math.round((projectedPrice-Number(startPrice.price))*100)/100});
  }

  return NextResponse.json({
   season,startRound,length,
   model:'sprint-aware-horizon-v2',
   driverModel:'ridge50 using EWMA, season mean and price; current normal GP may include validated Practice-position modifier; recursive history/price + validated Sprint correction',
   constructorModel:'EWMA(0.25), floor -5, recursively using projected history + validated Sprint correction',
   sprintCorrection:SPRINT_CORRECTION,
   horizonErrorCalibration:HORIZON_ERROR,
   practiceSnapshot:practiceSnapshot?{sessionName:practiceSnapshot.sessionName,isSprint:practiceSnapshot.isSprint,drivers:practiceSnapshot.positions.size}:null,
   caveat:'Current normal GP can use the validated pre-lock Practice-position modifier when OpenF1 data is available. Sprint weekends stay on ridge3 for this modifier. Sprint-format correction is still applied to known Sprint rounds. Circuit, weather, upgrade, and news modifiers are not yet applied. Uncertainty compounds after the first projected round.',
   assets:result
  });
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Horizon prediction failed'},{status:500});
 }
}
