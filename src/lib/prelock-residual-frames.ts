import {replayProductionHistory,type ReplayScore} from './production-history-replay';
import type {ArchivedFantasyPrice} from './fantasy-price-archive';
import type {PrelockWeekend,PrelockSession} from './prelock-session-archive';
import type {PrelockResidualFrame} from './prelock-residual-model';
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Archived session timestamps and round-specific rosters are checked before features are formed. */
export function buildPrelockResidualFrames(history:readonly ReplayScore[],prices:readonly ArchivedFantasyPrice[],weekends:readonly PrelockWeekend[],options:{season:number;throughRound:number}){
 const frames:PrelockResidualFrame[]=[],missing:{round:number;code:string;type:string}[]=[],seenRounds=new Set<number>();
 for(const weekend of weekends.filter(w=>w.round<=options.throughRound).sort((a,b)=>a.round-b.round)){
  if(!Number.isInteger(weekend.round)||weekend.round<1||typeof weekend.isSprint!=='boolean'||seenRounds.has(weekend.round)||new Date(weekend.lockTime).getUTCFullYear()!==options.season)throw Error('Invalid pre-lock weekend identity');seenRounds.add(weekend.round);
  if(weekend.practice&&weekend.practice.kind!=='PRACTICE'||weekend.sprintQualifying&&weekend.sprintQualifying.kind!=='SPRINT_QUALIFYING')throw Error('Pre-lock session kind mismatch');
  for(const session of [weekend.practice,weekend.sprintQualifying])if(session){const start=Date.parse(session.startedAt),end=Date.parse(session.endedAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>=Date.parse(weekend.lockTime))throw Error('Archived session violates feature cutoff')}
  const before=replayProductionHistory(history,prices,{season:options.season,round:weekend.round,sprint:weekend.isSprint}),reference=replayProductionHistory(history,prices,{season:options.season,round:weekend.round,sprint:weekend.isSprint,practice:{isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])}});
  const roster=prices.filter(p=>p.round===weekend.round),signal:PrelockSession|null=weekend.isSprint?(weekend.sprintQualifying??weekend.practice):weekend.practice,byCode=new Map(signal?.positions.map(p=>[p.code,p])??[]),fieldSize=roster.filter(r=>r.type==='DRIVER').length;
  if(signal&&(new Set(signal.positions.map(p=>p.code)).size!==signal.positions.length||signal.positions.some(p=>!Number.isInteger(p.position)||p.position<1||p.position>fieldSize)))throw Error('Invalid archived pace standings');
  const validTimes=signal?.positions.map(p=>p.bestLapSeconds).filter((t):t is number=>t!==null&&Number.isFinite(t)&&t>0)??[],fastest=validTimes.length?Math.min(...validTimes):null;
  for(const row of roster){
   const baseline=reference.find(r=>r.code===row.code&&r.type===row.type)?.prediction,prior=before.find(r=>r.code===row.code&&r.type===row.type)?.prediction;
   if(baseline==null||prior==null){missing.push({round:weekend.round,code:row.code,type:row.type});continue}
   const driverCodes=row.type==='DRIVER'?[row.code]:roster.filter(r=>r.type==='DRIVER'&&r.team===row.code).map(r=>r.code),signals=driverCodes.map(c=>byCode.get(c)).filter(r=>r!==undefined);
   const complete=signals.length===driverCodes.length&&signals.length>0,pace=complete?mean(signals.map(p=>((fieldSize+1)/2-p.position)/((fieldSize-1)/2))):0;
   const gaps=signals.map(p=>p.bestLapSeconds).filter((t):t is number=>t!==null&&Number.isFinite(t)&&t>0),gap=complete&&fastest&&gaps.length===signals.length?mean(gaps.map(t=>100*(t/fastest-1))):0;
   const ranked=before.filter(r=>r.type===row.type&&r.prediction!==null).sort((a,b)=>b.prediction!-a.prediction!||a.code.localeCompare(b.code)),rank=ranked.findIndex(r=>r.code===row.code)+1,expectedRank=ranked.length>1?((ranked.length+1)/2-rank)/((ranked.length-1)/2):0;
   const actual=history.find(h=>h.season===options.season&&h.round===weekend.round&&h.code===row.code&&h.type===row.type)?.actualPoints;
   const gapKnown=complete&&fastest!==null&&gaps.length===signals.length;
   frames.push({season:options.season,round:weekend.round,code:row.code,type:row.type,baseline,features:[prior,row.priceBefore,Number(weekend.isSprint),Number(complete),pace,gap,pace-expectedRank,Number(gapKnown)],...(actual===undefined?{}:{actualPoints:actual})});
  }
 }
 return {frames,missing};
}
