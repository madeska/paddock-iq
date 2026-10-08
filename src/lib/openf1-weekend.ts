export type OpenF1Session={
  year:number;
  is_cancelled?:boolean;
  meeting_key:number;
  session_key:number;
  session_name:string;
  session_type:string;
  date_start:string;
  date_end:string;
};
type OpenF1Driver={driver_number:number;name_acronym:string;session_key?:number};
type OpenF1Result={driver_number:number;position:number;session_key?:number};

export type PracticeSnapshot={
  meetingKey:number;
  sessionKey:number;
  sessionName:string;
  isSprint:boolean;
  positions:Map<string,number>;
  sprintQualifyingPositions?:Map<string,number>;
  sprintQualifyingSessionKey?:number;
};

const OPEN='https://api.openf1.org/v1';

async function tryJson<T>(url:string):Promise<T|null>{
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'user-agent':'Paddock-IQ'},signal:AbortSignal.timeout(10000)});
      if(response.ok)return response.json() as Promise<T>;
      if(response.status===404)return null;
      if(response.status===429||response.status>=500){
        await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
        continue;
      }
      return null;
    }catch{
      if(attempt===2)return null;
      await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
    }
  }
  return null;
}

/** Result tables are eligible only after their session ends and before forecast time and lock. */
export function selectPracticeContext(sessions:readonly OpenF1Session[],season:number,deadline:Date,asOf:Date){
  const deadlineMs=+deadline,cutoff=Math.min(deadlineMs,+asOf);
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(cutoff))return null;
  const groups=new Map<number,OpenF1Session[]>();
  for(const session of sessions){
    if(session.year!==season||!Number.isInteger(session.meeting_key)||session.meeting_key<1||!Number.isInteger(session.session_key)||session.session_key<1||!Number.isFinite(Date.parse(session.date_start)))continue;
    const list=groups.get(session.meeting_key)??[];list.push(session);groups.set(session.meeting_key,list);
  }
  const candidates=[...groups.entries()].map(([meetingKey,list])=>({meetingKey,list,nearest:Math.min(...list.map(s=>Math.abs(Date.parse(s.date_start)-deadlineMs)))})).filter(m=>m.nearest<=5*24*60*60*1000).sort((a,b)=>a.nearest-b.nearest);
  const meeting=candidates[0];if(!meeting||candidates[1]?.nearest===meeting.nearest)return null;
  const isSprint=meeting.list.some(s=>(s.session_name||'').toLowerCase().includes('sprint')||(s.session_type||'').toLowerCase().includes('sprint'));
  const practices=meeting.list.filter(s=>{
    const name=(s.session_name||'').toLowerCase(),type=(s.session_type||'').toLowerCase(),start=Date.parse(s.date_start),end=Date.parse(s.date_end);
    return !s.is_cancelled&&(name.startsWith('practice')||type==='practice')&&Number.isFinite(end)&&end>start&&end<cutoff;
  }).sort((a,b)=>Date.parse(b.date_start)-Date.parse(a.date_start));
  return {meeting,isSprint,practices};
}

export async function getPracticeSnapshot(season:number,deadline:Date|null,asOf=new Date()):Promise<PracticeSnapshot|null>{
  if(!deadline)return null;
  const sessions=await tryJson<OpenF1Session[]>(OPEN+'/sessions?year='+season);
  if(!sessions?.length)return null;

  const context=selectPracticeContext(sessions,season,deadline,asOf);
  if(!context)return null;
  const {meeting,isSprint,practices}=context;

  const cutoff=Math.min(+deadline,+asOf);
  const sprintQualifying=isSprint?meeting.list.filter(s=>!s.is_cancelled&&s.session_name.toLowerCase()==='sprint qualifying'&&Number.isFinite(Date.parse(s.date_end))&&Date.parse(s.date_end)>Date.parse(s.date_start)&&Date.parse(s.date_end)<cutoff).sort((a,b)=>Date.parse(b.date_start)-Date.parse(a.date_start)):[];
  async function load(list:OpenF1Session[]){
    for(const session of list){
      const results=await tryJson<OpenF1Result[]>(OPEN+'/session_result?session_key='+session.session_key);
      if(!results?.length)continue;
      const drivers=await tryJson<OpenF1Driver[]>(OPEN+'/drivers?session_key='+session.session_key);
      if(!drivers?.length)continue;
      const byNumber=new Map<number,string>(),codes=new Set<string>();
      let invalid=false;
      for(const driver of drivers){if(driver.session_key!=null&&driver.session_key!==session.session_key){invalid=true;break}const code=String(driver.name_acronym||'').trim().toUpperCase();if(!code||!Number.isInteger(driver.driver_number)||driver.driver_number<1)continue;if(byNumber.has(driver.driver_number)||codes.has(code)){invalid=true;break}byNumber.set(driver.driver_number,code);codes.add(code)}
      if(invalid)continue;
      const positions=new Map<string,number>(),seen=new Set<number>();
      for(const result of results){if(result.session_key!=null&&result.session_key!==session.session_key){invalid=true;break}const code=byNumber.get(result.driver_number);if(!code||!Number.isInteger(result.position)||result.position<1||result.position>byNumber.size)continue;if(positions.has(code)||seen.has(result.position)){invalid=true;break}positions.set(code,result.position);seen.add(result.position)}
      if(!invalid&&positions.size)return {session,positions};
    }
    return null;
  }
  const practice=await load(isSprint?practices.filter(s=>s.session_name.toLowerCase()==='practice 1'):practices);
  const sq=await load(sprintQualifying);
  if(!practice&&!sq)return null;
  const chosen=practice??sq!;
  return {meetingKey:meeting.meetingKey,sessionKey:chosen.session.session_key,sessionName:practice?.session.session_name??'No completed practice',isSprint,positions:practice?.positions??new Map(),sprintQualifyingPositions:sq?.positions,sprintQualifyingSessionKey:sq?.session.session_key};
}

export function applyPracticePositionModifier(baseXPts:number,position:number|null|undefined){
  if(position==null||!Number.isFinite(position))return baseXPts;
  return baseXPts + .5*(11.5-position);
}

/** Calendar identifies Fantasy round; OpenF1 verifies meeting and scored-session lock. Never guesses by ordinal race index. */
export async function getWeekendLock(season:number,round:number,eventName:string,storedDeadline:Date|null){
 const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+(?:grand prix|gp)\b.*$/,'').trim();
 const calendar=await tryJson<{races:{roundNumber:number;name:string;sprint:boolean;start_times:{race:string;sprint?:string;qualifying?:string}}[]}>('https://f1fantasytools.com/api/statistics/'+season);
 const candidates=calendar?.races?.filter(r=>r.roundNumber===round&&normalize(r.name)===normalize(eventName));
 if(candidates?.length!==1)return storedDeadline&&Number.isFinite(+storedDeadline)?{deadline:storedDeadline,isSprint:null,source:'Stored Fantasy deadline'}:null;
 const entry=candidates[0],raceAt=Date.parse(entry.start_times?.race),calendarLock=Date.parse(entry.sprint?entry.start_times?.sprint??'':entry.start_times?.qualifying??'');
 if(!Number.isFinite(raceAt)||!Number.isFinite(calendarLock)||calendarLock>=raceAt)return null;
 const sessions=await tryJson<OpenF1Session[]>(OPEN+'/sessions?year='+season);
 const races=sessions?.filter(s=>s.year===season&&!s.is_cancelled&&s.session_name==='Race'&&Math.abs(Date.parse(s.date_start)-raceAt)<12*3600000);
 if(races?.length!==1)return null;
 const locks=sessions!.filter(s=>s.year===season&&s.meeting_key===races[0].meeting_key&&!s.is_cancelled&&s.session_name===(entry.sprint?'Sprint':'Qualifying'));
 if(locks.length!==1||!Number.isFinite(Date.parse(locks[0].date_start))||Math.abs(Date.parse(locks[0].date_start)-calendarLock)>12*3600000)return null;
 const deadline=new Date(Math.min(calendarLock,Date.parse(locks[0].date_start),storedDeadline&&Number.isFinite(+storedDeadline)?+storedDeadline:Infinity));
 return {deadline,isSprint:entry.sprint,source:'Fantasy Tools calendar + OpenF1 session start; earliest cutoff'};
}
