type OpenF1Session={
  meeting_key:number;
  session_key:number;
  session_name:string;
  session_type:string;
  date_start:string;
  date_end:string;
};
type OpenF1Driver={driver_number:number;name_acronym:string};
type OpenF1Result={driver_number:number;position:number};

export type PracticeSnapshot={
  meetingKey:number;
  sessionKey:number;
  sessionName:string;
  isSprint:boolean;
  positions:Map<string,number>;
};

const OPEN='https://api.openf1.org/v1';

async function tryJson<T>(url:string):Promise<T|null>{
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'user-agent':'Paddock-IQ'}});
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

export async function getPracticeSnapshot(season:number,deadline:Date|null):Promise<PracticeSnapshot|null>{
  if(!deadline)return null;
  const sessions=await tryJson<OpenF1Session[]>(OPEN+'/sessions?year='+season);
  if(!sessions?.length)return null;

  const deadlineMs=+deadline;
  const groups=new Map<number,OpenF1Session[]>();
  for(const session of sessions){
    const list=groups.get(session.meeting_key)??[];
    list.push(session);
    groups.set(session.meeting_key,list);
  }

  const candidates=[...groups.entries()].map(([meetingKey,list])=>{
    const nearest=Math.min(...list.map(s=>Math.abs(+new Date(s.date_start)-deadlineMs)));
    return {meetingKey,list,nearest};
  }).filter(x=>x.nearest<=5*24*60*60*1000).sort((a,b)=>a.nearest-b.nearest);

  const meeting=candidates[0];
  if(!meeting)return null;

  const isSprint=meeting.list.some(s=>{
    const n=(s.session_name||'').toLowerCase(),t=(s.session_type||'').toLowerCase();
    return n.includes('sprint')||t.includes('sprint');
  });

  // Sprint-weekend data is deliberately not applied in v1: backtest showed no MAE gain,
  // even though Sprint Qualifying is available before team lock.
  if(isSprint)return {
    meetingKey:meeting.meetingKey,sessionKey:0,sessionName:'Sprint weekend',isSprint:true,positions:new Map()
  };

  const practices=meeting.list
    .filter(s=>{
      const n=(s.session_name||'').toLowerCase(),t=(s.session_type||'').toLowerCase();
      return (n.startsWith('practice')||t==='practice') && +new Date(s.date_start)<deadlineMs;
    })
    .sort((a,b)=>+new Date(b.date_start)-+new Date(a.date_start));

  if(!practices.length)return null;

  let chosen:OpenF1Session|null=null;
  let results:OpenF1Result[]|null=null;
  for(const practice of practices){
    const r=await tryJson<OpenF1Result[]>(OPEN+'/session_result?session_key='+practice.session_key);
    if(r?.length){chosen=practice;results=r;break;}
  }
  if(!chosen||!results)return null;

  let drivers=await tryJson<OpenF1Driver[]>(OPEN+'/drivers?meeting_key='+meeting.meetingKey);
  if(!drivers?.length)drivers=await tryJson<OpenF1Driver[]>(OPEN+'/drivers?session_key='+chosen.session_key);
  if(!drivers?.length)return null;

  const codeByNumber=new Map(drivers.map(d=>[d.driver_number,String(d.name_acronym||'').toUpperCase()]));
  const positions=new Map<string,number>();
  for(const result of results){
    const code=codeByNumber.get(result.driver_number);
    if(code&&Number.isFinite(result.position))positions.set(code,result.position);
  }
  if(!positions.size)return null;

  return {
    meetingKey:meeting.meetingKey,
    sessionKey:chosen.session_key,
    sessionName:chosen.session_name,
    isSprint:false,
    positions
  };
}

export function applyPracticePositionModifier(baseXPts:number,position:number|null|undefined){
  if(position==null||!Number.isFinite(position))return baseXPts;
  return baseXPts + .5*(11.5-position);
}
