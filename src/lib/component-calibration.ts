export type SessionComponent={total:number;failed:boolean;overtakes:number;fastestLap:boolean;dotd:boolean;finishPosition:number|null;positionChange:number};
export type ComponentObservation={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';team:string;qualifying?:{total:number;position:number|null;noTime:boolean};race?:SessionComponent;sprint?:SessionComponent;pitPoints?:number};
export type DriverEventRates={dnfProbability:number;sprintDnfProbability:number;noTimeProbability:number;raceOvertakesMean:number;failedRaceOvertakesMean:number;sprintOvertakesMean:number;failedSprintOvertakesMean:number;fastestLapWeight:number;sprintFastestLapWeight:number;dotdWeight:number};
export type ComponentCalibration={version:string;season:number;beforeRound:number;sourceRounds:number[];driverSessions:number;constructorSessions:number;globalDriverRates:DriverEventRates;drivers:Record<string,DriverEventRates>;pitPoints:Record<string,{points:number;probability:number}[]>};
const array=(x:unknown):any[]=>Array.isArray(x)?x:[];
const numeric=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:typeof x==='string'&&x.trim()!==''&&Number.isFinite(Number(x))?Number(x):null;
const position=(x:unknown)=>{const match=String(x??'').match(/^([1-9]\d*)(?:st|nd|rd|th)?$/);return match?Number(match[1]):null};
/** Only finalized, actually played session events are observations. Zero points is valid. */
export function parseComponentHistory(raw:unknown,identity:{code:string;type:'DRIVER'|'CONSTRUCTOR';team:string;season:number}):ComponentObservation[]{
 const value=(raw as any)?.Value??(raw as any)?.Data?.Value;
 const output:ComponentObservation[]=[];
 for(const day of array(value?.MatchWiseStats)){
  const round=numeric(day.GamedayId);if(round===null||!Number.isInteger(round)||round<1)continue;
  const row:ComponentObservation={...identity,round};
  for(const session of array(day.RaceDayWise)){
   if(Number(session.Season)!==identity.season||String(session.MatchStatus)!=='4'||Number(session.IsPlayed)!==1)continue;
   const events=array(session.StatsWise);if(!events.length||events.some(e=>numeric(e.Value)===null))continue;
   const stats=new Map<string,{value:number;frequency:unknown}>();for(const e of events){const key=String(e.Event??'').trim().toLowerCase();stats.set(key,{value:(stats.get(key)?.value??0)+numeric(e.Value)!,frequency:e.Frequency})}
   const sum=[...stats].filter(([key])=>key!=='total').reduce((n,[,s])=>n+s.value,0);const reported=stats.get('total')?.value;if(reported!==undefined&&Math.abs(reported-sum)>1e-6)continue;
   const total=reported??sum;
   if(String(session.SessionType)==='Qualifying'){
    const noTime=stats.has('qf not classified');const p=stats.get('qualifying position');if(identity.type==='DRIVER'&&!noTime&&!p)continue;
    row.qualifying={total,position:position(p?.frequency),noTime};continue;
   }
   const sprint=[...stats.keys()].some(e=>e.startsWith('sprint ')||e==='dq sprint');const race=String(session.SessionType)==='Race';if(!sprint&&!race)continue;
   const prefix=sprint?'sprint':'race';const failed=stats.has(prefix+' not classified')||(sprint&&stats.has('dq sprint'));const p=stats.get(prefix+' position');
   if(identity.type==='DRIVER'&&!failed&&!p)continue;
   const gain=stats.get(prefix+' position gained')?.value??0,loss=stats.get(prefix+' position lost')?.value??0;
   const result:SessionComponent={total,failed,overtakes:Math.max(0,stats.get(prefix+' overtake bonus')?.value??0),fastestLap:(stats.get(prefix+' fastest lap')?.value??0)>0,dotd:(stats.get('driver of day')?.value??0)>0,finishPosition:position(p?.frequency),positionChange:gain+loss};
   if(sprint)row.sprint=result;else{row.race=result;if(identity.type==='CONSTRUCTOR')row.pitPoints=[...stats].filter(([event])=>event.includes('pitstop')||event.includes('pit stop')).reduce((n,[,s])=>n+s.value,0)}
  }
  if(row.qualifying||row.race||row.sprint)output.push(row);
 }
 return output;
}
const fallback:DriverEventRates={dnfProbability:.08,sprintDnfProbability:.035,noTimeProbability:.008,raceOvertakesMean:4,failedRaceOvertakesMean:1.5,sprintOvertakesMean:1.2,failedSprintOvertakesMean:.5,fastestLapWeight:1/22,sprintFastestLapWeight:1/22,dotdWeight:1/22};
/** Empirical Bayes shrinkage; no target-round or future observations enter any statistic. */
export function calibrateComponents(history:ComponentObservation[],options:{season:number;round:number;priorStrength?:number;halfLife?:number}):ComponentCalibration{
 const strength=options.priorStrength??8,halfLife=options.halfLife??8;
 if(!Number.isInteger(options.round)||options.round<1||!Number.isFinite(strength)||strength<0||!Number.isFinite(halfLife)||halfLife<=0)throw Error('Invalid calibration options');
 const deduplicated=new Map<string,ComponentObservation>();for(const o of history)if(o.season===options.season&&o.round<options.round)deduplicated.set(o.type+':'+o.code+':'+o.round,o);
 const rows=[...deduplicated.values()],drivers=rows.filter(o=>o.type==='DRIVER'),constructors=rows.filter(o=>o.type==='CONSTRUCTOR'&&o.race&&o.pitPoints!==undefined);
 const weight=(o:ComponentObservation)=>Math.pow(.5,(options.round-1-o.round)/halfLife);
 function estimate(xs:ComponentObservation[],pick:(o:ComponentObservation)=>number|undefined,prior:number,priorN:number){let n=priorN,total=priorN*prior;for(const o of xs){const v=pick(o);if(v===undefined||!Number.isFinite(v))continue;const w=weight(o);n+=w;total+=w*v}return n?total/n:prior}
 const pickers:Record<keyof DriverEventRates,(o:ComponentObservation)=>number|undefined>={
  dnfProbability:o=>o.race?Number(o.race.failed):undefined,sprintDnfProbability:o=>o.sprint?Number(o.sprint.failed):undefined,noTimeProbability:o=>o.qualifying?Number(o.qualifying.noTime):undefined,
  raceOvertakesMean:o=>o.race&&!o.race.failed?o.race.overtakes:undefined,failedRaceOvertakesMean:o=>o.race?.failed?o.race.overtakes:undefined,
  sprintOvertakesMean:o=>o.sprint&&!o.sprint.failed?o.sprint.overtakes:undefined,failedSprintOvertakesMean:o=>o.sprint?.failed?o.sprint.overtakes:undefined,
  fastestLapWeight:o=>o.race?Number(o.race.fastestLap):undefined,sprintFastestLapWeight:o=>o.sprint?Number(o.sprint.fastestLap):undefined,dotdWeight:o=>o.race?Number(o.race.dotd):undefined,
 };
 const keys=Object.keys(pickers) as (keyof DriverEventRates)[];
 const globalDriverRates={...fallback};for(const key of keys)globalDriverRates[key]=estimate(drivers,pickers[key],fallback[key],2);
 const rates:Record<string,DriverEventRates>={};for(const code of [...new Set(drivers.map(o=>o.code))].sort()){const own=drivers.filter(o=>o.code===code),r={...globalDriverRates};for(const key of keys)r[key]=estimate(own,pickers[key],globalDriverRates[key],strength);rates[code]=r}
 const categories=[...new Set(constructors.map(o=>o.pitPoints!))].sort((a,b)=>a-b);const pitPoints:ComponentCalibration['pitPoints']={};
 for(const code of [...new Set(constructors.map(o=>o.code))].sort()){const own=constructors.filter(o=>o.code===code);pitPoints[code]=categories.map(points=>({points,probability:estimate(own,o=>Number(o.pitPoints===points),estimate(constructors,o=>Number(o.pitPoints===points),0,0),strength)}))}
 return {version:'official-components-v1',season:options.season,beforeRound:options.round,sourceRounds:[...new Set(rows.map(o=>o.round))].sort((a,b)=>a-b),driverSessions:drivers.filter(o=>o.race).length,constructorSessions:constructors.length,globalDriverRates,drivers:rates,pitPoints};
}
