import type {ComponentObservation,SessionComponent} from './component-calibration';
export type FantasyToolsObservation=ComponentObservation&{actualPoints:number;priceBefore:number};
const aliases:Record<string,string>={AST:'AMR',HAA:'HAS',KCK:'SAU',RED:'RBR',VRB:'RB'},canonical=(code:string)=>aliases[code]??code;
const points=(value:unknown)=>{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Missing or invalid component points');return value};
const position=(value:unknown)=>{const text=String(value??'');return /^[1-9]\d*$/.test(text)?Number(text):null};
function sessionTotal(session:any){
 if(!session||typeof session!=='object')throw Error('Missing scored session');const total=points(session.totalPoints?.points);
 const sum=Object.entries(session).filter(([key])=>key!=='totalPoints').reduce((n,[,value])=>n+points((value as any)?.points),0);
 if(Math.abs(sum-total)>1e-6)throw Error('Session component total mismatch');return total;
}
/** Source scoring failure means explicit Fantasy NC/DSQ, not an inferred physical DNF. */
export function parseFantasyToolsComponents(payload:any,throughRound:number,options:{season:2024|2025}={season:2025}):FantasyToolsObservation[]{
 const season=options.season;
 if(![2024,2025].includes(season)||payload?.seasonResult?.season!==season||!Number.isInteger(throughRound)||throughRound<1||throughRound>24)throw Error('Invalid component archive scope');
 const observations:FantasyToolsObservation[]=[],rounds=payload.seasonResult.raceResults;
 for(let round=1;round<=throughRound;round++){
  const day=rounds?.[String(round)];if(!day||!Array.isArray(day.drivers)||!Array.isArray(day.constructors))throw Error('Missing component round '+round);const seen=new Set<string>();
  for(const [type,rows] of [['DRIVER',day.drivers.filter((r:any)=>r.isActive===true)],['CONSTRUCTOR',day.constructors]] as const)for(const raw of rows){
   if(typeof raw.abbreviation!=='string'||typeof raw.id!=='string'||typeof raw.price!=='number'||!Number.isFinite(raw.price)||raw.price<=0)throw Error('Invalid component identity/quote');
   const code=canonical(raw.abbreviation),team=type==='DRIVER'?canonical(raw.constructorId):code,key=type+':'+code;
   if(!code||typeof team!=='string'||!team||seen.has(key))throw Error('Ambiguous active component identity');seen.add(key);
   if(type==='DRIVER'?raw.id!==raw.constructorId+'_'+raw.abbreviation:canonical(raw.id)!==code)throw Error('Component asset identity mismatch');
   const phases=raw.raceResult;if(!phases||Object.keys(phases).some(k=>!['Q','R','S'].includes(k)))throw Error('Unknown scoring phase');
   const qTotal=sessionTotal(phases.Q),rTotal=sessionTotal(phases.R),sTotal=phases.S?sessionTotal(phases.S):0,actualPoints=points(raw.totalPoints);
   if(Math.abs(qTotal+rTotal+sTotal-actualPoints)>1e-6)throw Error('Weekend scoring total mismatch');
   const ncQ=points(phases.Q.notClassifiedPoints?.points),dqQ=points(phases.Q.disqualifiedPoints?.points),noTime=ncQ<0||dqQ<0,qPosition=position(raw.qualifyingPosition);
   if(type==='DRIVER'&&!noTime&&qPosition===null)throw Error('Unknown qualifying observation');
   if(type==='CONSTRUCTOR'&&Object.entries(phases.Q).every(([key,v])=>key==='totalPoints'||points((v as any).points)===0))throw Error('Unplayed constructor qualifying placeholder');
   const row:FantasyToolsObservation={season,round,code,type,team,actualPoints,priceBefore:raw.price,qualifying:{total:qTotal,position:qPosition,noTime}};
   const parseSession=(phase:any,total:number,finish:unknown):SessionComponent=>{
    const failed=points(phase.notClassifiedPoints?.points)<0||points(phase.disqualifiedPoints?.points)<0,finishPosition=position(finish),overtakes=points(phase.overtakes?.points);
    if(type==='DRIVER'&&!failed&&finishPosition===null)throw Error('Unknown played race observation');
    if(!Number.isInteger(overtakes)||overtakes<0)throw Error('Invalid scored overtakes');
    return {total,failed,disqualified:points(phase.disqualifiedPoints?.points)<0,overtakes,fastestLap:points(phase.fastestLapPoints?.points)>0,dotd:phase.dotdPoints?points(phase.dotdPoints.points)>0:false,finishPosition:failed?null:finishPosition,positionChange:points(phase.positionsGained?.points)};
   };
   row.race=parseSession(phases.R,rTotal,raw.racePosition);
   if(phases.S)row.sprint=parseSession(phases.S,sTotal,raw.sprintPosition);
   if(type==='CONSTRUCTOR')row.pitPoints=points(phases.R.fastestPitStopPoints?.points)+points(phases.R.overallFastestPitStopPoints?.points)+points(phases.R.worldRecordPitStopPoints?.points);
   observations.push(row);
  }
 }
 return observations;
}
