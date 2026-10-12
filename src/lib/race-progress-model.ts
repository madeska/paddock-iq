import type {ComponentObservation} from './component-calibration';
export type RaceProgressModel={season:number;beforeRound:number;sessions:number;progress:Record<string,number>};
/** Conditional progress among finishers. Grid normalization handles promotions caused by retirements. */
export function fitRaceProgress(history:ComponentObservation[],options:{season:number;round:number;priorStrength?:number}):RaceProgressModel{
 const strength=options.priorStrength??5;
 if(!Number.isInteger(options.round)||options.round<1||!Number.isFinite(strength)||strength<0)throw Error('Invalid race progress options');
 const unique=new Map<string,ComponentObservation>();
 for(const o of history)if(o.type==='DRIVER'&&o.season===options.season&&Number.isInteger(o.round)&&o.round>0&&o.round<options.round&&o.race&&!o.race.failed&&o.race.finishPosition!=null&&Number.isFinite(o.race.positionChange))unique.set(o.code+':'+o.round,o);
 const rows=[...unique.values()].sort((a,b)=>a.round-b.round||a.code.localeCompare(b.code));const progress:Record<string,number>={};
 for(const code of [...new Set(rows.map(o=>o.code))]){const own=rows.filter(o=>o.code===code);progress[code]=own.reduce((n,o)=>n+o.race!.positionChange,0)/(own.length+strength)}
 return {season:options.season,beforeRound:options.round,sessions:rows.length,progress};
}
/** Research only: progress relative to the starting order of classified finishers.
 * Non-contiguous finishing ranks are excluded; missing tail finishers cannot be detected. */
export function fitClassifiedProgress(history:ComponentObservation[],options:{season:number;round:number;priorStrength?:number}):RaceProgressModel{
 const prior=options.priorStrength??5;if(!Number.isInteger(options.round)||options.round<1||!Number.isFinite(prior)||prior<0)throw Error('Invalid classified progress options');
 const unique=new Map<string,ComponentObservation>();
 for(const row of history)if(row.type==='DRIVER'&&row.season===options.season&&row.round>0&&row.round<options.round&&Number.isInteger(row.round)&&row.race&&!row.race.failed)unique.set(row.code+':'+row.round,row);
 const samples:{code:string;value:number}[]=[];
 for(const round of [...new Set([...unique.values()].map(r=>r.round))]){
  const rows=[...unique.values()].filter(r=>r.round===round),valid=rows.map(r=>({code:r.code,finish:r.race!.finishPosition,start:(r.race!.finishPosition??NaN)+r.race!.positionChange}));
  if(valid.some(r=>r.finish===null||!Number.isInteger(r.finish)||r.finish<1||!Number.isInteger(r.start)||r.start<1)||new Set(valid.map(r=>r.start)).size!==valid.length)continue;
  const finish=valid.map(r=>r.finish!).sort((a,b)=>a-b);if(finish.some((p,i)=>p!==i+1))continue;
  valid.sort((a,b)=>a.start-b.start).forEach((r,i)=>samples.push({code:r.code,value:i+1-r.finish!}));
 }
 const progress:Record<string,number>={};for(const code of [...new Set(samples.map(r=>r.code))].sort()){const own=samples.filter(r=>r.code===code);progress[code]=own.reduce((n,r)=>n+r.value,0)/(own.length+prior)}
 return {season:options.season,beforeRound:options.round,sessions:samples.length,progress};
}
