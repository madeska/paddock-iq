import type {PrismaClient} from '@prisma/client';
import {officialFantasyPoints,usableOfficialRow,type FeedRow} from './fantasy-official-sync';
export const COMPLETED_SCORE_SOURCE='Official F1 Fantasy completed race: feed + popup verified';
const yes=(v:unknown)=>v===1||v==='1'||v===true;
/** Finished main race plus independently agreeing official total; zero is a result, never a missing-value default. */
export function verifiedCompletedPoints(row:FeedRow,popup:any,season:number,round:number,asOf:Date):number|null{
 if(!yes(row.IsActive)||row.PlayerId==null||String(popup?.Value?.PlayerId)!==String(row.PlayerId))return null;
 const points=officialFantasyPoints(row.GamedayPoints);if(points===null||!Number.isInteger(points))return null;
 const fixtures=popup?.Value?.FixtureWiseStats,days=popup?.Value?.GamedayWiseStats;if(!Array.isArray(fixtures)||!Array.isArray(days))return null;
 const fixture=fixtures.filter(f=>Number(f?.GamedayId)===round),day=days.filter(f=>Number(f?.GamedayId)===round);
 if(fixture.length!==1||day.length!==1||!Array.isArray(fixture[0].RaceDayWise)||!yes(day[0].IsPlayed)||!yes(day[0].IsActive)||!Array.isArray(day[0].StatsWise))return null;
 const sessions=fixture[0].RaceDayWise;if(sessions.some((s:any)=>Number(s?.Season)!==season))return null;
 const races=sessions.filter((s:any)=>String(s?.SessionName).toLowerCase()==='race');
 if(races.length!==1||String(races[0].MatchStatus)!=='4'||!Number.isFinite(+asOf)||!Number.isFinite(Date.parse(races[0].SessionStartDate))||Date.parse(races[0].SessionStartDate)>=+asOf)return null;
 const totals=day[0].StatsWise.filter((s:any)=>String(s?.Event).trim().toLowerCase()==='total');
 if(totals.length===1)return officialFantasyPoints(totals[0].Value)===points?points:null;
 // Official popup omits Total for some genuine zero scores (e.g. GAS R16 2026).
 const components=day[0].StatsWise as {Event:unknown;Value:unknown}[];
 const values=components.map(s=>officialFantasyPoints(s.Value)),events=components.map(s=>String(s.Event??'').trim().toLowerCase());
 return totals.length===0&&points===0&&values.length>0&&events.every(Boolean)&&new Set(events).size===events.length&&values.every(v=>v!==null)&&values.reduce<number>((sum,v)=>sum+(v??0),0)===0?0:null;
}
export type CompletedScoreEvidence={round:(round:number)=>Promise<FeedRow[]>;popup:(id:string)=>Promise<unknown>};
async function json(url:string){const response=await fetch(url,{cache:'no-store',headers:{'user-agent':'Mozilla/5.0 Paddock-IQ'},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Official Fantasy source unavailable: HTTP '+response.status);return response.json()}
const live:CompletedScoreEvidence={round:async round=>{const body=await json('https://fantasy.formula1.com/feeds/drivers/'+round+'_en.json');if(!Array.isArray(body?.Data?.Value)||!body.Data.Value.length)throw Error('Official Fantasy feed has no results');return body.Data.Value},popup:id=>json('https://fantasy.formula1.com/feeds/popup/playerstats_'+encodeURIComponent(id)+'.json')};
export async function syncCompletedFantasyScores(prisma:PrismaClient,season:number,round:number,evidence:CompletedScoreEvidence=live,asOf=new Date()){
 // Public unversioned endpoints are currently the 2026 season. Never import them under a different year.
 if(season!==2026||!Number.isInteger(round)||round<1||round>30)throw Error('Unsupported season or round');
 const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});if(!gp)throw Error('Grand Prix not found');
 const assets=await prisma.asset.findMany({where:{season}}),rows=await evidence.round(round),aliases:Record<string,string>={RBS:'RB',HAA:'HAS',AMR:'AST'};
 const candidates: {assetId:string;code:string;row:FeedRow}[]=[],seen=new Set<string>();
 for(const row of rows){if(!usableOfficialRow(row)||!['DRIVER','CONSTRUCTOR'].includes(row.PositionName??''))continue;const token=String(row.DriverTLA??'').trim().toUpperCase(),code=row.PositionName==='CONSTRUCTOR'?(aliases[token]??token):token,key=row.PositionName+':'+code;if(!code)continue;if(seen.has(key))throw Error('Ambiguous official result: '+key);seen.add(key);const asset=assets.find(a=>a.type===row.PositionName&&a.code===code);if(asset&&row.PlayerId!=null)candidates.push({assetId:asset.id,code,row})}
 if(!candidates.length)throw Error('No known official result assets');
 const first=candidates[0],firstPopup:any=await evidence.popup(String(first.row.PlayerId));
 const fixtures=firstPopup?.Value?.FixtureWiseStats;
 const fixture=Array.isArray(fixtures)?fixtures.filter(f=>Number(f?.GamedayId)===round):[];
 const races=fixture.length===1&&Array.isArray(fixture[0].RaceDayWise)?fixture[0].RaceDayWise.filter((r:any)=>Number(r?.Season)===season&&String(r?.SessionName).toLowerCase()==='race'):[];
 if(String(firstPopup?.Value?.PlayerId)===String(first.row.PlayerId)&&races.length===1&&['0','1','2','3'].includes(String(races[0].MatchStatus)))return {season,round,checkedAt:asOf.toISOString(),status:'WAITING',verified:0,total:candidates.length,saved:0,corrected:0,unchanged:0,protectedScores:0,pending:candidates.map(c=>c.code),errors:[] as string[]};
 const verified:{assetId:string;code:string;points:number}[]=[],pending:string[]=[],errors:string[]=[];
 // Small batches keep public source load bounded. Missing/partial evidence never clears saved results.
 for(let offset=0;offset<candidates.length;offset+=4){await Promise.all(candidates.slice(offset,offset+4).map(async candidate=>{try{const popup=candidate===first?firstPopup:await evidence.popup(String(candidate.row.PlayerId)),points=verifiedCompletedPoints(candidate.row,popup,season,round,asOf);if(points===null)pending.push(candidate.code);else verified.push({assetId:candidate.assetId,code:candidate.code,points})}catch{pending.push(candidate.code);errors.push(candidate.code+': official breakdown unavailable')}}))}
 let saved=0,corrected=0,unchanged=0,protectedScores=0;
 if(verified.length)await prisma.$transaction(async tx=>{for(const entry of verified){const where={assetId_grandPrixId:{assetId:entry.assetId,grandPrixId:gp.id}},existing=await tx.fantasyRoundScore.findUnique({where});if(existing&&!existing.source.startsWith('Official F1 Fantasy')){protectedScores++;continue}if(existing&&existing.points===entry.points&&existing.source===COMPLETED_SCORE_SOURCE){unchanged++;continue}const data={points:entry.points,source:COMPLETED_SCORE_SOURCE,recordedAt:asOf};const written=existing?await tx.fantasyRoundScore.updateMany({where:{id:existing.id,points:existing.points,source:existing.source},data}):await tx.fantasyRoundScore.createMany({data:[{assetId:entry.assetId,grandPrixId:gp.id,...data}],skipDuplicates:true});if(!written.count){protectedScores++;continue}if(existing&&existing.points!==entry.points)corrected++;saved++}});
 return {season,round,checkedAt:asOf.toISOString(),status:verified.length===0?'WAITING':pending.length||protectedScores?'PARTIAL':'UPDATED',verified:verified.length,total:candidates.length,saved,corrected,unchanged,protectedScores,pending,errors};
}
