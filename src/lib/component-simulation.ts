import {
  constructorQualifyingPoints,
  constructorRacePoints,
  constructorSprintPoints,
  qualifyingDriverPoints,
  raceDriverPoints,
  sprintDriverPoints,
} from './fantasy-scoring';

export type ComponentDriverInput={
  code:string;
  team:string;
  baselineXPts:number;
  recentScores:number[];
};

export type ComponentConstructorInput={
  code:string;
  baselineXPts:number;
};

export type ComponentSimulationOptions={
  sprint:boolean;
  simulations?:number;
  seed?:number;
  overtakeIntensity?:number;
};

export type DriverComponentExpectation={
  code:string;
  qualifying:number;
  sprint:number;
  raceFinish:number;
  positions:number;
  overtakes:number;
  fastestLap:number;
  driverOfTheDay:number;
  dnfPenalty:number;
  total:number;
};

export type ConstructorComponentExpectation={
  code:string;
  qualifying:number;
  sprint:number;
  raceDrivers:number;
  pitStops:number;
  total:number;
};

const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));

function rng32(seed:number){
  let a=seed>>>0;
  return ()=>{
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
const gumbel=(r:()=>number)=>-Math.log(-Math.log(clamp(r(),1e-9,1-1e-9)));
const poisson=(lambda:number,r:()=>number)=>{
  if(lambda<=0)return 0;
  if(lambda>12){
    const u=Math.sqrt(-2*Math.log(clamp(r(),1e-9,1)))*Math.cos(2*Math.PI*r());
    return Math.max(0,Math.round(lambda+Math.sqrt(lambda)*u));
  }
  const L=Math.exp(-lambda);let k=0,p=1;
  do{k++;p*=r()}while(p>L);
  return k-1;
};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const sd=(xs:number[])=>{
  if(xs.length<2)return 1;
  const m=mean(xs);
  return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))||1;
};

function sampleRanking<T extends {strength:number}>(items:T[],noise:number,r:()=>number){
  return [...items].map(item=>({item,key:item.strength+noise*gumbel(r)}))
    .sort((a,b)=>b.key-a.key)
    .map(x=>x.item);
}

function chooseWeighted<T>(items:T[],weight:(item:T)=>number,r:()=>number){
  const ws=items.map(x=>Math.max(0,weight(x)));
  const total=ws.reduce((a,b)=>a+b,0);
  if(!items.length)return null;
  if(total<=0)return items[Math.floor(r()*items.length)]??items[0];
  let x=r()*total;
  for(let i=0;i<items.length;i++){x-=ws[i];if(x<=0)return items[i]}
  return items[items.length-1];
}

export function simulateComponentWeekend(
  driverInputs:ComponentDriverInput[],
  constructorInputs:ComponentConstructorInput[],
  options:ComponentSimulationOptions
){
  const simulations=Math.max(200,options.simulations??3000);
  const r=rng32(options.seed??170026);
  const overtakeIntensity=options.overtakeIntensity??2.2;

  const baselineMean=mean(driverInputs.map(d=>d.baselineXPts));
  const baselineSd=sd(driverInputs.map(d=>d.baselineXPts));
  const driverState=driverInputs.map(d=>{
    const negRate=d.recentScores.length?d.recentScores.filter(x=>x<0).length/d.recentScores.length:0;
    return {...d,strength:(d.baselineXPts-baselineMean)/baselineSd,dnfProb:clamp(.045+.14*negRate,.035,.18)};
  });

  const constructorMean=mean(constructorInputs.map(c=>c.baselineXPts));
  const constructorSd=sd(constructorInputs.map(c=>c.baselineXPts));
  const constructorState=constructorInputs.map(c=>({...c,strength:(c.baselineXPts-constructorMean)/constructorSd}));

  const dAcc=new Map<string,DriverComponentExpectation>();
  const cAcc=new Map<string,ConstructorComponentExpectation>();
  for(const d of driverState)dAcc.set(d.code,{code:d.code,qualifying:0,sprint:0,raceFinish:0,positions:0,overtakes:0,fastestLap:0,driverOfTheDay:0,dnfPenalty:0,total:0});
  for(const c of constructorState)cAcc.set(c.code,{code:c.code,qualifying:0,sprint:0,raceDrivers:0,pitStops:0,total:0});

  const teamDrivers=new Map<string,typeof driverState>();
  for(const d of driverState){
    const list=teamDrivers.get(d.team)??[];
    list.push(d);teamDrivers.set(d.team,list);
  }

  for(let sim=0;sim<simulations;sim++){
    const quali=sampleRanking(driverState,1.05,r);
    const qPos=new Map(quali.map((d,i)=>[d.code,i+1]));
    const qPts=new Map(driverState.map(d=>{
      const noTime=r()<.008;
      return [d.code,qualifyingDriverPoints({position:noTime?null:qPos.get(d.code)??null,noTime})] as const;
    }));

    let sprintPts=new Map<string,number>();
    if(options.sprint){
      const sprintGrid=sampleRanking(driverState,1.15,r);
      const sgPos=new Map(sprintGrid.map((d,i)=>[d.code,i+1]));
      const sprintClassified=driverState.filter(d=>r()>=Math.min(.07,d.dnfProb*.55));
      const sprintFinish=sampleRanking(sprintClassified,1.2,r);
      const sfPos=new Map(sprintFinish.map((d,i)=>[d.code,i+1]));
      const sprintFastest=chooseWeighted(sprintClassified,d=>Math.exp(d.strength*.8),r);
      sprintPts=new Map(driverState.map(d=>{
        const classified=sfPos.has(d.code);
        const gain=classified?(sgPos.get(d.code)!-sfPos.get(d.code)!):0;
        const overtakes=classified?Math.max(0,gain)+poisson(Math.max(.15,overtakeIntensity*.32),r):0;
        const pts=sprintDriverPoints({
          startPosition:sgPos.get(d.code)??null,
          finishPosition:sfPos.get(d.code)??null,
          classified,
          overtakes,
          fastestLap:sprintFastest?.code===d.code,
        });
        return [d.code,pts] as const;
      }));
    }

    const classified=driverState.filter(d=>r()>=d.dnfProb);
    const raceFinish=sampleRanking(classified,1.0,r);
    const finishPos=new Map(raceFinish.map((d,i)=>[d.code,i+1]));
    const fastest=chooseWeighted(classified,d=>Math.exp(d.strength*1.05)*(finishPos.get(d.code)!<=10?1.8:.45),r);
    const dotd=chooseWeighted(classified,d=>{
      const start=qPos.get(d.code)??22,finish=finishPos.get(d.code)??22,gain=Math.max(0,start-finish);
      return Math.exp(d.strength*.35)*(1+gain*.8)*(finish<=10?1.7:1);
    },r);

    const racePts=new Map<string,number>();
    const racePtsNoDotd=new Map<string,number>();
    for(const d of driverState){
      const isClassified=finishPos.has(d.code);
      const start=qPos.get(d.code)??null,finish=finishPos.get(d.code)??null;
      const gain=isClassified&&start!=null&&finish!=null?start-finish:0;
      const extraOvertakes=isClassified?poisson(Math.max(.15,overtakeIntensity*(.45+.025*(start??11))),r):0;
      const overtakes=isClassified?Math.max(0,gain)+extraOvertakes:0;
      const isFastest=fastest?.code===d.code,isDotd=dotd?.code===d.code;
      const full=raceDriverPoints({startPosition:start,finishPosition:finish,classified:isClassified,overtakes,fastestLap:isFastest,driverOfTheDay:isDotd});
      const noDotd=raceDriverPoints({startPosition:start,finishPosition:finish,classified:isClassified,overtakes,fastestLap:isFastest,driverOfTheDay:false});
      racePts.set(d.code,full);racePtsNoDotd.set(d.code,noDotd);

      const a=dAcc.get(d.code)!;
      const q=qPts.get(d.code)??0,s=sprintPts.get(d.code)??0;
      const finishOnly=isClassified&&finish!=null?(finish<=10?[25,18,15,12,10,8,6,4,2,1][finish-1]:0):0;
      a.qualifying+=q;
      a.sprint+=s;
      a.raceFinish+=isClassified?finishOnly:0;
      a.positions+=isClassified?gain:0;
      a.overtakes+=isClassified?overtakes:0;
      a.fastestLap+=isFastest?10:0;
      a.driverOfTheDay+=isDotd?10:0;
      a.dnfPenalty+=isClassified?0:-20;
      a.total+=q+s+full;
    }

    const teamPit=new Map<string,{seconds:number;points:number}>();
    for(const c of constructorState){
      const seconds=clamp(2.48-.10*c.strength+.16*(gumbel(r)-.577),1.75,3.35);
      teamPit.set(c.code,{seconds,points:0});
    }
    const fastestPit=[...teamPit.entries()].sort((a,b)=>a[1].seconds-b[1].seconds)[0]?.[0]??null;

    for(const c of constructorState){
      const ds=teamDrivers.get(c.code)??[];
      if(ds.length<2)continue;
      const [d1,d2]=ds;
      const qp:[number,number]=[qPts.get(d1.code)??0,qPts.get(d2.code)??0];
      const q2Count=[d1,d2].filter(d=>(qPos.get(d.code)??99)<=15).length;
      const q3Count=[d1,d2].filter(d=>(qPos.get(d.code)??99)<=10).length;
      const qualifying=constructorQualifyingPoints(qp,q2Count,q3Count,0);
      const sprint=options.sprint?constructorSprintPoints([sprintPts.get(d1.code)??0,sprintPts.get(d2.code)??0],0):0;
      const pit=teamPit.get(c.code)!;
      const race=constructorRacePoints({
        driverRacePointsExcludingDotD:[racePtsNoDotd.get(d1.code)??0,racePtsNoDotd.get(d2.code)??0],
        bestPitStopSeconds:pit.seconds,
        fastestPitStop:fastestPit===c.code,
        worldRecordPitStop:pit.seconds<1.8,
      });
      const raceDrivers=(racePtsNoDotd.get(d1.code)??0)+(racePtsNoDotd.get(d2.code)??0);
      const a=cAcc.get(c.code)!;
      a.qualifying+=qualifying;
      a.sprint+=sprint;
      a.raceDrivers+=raceDrivers;
      a.pitStops+=race-raceDrivers;
      a.total+=qualifying+sprint+race;
    }
  }

  const drivers=[...dAcc.values()].map(a=>({
    ...a,
    qualifying:a.qualifying/simulations,
    sprint:a.sprint/simulations,
    raceFinish:a.raceFinish/simulations,
    positions:a.positions/simulations,
    overtakes:a.overtakes/simulations,
    fastestLap:a.fastestLap/simulations,
    driverOfTheDay:a.driverOfTheDay/simulations,
    dnfPenalty:a.dnfPenalty/simulations,
    total:a.total/simulations,
  }));
  const constructors=[...cAcc.values()].map(a=>({
    ...a,
    qualifying:a.qualifying/simulations,
    sprint:a.sprint/simulations,
    raceDrivers:a.raceDrivers/simulations,
    pitStops:a.pitStops/simulations,
    total:a.total/simulations,
  }));
  return {drivers,constructors,simulations,overtakeIntensity};
}
