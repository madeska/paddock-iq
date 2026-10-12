import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {selectPracticeContext,type OpenF1Session} from '../src/lib/openf1-weekend';
import {parsePrelockSession,type PrelockWeekend,type PrelockSession} from '../src/lib/prelock-session-archive';
const year=2025,maxRound=14,cache=resolve('../simulation-research/openf1-2025'),base='https://api.openf1.org/v1/';
async function main(){
 await mkdir(cache,{recursive:true});let lastRequest=0;const hashes:Record<string,string>={};
 async function cached(name:string,endpoint:string){
  const file=resolve(cache,name+'.json');let raw:Buffer;
  try{raw=await readFile(file)}catch(error:any){if(error.code!=='ENOENT')throw error;let value:any=null;
   for(let attempt=0;attempt<3;attempt++){
    const wait=Math.max(0,2200-(Date.now()-lastRequest));if(wait)await new Promise(r=>setTimeout(r,wait));lastRequest=Date.now();
    const response=await fetch(base+endpoint,{signal:AbortSignal.timeout(30000)});
    if((response.status===429||response.status>=500)&&attempt<2){await new Promise(r=>setTimeout(r,5000*(attempt+1)));continue}
    if(!response.ok)throw Error('Pre-lock archive HTTP '+response.status+' '+endpoint);value=await response.json();break;
   }
   if(!Array.isArray(value)||!value.length)throw Error('Empty pre-lock source '+endpoint);raw=Buffer.from(JSON.stringify(value));await writeFile(file,raw);
  }
  hashes[name]=createHash('sha256').update(raw).digest('hex');return JSON.parse(raw.toString('utf8'));
 }
 const sessions=await cached('all-sessions','sessions?year='+year) as OpenF1Session[];
 const races=(await cached('races','sessions?year='+year+'&session_name=Race')).filter((s:any)=>s.year===year&&!s.is_cancelled).sort((a:any,b:any)=>Date.parse(a.date_start)-Date.parse(b.date_start));
 const calendarRaw=await readFile(resolve('../simulation-research/f1fantasytools-statistics-2025.json'));
 const calendarHash=createHash('sha256').update(calendarRaw).digest('hex');if(calendarHash!=='8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162')throw Error('Pinned calendar snapshot changed');
 const fantasyCalendar=JSON.parse(calendarRaw.toString('utf8')).races,weekends:PrelockWeekend[]=[],excluded:any[]=[];
 for(let i=0;i<Math.min(races.length,maxRound);i++){
  const race=races[i],round=i+1,entry=fantasyCalendar.find((r:any)=>r.roundNumber===round);if(!entry)throw Error('Missing Fantasy lock calendar');
  const isSprint=entry.sprint,lockType=isSprint?'Sprint':'Qualifying',locks=sessions.filter(s=>s.meeting_key===race.meeting_key&&s.year===year&&s.session_name===lockType);
  if(locks.length!==1)throw Error('Ambiguous lock session R'+round);
  const officialLock=Date.parse(isSprint?entry.start_times.sprint:entry.start_times.qualifying),providerLock=Date.parse(locks[0].date_start),lockTime=new Date(Math.min(officialLock,providerLock)).toISOString();
  const context=selectPracticeContext(sessions,year,new Date(lockTime),new Date(lockTime));if(context?.meeting.meetingKey!==race.meeting_key||context.isSprint!==isSprint)throw Error('Meeting/calendar identity mismatch R'+round);
  async function collect(session:OpenF1Session,kind:PrelockSession['kind']){
   const results=await cached('prelock-result-'+session.session_key,'session_result?session_key='+session.session_key),names=await cached('drivers-'+session.session_key,'drivers?session_key='+session.session_key);
   return parsePrelockSession(session,results,names,{year,meetingKey:race.meeting_key,lockTime,kind});
  }
  let practice:PrelockSession|null=null;
  for(const session of context.practices){try{practice=await collect(session,'PRACTICE');break}catch(error){excluded.push({round,sessionKey:session.session_key,reason:String(error)})}}
  let sprintQualifying:PrelockSession|null=null;
  if(isSprint){const qs=sessions.filter(s=>s.meeting_key===race.meeting_key&&s.year===year&&s.session_name==='Sprint Qualifying'&&!s.is_cancelled&&Date.parse(s.date_end)<Date.parse(lockTime));if(qs.length===1)try{sprintQualifying=await collect(qs[0],'SPRINT_QUALIFYING')}catch(error){excluded.push({round,sessionKey:qs[0].session_key,reason:String(error)})}}
  weekends.push({round,meetingKey:race.meeting_key,lockTime,isSprint,practice,sprintQualifying});console.log('R'+round+' '+(practice?.sessionName??'no practice')+' '+(practice?.positions.length??0)+' standings'+(sprintQualifying?' + SQ '+sprintQualifying.positions.length:''));
 }
 const report={schemaVersion:1,season:year,maximumRound:maxRound,source:'https://openf1.org/docs/',calendarSource:'https://f1fantasytools.com/api/statistics/2025',calendarSHA256:calendarHash,note:'Retrospective session-end cutoff, not contemporaneous provider publication timestamps. End must precede both provider and Fantasy calendar lock. R15–21 features and forecast errors not imported by this script.',sourceHashes:hashes,weekends,excluded};
 await writeFile('src/data/prelock-practice-2025.json',JSON.stringify(report,null,2)+'\n');console.log({weekends:weekends.length,practices:weekends.filter(w=>w.practice).length,sprintQualifying:weekends.filter(w=>w.sprintQualifying).length,excluded:excluded.length});
}
main().catch(e=>{console.error(e);process.exitCode=1});
