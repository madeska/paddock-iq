import type {PrismaClient} from '@prisma/client';
import {officialFantasyPoints,type FeedRow} from './fantasy-official-sync';
export const OFFICIAL_SCORE_SOURCE='Official F1 Fantasy round feed';
export const EXCLUDED_SCORE_SOURCE='Official F1 Fantasy round feed: verified inactive/unplayed';
export const VERIFIED_ZERO_SOURCE='Official F1 Fantasy round feed: verified played zero';
export type StoredOfficialScore={id:string;code:string;round:number;points:number;source:string};
export type HistoryRepair={action:'preserve'|'correct'|'exclude'|'verify';points:number;source:string};
const flag=(value:unknown,expected:number)=>value===expected||value===String(expected)||value===(expected===1);
function roundStats(popup:any,round:number,playerId:string){
 if(String(popup?.Value?.PlayerId??'')!==playerId)return null;
 const fixtures=popup?.Value?.FixtureWiseStats;
 if(!Array.isArray(fixtures))return null;
 const rounds=fixtures.filter(f=>Number(f?.GamedayId)===round);
 if(rounds.length!==1||!Array.isArray(rounds[0].RaceDayWise)||!rounds[0].RaceDayWise.length||rounds[0].RaceDayWise.some((s:any)=>String(s?.Season)!=='2026'))return null;
 const stats=popup?.Value?.GamedayWiseStats;
 if(!Array.isArray(stats))return null;
 const matches=stats.filter(s=>Number(s?.GamedayId)===round);
 return matches.length===1?matches[0]:null;
}
/** Only generated zeros with independently agreeing feed/popup evidence may change. */
export function planOfficialHistoryRepair(stored:StoredOfficialScore,rows:readonly FeedRow[],popups:Readonly<Record<string,unknown>>,targetRound:number):HistoryRepair{
 const preserve:HistoryRepair={action:'preserve',points:stored.points,source:stored.source};
 if(stored.source!==OFFICIAL_SCORE_SOURCE||stored.points!==0||stored.round<1||stored.round>=targetRound)return preserve;
 const matches=rows.filter(r=>r.PositionName==='DRIVER'&&String(r.DriverTLA??'').trim().toUpperCase()===stored.code);
 if(!matches.length||matches.some(r=>r.PlayerId==null||!flag(r.IsActive,0)&&!flag(r.IsActive,1)))return preserve;
 const active=matches.filter(r=>flag(r.IsActive,1));
 if(active.length>1)return preserve;
 if(active.length===1){
  const row=active[0],stats=roundStats(popups[String(row.PlayerId)],stored.round,String(row.PlayerId)),points=officialFantasyPoints(row.GamedayPoints);
  if(!stats||!flag(stats.IsPlayed,1)||!flag(stats.IsActive,1)||!Array.isArray(stats.StatsWise)||points===null)return preserve;
  const totals=stats.StatsWise.filter((s:any)=>String(s?.Event??'').trim().toLowerCase()==='total');
  if(totals.length!==1||officialFantasyPoints(totals[0].Value)!==points)return preserve;
  return {action:points===0?'verify':'correct',points,source:points===0?VERIFIED_ZERO_SOURCE:OFFICIAL_SCORE_SOURCE};
 }
 const unplayed=matches.every(row=>{
  const stats=roundStats(popups[String(row.PlayerId)],stored.round,String(row.PlayerId));
  return officialFantasyPoints(row.GamedayPoints)===0&&stats&&flag(stats.IsPlayed,0)&&flag(stats.IsActive,0)&&Array.isArray(stats.StatsWise)&&stats.StatsWise.length===0;
 });
 return unplayed?{action:'exclude',points:0,source:EXCLUDED_SCORE_SOURCE}:preserve;
}

export type OfficialHistoryEvidence={round:(round:number)=>Promise<FeedRow[]|null>;popup:(playerId:string)=>Promise<unknown>};
async function sourceJSON(url:string){
 const response=await fetch(url,{cache:'no-store',headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'}});
 if(response.status===404)return null;
 if(!response.ok)throw Error('Official history evidence failed: HTTP '+response.status);
 return response.json();
}
const liveEvidence:OfficialHistoryEvidence={
 round:async round=>{const data=await sourceJSON('https://fantasy.formula1.com/feeds/drivers/'+round+'_en.json');return Array.isArray(data?.Data?.Value)?data.Data.Value:null},
 popup:playerId=>sourceJSON('https://fantasy.formula1.com/feeds/popup/playerstats_'+encodeURIComponent(playerId)+'.json')
};
/** No deletion: changes provenance only after agreement of two official endpoints. */
export async function reconcileOfficialHistory(prisma:PrismaClient,season:number,targetRound:number,evidence=liveEvidence,dryRun=false){
 const counts={examined:0,corrected:0,excluded:0,verified:0,preserved:0,concurrentChanges:0,dryRun};
 // The unversioned public endpoints below serve 2026, never another season.
 if(season!==2026)return counts;
 const candidates=await prisma.fantasyRoundScore.findMany({where:{source:OFFICIAL_SCORE_SOURCE,points:0,asset:{season,type:'DRIVER'},grandPrix:{season,round:{lt:targetRound}}},include:{asset:{select:{code:true}},grandPrix:{select:{round:true}}}});
 counts.examined=candidates.length;
 const roundCache=new Map<number,Promise<FeedRow[]|null>>(),popupCache=new Map<string,Promise<unknown>>(),plans:{stored:StoredOfficialScore;repair:HistoryRepair}[]=[];
 for(const candidate of candidates){
  const stored={id:candidate.id,code:candidate.asset.code,round:candidate.grandPrix.round,points:candidate.points,source:candidate.source};
  if(!roundCache.has(stored.round))roundCache.set(stored.round,evidence.round(stored.round));
  const rows=await roundCache.get(stored.round);if(!rows){counts.preserved++;continue}
  const popups:Record<string,unknown>={};
  for(const row of rows.filter(r=>r.PositionName==='DRIVER'&&String(r.DriverTLA??'').trim().toUpperCase()===stored.code&&r.PlayerId!=null)){
   const id=String(row.PlayerId);if(!popupCache.has(id))popupCache.set(id,evidence.popup(id));popups[id]=await popupCache.get(id);
  }
  const repair=planOfficialHistoryRepair(stored,rows,popups,targetRound);
  if(repair.action==='preserve'){counts.preserved++;continue}plans.push({stored,repair});
 }
 const count=(action:HistoryRepair['action'])=>{if(action==='correct')counts.corrected++;else if(action==='exclude')counts.excluded++;else if(action==='verify')counts.verified++};
 if(dryRun){for(const plan of plans)count(plan.repair.action);return counts}
 if(plans.length)await prisma.$transaction(async tx=>{
  for(const {stored,repair} of plans){
   const result=await tx.fantasyRoundScore.updateMany({where:{id:stored.id,source:OFFICIAL_SCORE_SOURCE,points:0},data:{points:repair.points,source:repair.source}});
   if(result.count)count(repair.action);else counts.concurrentChanges++;
  }
 });
 return counts;
}
