export type PitStop2024={id:string;team:string;seconds:number};
const AWARDS=[10,5,3] as const;
/** Three source-confirmed stop ranks. Repeated teams represent distinct stops, never a team-best ranking. */
export function rankedPitPodiumAwards2024(stops:readonly {id:string;team:string}[],teams:readonly string[]=[]){
 if(stops.length!==3)throw Error('Incomplete 2024 pit podium');
 const ids=new Set<string>(),result:Record<string,number>={};
 for(const team of teams){if(!team||Object.hasOwn(result,team))throw Error('Invalid constructor identity');Object.defineProperty(result,team,{value:0,writable:true,enumerable:true,configurable:true})}
 stops.forEach((stop,i)=>{if(!stop.id||!stop.team||ids.has(stop.id))throw Error('Invalid or duplicate stop identity');ids.add(stop.id);Object.defineProperty(result,stop.team,{value:(Object.hasOwn(result,stop.team)?result[stop.team]:0)+AWARDS[i],writable:true,enumerable:true,configurable:true})});
 return result;
}
/** Research helper for observed/simulated individual stops. Unknown tie-breaking is rejected. */
export function pitPodiumAwards2024(stops:readonly PitStop2024[]){
 if(stops.length<3)throw Error('Incomplete 2024 pit podium');
 const ids=new Set<string>();for(const stop of stops){if(!stop.id||!stop.team||ids.has(stop.id)||!Number.isFinite(stop.seconds)||stop.seconds<=0)throw Error('Invalid pit stop');ids.add(stop.id)}
 const ordered=[...stops].sort((a,b)=>a.seconds-b.seconds);
 for(let i=1;i<Math.min(4,ordered.length);i++)if(ordered[i].seconds===ordered[i-1].seconds)throw Error('Unknown pit time tie-break');
 return rankedPitPodiumAwards2024(ordered.slice(0,3),[...new Set(stops.map(s=>s.team))]);
}
