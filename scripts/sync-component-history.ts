import {officialHistoricalFantasyPrice} from '../src/lib/official-historical-price';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {parseComponentHistory} from '../src/lib/component-calibration';
async function main(){
 const cache=path.resolve(process.env.COMPONENT_HISTORY_CACHE||'../simulation-research');
 const before=Number(process.env.COMPONENT_HISTORY_BEFORE_ROUND||17),season=2026;
 if(!Number.isInteger(before)||before<2||before>25)throw Error('Invalid before-round cutoff');
 await mkdir(cache,{recursive:true});
 async function cached(name:string,url:string){
  const file=path.join(cache,name);
  try{return JSON.parse(await readFile(file,'utf8'))}catch(error:any){if(error.code!=='ENOENT')throw error}
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Feed download failed: '+response.status+' '+url);
  const body=await response.json();await writeFile(file,JSON.stringify(body));return body;
 }
 const aliases:Record<string,string>={HAA:'HAS',RBS:'RB'};
 const observations:any[]=[];const excluded:any[]=[];const seen=new Set<string>();
 for(let round=1;round<before;round++){
  const feed=await cached('round-'+round+'.json','https://fantasy.formula1.com/feeds/drivers/'+round+'_en.json');
  const rows=feed.Data.Value;const teamCodes=new Map(rows.filter((r:any)=>r.PositionName==='CONSTRUCTOR').map((r:any)=>[String(r.PlayerId),aliases[r.DriverTLA]??r.DriverTLA]));
  for(const r of rows){
   if(String(r.IsActive)!=='1')continue;const type=r.PositionName;if(type!=='DRIVER'&&type!=='CONSTRUCTOR')continue;
   const code=type==='DRIVER'?r.DriverTLA:aliases[r.DriverTLA]??r.DriverTLA;const key=type+':'+code+':'+round;if(seen.has(key))throw Error('Duplicate active asset '+key);seen.add(key);
   const raw=await cached('player-'+r.PlayerId+'.json','https://fantasy.formula1.com/feeds/popup/playerstats_'+r.PlayerId+'.json');
   const parsed=parseComponentHistory(raw,{code,type,team:type==='DRIVER'?String(teamCodes.get(String(r.TeamId))??''):code,season}).find(o=>o.round===round);
   const actual=Number(r.GamedayPoints),priceBefore=officialHistoricalFantasyPrice(r);
   if(!parsed?.race||!parsed.qualifying||!Number.isFinite(actual)||!Number.isFinite(priceBefore)){excluded.push({round,code,type,reason:'Incomplete breakdown'});continue}
   const reconstructed=parsed.qualifying.total+parsed.race.total+(parsed.sprint?.total??0);
   if(Math.abs(reconstructed-actual)>1e-6){excluded.push({round,code,type,reason:'Total mismatch',reconstructed,actual});continue}
   observations.push({...parsed,actualPoints:actual,priceBefore});
  }
 }
 const data={schemaVersion:1,season,quoteField:'Value',quoteNote:'OldPlayerValue is preceding snapshot quote; pre-lock source timing still requires audit',capturedAt:new Date().toISOString(),lastCompletedRound:before-1,source:'https://fantasy.formula1.com/feeds/popup/playerstats_{PlayerId}.json',observations,excluded};
 await mkdir('src/data',{recursive:true});await writeFile('src/data/component-history-2026.json',JSON.stringify(data));
 console.log(JSON.stringify({observations:observations.length,drivers:observations.filter(o=>o.type==='DRIVER').length,constructors:observations.filter(o=>o.type==='CONSTRUCTOR').length,excluded},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
