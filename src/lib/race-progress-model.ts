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
