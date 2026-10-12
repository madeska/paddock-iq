import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {parseRaceArchive,type ArchivedRace} from '../src/lib/race-archive';
const year=2025,base='https://api.openf1.org/v1/';
async function main(){
 const cache=path.resolve('../simulation-research/openf1-'+year);await mkdir(cache,{recursive:true});let lastRequest=0;
 async function cached(name:string,endpoint:string){
  if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid archive cache key');
  const file=path.join(cache,name+'.json');try{return JSON.parse(await readFile(file,'utf8'))}catch(error:any){if(error.code!=='ENOENT')throw error}
  for(let attempt=0;attempt<3;attempt++){
   const wait=Math.max(0,2200-(Date.now()-lastRequest));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastRequest=Date.now();
   const response=await fetch(base+endpoint,{signal:AbortSignal.timeout(30000)});
   if((response.status===429||response.status>=500)&&attempt<2){await new Promise(resolve=>setTimeout(resolve,5000*(attempt+1)));continue}
   if(!response.ok)throw Error('Archive HTTP '+response.status+' '+endpoint);
   const value=await response.json();if(!Array.isArray(value)||!value.length)throw Error('Empty archive '+endpoint);await writeFile(file,JSON.stringify(value));return value;
  }
  throw Error('Archive retries exhausted');
 }
 const races=(await cached('races','sessions?year='+year+'&session_name=Race')).filter((s:any)=>s.year===year&&s.is_cancelled!==true).sort((a:any,b:any)=>Date.parse(a.date_start)-Date.parse(b.date_start));
 const qualifying=await cached('qualifying','sessions?year='+year+'&session_name=Qualifying');const meetings:ArchivedRace[]=[],excluded:any[]=[];
 for(let i=0;i<races.length;i++){
  const race=races[i];try{
   if(!Number.isInteger(race.session_key)||race.session_key<1||!Number.isInteger(race.meeting_key)||race.meeting_key<1)throw Error('Invalid race identity');
   const qs=qualifying.filter((q:any)=>q.year===year&&q.meeting_key===race.meeting_key&&Date.parse(q.date_start)<Date.parse(race.date_start));if(qs.length!==1)throw Error('Ambiguous qualifying pair');const q=qs[0];if(!Number.isInteger(q.session_key)||q.session_key<1)throw Error('Invalid qualifying identity');
   const finish=await cached('result-'+race.session_key,'session_result?session_key='+race.session_key);
   const grid=await cached('grid-'+q.session_key,'starting_grid?session_key='+q.session_key);
   const names=await cached('drivers-'+race.session_key,'drivers?session_key='+race.session_key);
   const qualifyingResult=await cached('qualifying-result-'+q.session_key,'session_result?session_key='+q.session_key);
   const qualifyingNames=names.length<20?await cached('drivers-'+q.session_key,'drivers?session_key='+q.session_key):undefined;
   const row=parseRaceArchive({race,qualifying:q,finish,grid,names,qualifyingNames,qualifyingResult},i+1);if(row.drivers.length!==20)throw Error('Incomplete 20-car race field: '+row.drivers.length);meetings.push(row);
   console.log('R'+(i+1)+' '+row.circuit+': '+row.drivers.length+' drivers, '+row.drivers.filter(d=>d.grid!==null).length+' known grid places');
  }catch(error){const reason=error instanceof Error?error.message:String(error);excluded.push({round:i+1,sessionKey:race.session_key,reason});console.error('Excluded R'+(i+1)+': '+reason)}
 }
 if(!meetings.length)throw Error('No valid archived races');
 const snapshot={schemaVersion:1,year,capturedAt:new Date().toISOString(),source:'https://openf1.org/docs/',note:'Race positions and provider flags only. No Fantasy scores or overtake labels are inferred.',expectedRaces:races.length,meetings,excluded};await writeFile('src/data/race-archive-'+year+'.json',JSON.stringify(snapshot));
 console.log(JSON.stringify({expected:races.length,included:meetings.length,drivers:meetings.reduce((n,r)=>n+r.drivers.length,0),unknownResults:meetings.flatMap(r=>r.drivers).filter(d=>!d.resultKnown).length,unknownQualifying:meetings.flatMap(r=>r.drivers).filter(d=>d.qualifyingDns===null).length,excluded},null,2));if(excluded.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
