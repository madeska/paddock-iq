import type {PrismaClient} from '@prisma/client';
import type {FeedRow} from './fantasy-official-sync';

/** Validate the entire supported field before replacing active membership. Historical assets remain intact. */
export function officialRosterPlan(rows:readonly FeedRow[],season:number){
 if(season!==2026)throw Error('Unsupported official roster season');
 const aliases:Record<string,string>={RBS:'RB',HAA:'HAS',AMR:'AST'};
 const constructors=new Set(['MER','RBR','MCL','FER','ALP','RB','HAS','WIL','AUD','AST','CAD']);
 const active=rows.filter(r=>r.IsActive===true||r.IsActive===1||r.IsActive==='1');
 const ids=new Set<string>(),keys=new Set<string>();
 const plan=active.map(row=>{
  const type=row.PositionName;if(type!=='DRIVER'&&type!=='CONSTRUCTOR')throw Error('Unsupported official roster type');
  const token=String(row.DriverTLA??'').trim().toUpperCase(),code=type==='CONSTRUCTOR'?(aliases[token]??token):token;
  const id=String(row.PlayerId??''),name=String(row.FUllName??row.DisplayName??'').trim(),price=Number(row.Value),key=type+':'+code;
  if(!/^[A-Z]{2,4}$/.test(code)||!/^\d+$/.test(id)||!name||name.length>160||!Number.isFinite(price)||price<3||price>34||ids.has(id)||keys.has(key)||type==='CONSTRUCTOR'&&!constructors.has(code))throw Error('Invalid or duplicate official roster identity');
  ids.add(id);keys.add(key);return {season,code,type:type as 'DRIVER'|'CONSTRUCTOR',name,id,teamId:String(row.TeamId??'')};
 });
 const drivers=plan.filter(r=>r.type==='DRIVER'),teams=plan.filter(r=>r.type==='CONSTRUCTOR');
 if(drivers.length!==22||teams.length!==11||drivers.some(d=>!teams.some(t=>t.id===d.teamId))||teams.some(t=>drivers.filter(d=>d.teamId===t.id).length!==2))throw Error('Incomplete official 2026 field');
 return plan;
}

export async function reconcileOfficialRoster(prisma:PrismaClient,season:number,round:number,rows:readonly FeedRow[]){
 return prisma.$transaction(async tx=>{
  const state=await tx.forecastSeasonState.findUnique({where:{season}});
  if(!state||state.completed||state.round!==round)return false;
  const plan=officialRosterPlan(rows,season);
  await tx.asset.updateMany({where:{season},data:{active:false}});
  for(const {code,type,name} of plan)await tx.asset.upsert({where:{season_code_type:{season,code,type}},create:{season,code,type,name,active:true},update:{name,active:true}});
  return true;
 },{timeout:15000});
}
