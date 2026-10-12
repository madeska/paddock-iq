import {loadEnvConfig} from '@next/env';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildCandidateCapture} from '../src/lib/candidate-capture';
import history from '../src/data/component-history-2026.json';
import {parseComponentHistory,type ComponentObservation} from '../src/lib/component-calibration';
import {officialDriverTeams,usableOfficialRow,type FeedRow} from '../src/lib/fantasy-official-sync';
import {EXCLUDED_SCORE_SOURCE} from '../src/lib/official-history-reconciliation';
import {COMPLETED_SCORE_SOURCE} from '../src/lib/completed-fantasy-scores';
import {getWeekendLock,getPracticeSnapshot} from '../src/lib/openf1-weekend';
import {getGridPenaltyNews} from '../src/lib/grid-penalty-news';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
async function main(){
 if(process.argv.includes('--help')){console.log('Usage: npx tsx scripts/capture-candidate.ts [ROUND]\nRead-only local database and public F1 data. Saves paired normal-weekend forecasts before lock.');return}
 loadEnvConfig(process.env.PADDOCK_ENV_DIR??process.cwd(),true,{info:()=>{},error:()=>{}});
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL unavailable; run from the configured Paddock IQ checkout');
 const {prisma}=await import('../src/lib/prisma');
 try{
  const season=2026,state=await prisma.forecastSeasonState.findUnique({where:{season}});if(!state||state.completed)throw Error('Open the market first; no active forecast state');
  const round=Number(process.argv[2]??state.round);if(round!==state.round)throw Error('Capture must target the current forecast round');
  const gp=await prisma.grandPrix.findUnique({where:{season_round:{season,round}}});if(!gp)throw Error('Current Grand Prix unavailable');
  const lock=await getWeekendLock(season,round,gp.name,gp.deadline);if(!lock||lock.isSprint!==false||Date.now()>=+lock.deadline)throw Error('Verified normal-weekend lock is unavailable or already passed');
  const asOf=new Date(),practice=await getPracticeSnapshot(season,lock.deadline,asOf);
  const assets=await prisma.asset.findMany({where:{season,active:true},include:{prices:{include:{grandPrix:true}},fantasyScores:{where:{source:{not:EXCLUDED_SCORE_SOURCE},grandPrix:{season,round:{lt:round}}},include:{grandPrix:true}}}});
  const sourceHashes:Record<string,string>={};
  async function source(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw Error('Public source HTTP '+response.status);const text=await response.text();sourceHashes[url]=hash(text);return JSON.parse(text)}
  const feed=await source('https://fantasy.formula1.com/feeds/drivers/'+round+'_en.json'),feedRows:FeedRow[]=feed?.Data?.Value;if(!Array.isArray(feedRows))throw Error('Current roster unavailable');
  const teams=officialDriverTeams(feedRows),components=[...history.observations] as ComponentObservation[],lastArchived=Math.max(...components.map(r=>r.round));
  // Append only completed observations agreeing with this installation's verified official scores.
  for(let offset=0;offset<assets.length;offset+=4)await Promise.all(assets.slice(offset,offset+4).map(async asset=>{
   const required=asset.fantasyScores.filter(s=>s.grandPrix.round>lastArchived);if(!required.length)return;
   const matching=feedRows.filter(r=>usableOfficialRow(r)&&r.PositionName===asset.type&&String(r.DriverTLA).toUpperCase()===(asset.code==='RB'?'RBS':asset.code==='HAS'?'HAA':asset.code));
   if(matching.length!==1||matching[0].PlayerId==null)throw Error('Ambiguous component identity: '+asset.code);
   const raw=await source('https://fantasy.formula1.com/feeds/popup/playerstats_'+matching[0].PlayerId+'.json');
   if(String(raw?.Value?.PlayerId)!==String(matching[0].PlayerId))throw Error('Popup identity mismatch');
   const parsed=parseComponentHistory(raw,{code:asset.code,type:asset.type,team:asset.type==='DRIVER'?teams[asset.code]:asset.code,season});
   for(const score of required){const row=parsed.find(r=>r.round===score.grandPrix.round);if(score.source!==COMPLETED_SCORE_SOURCE||!row?.qualifying||!row.race||row.qualifying.total+row.race.total+(row.sprint?.total??0)!==score.points)throw Error('Unverified component history: '+asset.code+' R'+score.grandPrix.round);components.push(row)}
  }));
  const news=await getGridPenaltyNews({season,round,eventName:gp.name,deadline:lock.deadline,asOf,drivers:assets.filter(a=>a.type==='DRIVER').map(a=>({code:a.code,name:a.name}))});
  const drops:Record<string,number>={};for(const m of news.mentions)if(m.status==='CONFIRMED'&&m.session==='RACE'&&m.code&&(m.kind==='BACK_OF_GRID'||m.places!=null))drops[m.code]=m.kind==='BACK_OF_GRID'?100:m.places!;
  const normalized=assets.map(a=>({season,code:a.code,type:a.type,currentPrice:a.prices.filter(p=>p.grandPrix.season===season&&p.grandPrix.round===round).sort((a,b)=>+b.recordedAt-+a.recordedAt)[0]?.price.toNumber()??null,prices:a.prices.filter(p=>p.grandPrix.season===season).map(p=>({round:p.grandPrix.round,price:p.price.toNumber()})),scores:a.fantasyScores.map(s=>({round:s.grandPrix.round,points:s.points}))}));
  const result=buildCandidateCapture({season,round,asOf:new Date(),deadline:lock.deadline,sprint:false,assets:normalized,teams,history:components,practice,gridDrops:{race:drops}});
  if(result.rows.length!==assets.length)throw Error('Incomplete forecasts; capture not saved');
  const codeHashes:Record<string,string>={};for(const file of ['src/lib/candidate-capture.ts','src/lib/session-pace.ts','src/lib/race-progress-model.ts','src/lib/production-forecast.ts','src/lib/component-simulation.ts','src/lib/fantasy-scoring.ts'])codeHashes[file]=hash(await readFile(file,'utf8'));
  const payload=JSON.stringify({...result,event:gp.name,sourceHashes,codeHashes,weekendNews:news,captureNote:'Local write-once file with source/code hashes; no external publication or trusted timestamp is asserted.'},null,2);
  if(Date.now()>=+lock.deadline)throw Error('Capture crossed lock; nothing saved');
  const directory=path.resolve('docs/forecast-captures');await mkdir(directory,{recursive:true});const file=path.join(directory,'R'+round+'-'+result.capturedAt.replaceAll(':','-')+'.json');
  await writeFile(file,payload,{flag:'wx'});console.log('Saved '+result.rows.length+' paired forecasts: '+file+'\nSHA256: '+hash(payload));
 }finally{await prisma.$disconnect()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
