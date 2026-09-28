import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { predictPrice } from '../../../../lib/price-predictor';

type OFDriver={driver_number:number;name_acronym:string;team_name:string};
type OFResult={driver_number:number;position:number;dnf?:boolean;dns?:boolean;dsq?:boolean};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const season=Number(body.season??2026), round=Number(body.round??18);
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});
  if(!gp)return NextResponse.json({error:'Grand Prix not found'},{status:404});

  const sessions=await fetch('https://api.openf1.org/v1/sessions?year='+season+'&session_name=Race',{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as any[];
  const completed=sessions.filter(s=>new Date(s.date_end)<new Date()).sort((a,b)=>+new Date(b.date_end)-+new Date(a.date_end));
  if(!completed.length)throw Error('No completed OpenF1 race found');
  const sessionKey=completed[0].session_key;
  const [drivers,results]=await Promise.all([
   fetch('https://api.openf1.org/v1/drivers?session_key='+sessionKey,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as Promise<OFDriver[]>,
   fetch('https://api.openf1.org/v1/session_result?session_key='+sessionKey,{signal:AbortSignal.timeout(12000)}).then(r=>r.json()) as Promise<OFResult[]>
  ]);
  const byNumber=new Map(results.map(r=>[r.driver_number,r]));
  const byCode=new Map(drivers.map(d=>[d.name_acronym,d]));
  const assets=await prisma.asset.findMany({where:{season},include:{prices:{orderBy:{recordedAt:'desc'},take:2}}});
  const driverXPts=new Map<string,number>(); const teamPoints=new Map<string,number[]>();

  for(const a of assets.filter(a=>a.type==='DRIVER')){
   const d=byCode.get(a.code); const result=d?byNumber.get(d.driver_number):undefined;
   const price=a.prices[0]?Number(a.prices[0].price):3;
   const pricePrior=clamp((price-3)/25,0,1);
   const finish=result?.position??18;
   const form=clamp((22-finish)/21,0,1);
   const reliability=result&&(result.dnf||result.dns||result.dsq)?0.65:1;
   const x=Math.round(clamp((5+31*(0.58*form+0.42*pricePrior))*reliability,-5,45)*10)/10;
   driverXPts.set(a.code,x);
   if(d){const arr=teamPoints.get(d.team_name)||[];arr.push(x);teamPoints.set(d.team_name,arr)}
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
   }
   if(pts==null)continue;
   const previous=asset.prices[1]?Number(asset.prices[1].price):current;
   const p=predictPrice({currentPrice:current,previousPrice:previous,expectedPoints:pts});
   const row=await prisma.assetPrediction.create({data:{assetId:asset.id,grandPrixId:gp.id,expectedPoints:pts,expectedPriceDelta:p.expectedDelta,probabilityRise:p.probabilityRise,probabilityFlat:p.probabilityFlat,probabilityFall:p.probabilityFall,confidence:Math.min(p.confidence,0.55),source:'Paddock IQ + OpenF1 recent-form heuristic',modelVersion:'xpts-openf1-v0.1'}});
   created.push({code:asset.code,expectedPoints:pts,expectedDelta:p.expectedDelta,id:row.id});
  }
  return NextResponse.json({ok:true,created:created.length,sourceSession:sessionKey,predictions:created,warning:'Experimental v0.1 projection. Uses latest completed OpenF1 race form plus a market-price prior; it is not an official F1 Fantasy projection.'});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Auto prediction failed'},{status:500})}
}