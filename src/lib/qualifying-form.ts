import type {ArchivedRace} from './race-archive';
export type QualifyingFormOptions={year:number;round:number;fieldSize?:number;halfLife?:number;driverPrior?:number;teamPrior?:number};
/** Research only: current-team qualifying history, with a recency-weighted team prior. */
export function fitQualifyingForm(history:ArchivedRace[],roster:{code:string;team:string}[],options:QualifyingFormOptions){
 const {year,round,halfLife}=options,size=options.fieldSize??20,driverPrior=options.driverPrior??5,teamPrior=options.teamPrior??5;
 if(!Number.isInteger(year)||!Number.isInteger(round)||round<1||!Number.isInteger(size)||size<2||[driverPrior,teamPrior].some(n=>!Number.isFinite(n)||n<0)||(halfLife!==undefined&&(!Number.isFinite(halfLife)||halfLife<=0)))throw Error('Invalid qualifying form options');
 if(new Set(roster.map(d=>d.code)).size!==roster.length)throw Error('Duplicate qualifying roster');
 const mid=(size+1)/2,rows=history.filter(r=>r.year===year&&r.round<round).flatMap(r=>r.drivers.filter(d=>d.qualifyingPosition!==null&&!d.qualifyingDsq&&!d.qualifyingDns).map(d=>({code:d.code,team:d.team,p:d.qualifyingPosition!,w:halfLife===undefined?1:2**(-(round-1-r.round)/halfLife)})));
 const average=(selected:typeof rows,prior:number,center:number)=>{const mass=selected.reduce((n,d)=>n+d.w,0);return mass+prior>0?(selected.reduce((n,d)=>n+d.w*d.p,0)+prior*center)/(mass+prior):center};
 return Object.fromEntries([...roster].sort((a,b)=>a.code.localeCompare(b.code)).map(d=>{
  const teamCenter=d.team?average(rows.filter(r=>r.team===d.team),teamPrior,mid):mid;
  const own=rows.filter(r=>r.code===d.code&&(!d.team||r.team===d.team));
  return [d.code,(mid-average(own,driverPrior,teamCenter))/6];
 }));
}
/** Gumbel ranking, matching the simulator's qualifying distribution; canonical RNG assignment. */
export function expectedQualifyingRanks(pace:Record<string,number>,noise:number,simulations:number,seed:number){
 const codes=Object.keys(pace).sort();if(!codes.length||!Number.isFinite(noise)||noise<0||!Number.isInteger(simulations)||simulations<1||!Number.isInteger(seed)||Object.values(pace).some(p=>!Number.isFinite(p)))throw Error('Invalid qualifying sampling options');
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296};const sums=Object.fromEntries(codes.map(c=>[c,0]));
 for(let i=0;i<simulations;i++){
  const ranked=codes.map(code=>{const shock=-Math.log(-Math.log(random()));return {code,shock,value:pace[code]+noise*shock}}).sort((a,b)=>b.value-a.value||b.shock-a.shock);
  ranked.forEach((d,index)=>{sums[d.code]+=(index+1)/simulations});
 }
 return sums;
}
