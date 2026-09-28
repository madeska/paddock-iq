import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictPrice } from '../../../../lib/price-predictor';

type OFDriver={driver_number:number;name_acronym:string;team_name:string};
type OFResult={driver_number:number;position:number;dnf?:boolean;dns?:boolean;dsq?:boolean};
const asArray=<T,>(value:unknown):T[]=>Array.isArray(value)?value:[];

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const season=Number(body.season??2026), round=Number(body.round??18);
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});

  const sessions=await fetch('https://api.openf1.org/v1/sessions?year='+season+'&session_name=Race',{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as any[];
  const completed=sessions.filter(s=>new Date(s.date_end)<new Date()).sort((a,b)=>+new Date(b.date_end)-+new Date(a.date_end)).slice(0,5);
  if(!completed.length)throw Error('No completed OpenF1 race found');

  const raceData=await Promise.all(completed.map(async(session,index)=>{
   const [drivers,results]=await Promise.all([
    fetch('https://api.openf1.org/v1/drivers?session_key='+session.session_key,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as Promise<OFDriver[]>,
    fetch('https://api.openf1.org/v1/session_result?session_key='+session.session_key,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as Promise<OFResult[]>
   ]);
   return {session,index,drivers:asArray<OFDriver>(drivers),results:asArray<OFResult>(results)};
  }));
  const latestDrivers=raceData[0].drivers;
  const latestByCode=new Map(latestDrivers.map(d=>[d.name_acronym,d]));
  const assets=await prisma.asset.findMany({where:{season},include:{prices:{orderBy:{recordedAt:'desc'},take:2}}});
  const driverXPts=new Map<string,number>(); const teamPoints=new Map<string,number[]>();
  const weights=[1,.82,.67,.55,.45];

  for(const a of assets.filter(a=>a.type==='DRIVER')){
   const observations:{form:number;reliability:number;weight:number}[]=[];
   for(const race of raceData){
    const d=race.drivers.find(x=>x.name_acronym===a.code);if(!d)continue;
    const result=race.results.find(x=>x.driver_number===d.driver_number);if(!result)continue;
    observations.push({form:clamp((22-result.position)/21,0,1),reliability:(result.dnf||result.dns||result.dsq)?0:1,weight:weights[race.index]??.4});
   }
   const price=a.prices[0]?Number(a.prices[0].price):3;
   const pricePrior=clamp((price-3)/25,0,1);
   const totalW=observations.reduce((s,o)=>s+o.weight,0);
   const form=totalW?observations.reduce((s,o)=>s+o.form*o.weight,0)/totalW:.35;
   const reliability=totalW?observations.reduce((s,o)=>s+o.reliability*o.weight,0)/totalW:.8;
   const sampleConfidence=clamp(observations.length/5,.2,1);
   const x=Math.round(clamp(4+32*(.60*form+.25*pricePrior+.15*reliability)*(.9+.1*sampleConfidence),-5,45)*10)/10;
   driverXPts.set(a.code,x);
   const latest=latestByCode.get(a.code);
   if(latest){const arr=teamPoints.get(latest.team_name)||[];arr.push(x);teamPoints.set(latest.team_name,arr)}
  }
  const aliases:Record<string,string>={
   'Red Bull Racing':'Red Bull Racing','Racing Bulls':'Racing Bulls','Mercedes':'Mercedes','Ferrari':'Ferrari','McLaren':'McLaren',
   'Alpine':'Alpine','Williams':'Williams','Haas F1 Team':'Haas F1 Team','Audi':'Audi Revolut F1 Team','Aston Martin':'Aston Martin','Cadillac':'Cadillac Formula 1 Team'
  };
  const created=[];
  for(const asset of assets){
   const current=asset.prices[0]?Number(asset.prices[0].price):null;if(current==null)continue;
   let pts:number|null=null;
   if(asset.type==='DRIVER')pts=driverXPts.get(asset.code)??null;
   else{
    const match=Object.entries(aliases).find(([,market])=>market===asset.name)?.[0];
    const xs=match?teamPoints.get(match):undefined;
    if(xs?.length)pts=Math.round((xs.reduce((a,b)=>a+b,0)+5)*10)/10;
    // OpenF1 team naming can differ from our market names. Never leave the optimizer
    // with a partial prediction set: use a conservative market-prior fallback.
    if(pts==null)pts=Math.round((12+clamp((current-3)/30,0,1)*48)*10)/10;
   }
   if(pts==null)pts=Math.round((5+clamp((current-3)/25,0,1)*25)*10)/10;
   const previous=asset.prices[1]?Number(asset.prices[1].price):current;
   const p=predictPrice({currentPrice:current,previousPrice:previous,expectedPoints:pts});
   const row=await prisma.assetPrediction.create({data:{assetId:asset.id,grandPrixId:gp.id,expectedPoints:pts,expectedPriceDelta:p.expectedDelta,probabilityRise:p.probabilityRise,probabilityFlat:p.probabilityFlat,probabilityFall:p.probabilityFall,confidence:Math.min(p.confidence,0.55),source:'Paddock IQ + OpenF1 rolling 5-race form',modelVersion:'xpts-openf1-v1.0'}});
   created.push({code:asset.code,expectedPoints:pts,expectedDelta:p.expectedDelta,id:row.id});
  }
  const missing=assets.filter(a=>!created.some(p=>p.code===a.code)).map(a=>a.code);
  return NextResponse.json({ok:missing.length===0,created:created.length,totalAssets:assets.length,missing,sourceSessions:completed.map(s=>s.session_key),predictions:created,warning:'Experimental v1.0 projection. Uses recency-weighted results from up to five completed OpenF1 races, reliability and a market-price prior; it is not an official F1 Fantasy projection.'});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Auto prediction failed'},{status:500})}
}