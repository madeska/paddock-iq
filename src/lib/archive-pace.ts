import type {ArchivedRace,ArchiveDriver} from './race-archive';
export function fitArchivedPace(history:ArchivedRace[],options:{year:number;round:number;fieldSize?:number}){
 const size=options.fieldSize??20;if(!Number.isInteger(size)||size<2||!Number.isInteger(options.round)||options.round<1)throw Error('Invalid archive pace options');
 const past=history.filter(r=>r.year===options.year&&r.round<options.round).sort((a,b)=>a.round-b.round);const rows=past.flatMap(r=>r.drivers);const failed=(d:ArchiveDriver)=>d.dnf||d.dns||d.dsq;
 const known=rows.filter(d=>d.resultKnown),midpoint=(size+1)/2,globalFailureProbability=(known.filter(failed).length+2*.08)/(known.length+2);
 const qualifyingPace:Record<string,number>={},racePace:Record<string,number>={},progress:Record<string,number>={},failureProbability:Record<string,number>={},performanceIndex:Record<string,number>={};
 for(const code of [...new Set(rows.map(d=>d.code))].sort()){
  const own=rows.filter(d=>d.code===code),q=own.filter(d=>d.qualifyingPosition!==null&&!d.qualifyingDsq&&!d.qualifyingDns).map(d=>d.qualifyingPosition!),race=own.filter(d=>d.resultKnown&&!failed(d)&&d.finish!==null),g=race.filter(d=>d.grid!==null);
  qualifyingPace[code]=(midpoint-(q.reduce((n,p)=>n+p,0)+5*midpoint)/(q.length+5))/6;
  racePace[code]=(midpoint-(race.reduce((n,d)=>n+d.finish!,0)+5*midpoint)/(race.length+5))/6;
  progress[code]=g.reduce((n,d)=>n+d.grid!-d.finish!,0)/(g.length+5);
  failureProbability[code]=(own.filter(d=>d.resultKnown&&failed(d)).length+8*globalFailureProbability)/(own.filter(d=>d.resultKnown).length+8);
  // Ordinal performance index for a ranking comparator, not a Fantasy score.
  performanceIndex[code]=own.reduce((n,d)=>{const values:number[]=[];if(d.qualifyingPosition!==null&&!d.qualifyingDsq&&!d.qualifyingDns)values.push(size+1-d.qualifyingPosition);if(d.resultKnown)values.push(!failed(d)&&d.finish!==null?size+1-d.finish:0);return n+(values.length?values.reduce((a,b)=>a+b,0)/values.length:midpoint)},0)/own.length;
 }
 return {year:options.year,beforeRound:options.round,sourceRounds:past.map(r=>r.round),qualifyingPace,racePace,progress,failureProbability,globalFailureProbability,performanceIndex};
}
