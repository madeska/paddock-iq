import type {OpenF1Session} from './openf1-weekend';
export type PrelockSession={sessionKey:number;sessionName:string;startedAt:string;endedAt:string;kind:'PRACTICE'|'SPRINT_QUALIFYING';positions:{code:string;position:number;bestLapSeconds:number|null}[]};
export type PrelockWeekend={round:number;meetingKey:number;lockTime:string;isSprint:boolean;practice:PrelockSession|null;sprintQualifying:PrelockSession|null};
export function parsePrelockSession(session:OpenF1Session,results:readonly any[],names:readonly any[],options:{year:number;meetingKey:number;lockTime:string;kind:PrelockSession['kind']}):PrelockSession{
 const start=Date.parse(session.date_start),end=Date.parse(session.date_end),lock=Date.parse(options.lockTime),name=(session.session_name??'').toLowerCase();
 if(session.year!==options.year||session.meeting_key!==options.meetingKey||!Number.isInteger(session.session_key)||session.session_key<1||session.is_cancelled||!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(lock)||end<=start||end>=lock)throw Error('Ineligible pre-lock session');
 if(options.kind==='PRACTICE'?!name.startsWith('practice'):name!=='sprint qualifying')throw Error('Session kind mismatch');
 const byNumber=new Map<number,string>(),seenCodes=new Set<string>();
 for(const row of names){
  const code=String(row.name_acronym??'').trim().toUpperCase();
  if(!Number.isInteger(row.driver_number)||row.driver_number<1||!code)continue;
  if(row.session_key!=null&&row.session_key!==session.session_key)throw Error('Driver session identity mismatch');
  if(byNumber.has(row.driver_number)||seenCodes.has(code))throw Error('Ambiguous pre-lock driver identity');byNumber.set(row.driver_number,code);seenCodes.add(code);
 }
 const positions:PrelockSession['positions']=[],seenPositions=new Set<number>(),seenDrivers=new Set<string>();
 for(const row of results){
  if(row.session_key!=null&&row.session_key!==session.session_key)throw Error('Result session identity mismatch');
  const code=byNumber.get(row.driver_number);if(!code||!Number.isInteger(row.position)||row.position<1)continue;
  if(seenPositions.has(row.position)||seenDrivers.has(code))throw Error('Ambiguous pre-lock standing');seenPositions.add(row.position);seenDrivers.add(code);
  const times=(Array.isArray(row.duration)?row.duration:[row.duration]).filter((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0);
  positions.push({code,position:row.position,bestLapSeconds:times.length?Math.min(...times):null});
 }
 if(!positions.length)throw Error('Empty pre-lock standings');positions.sort((a,b)=>a.position-b.position);
 return {sessionKey:session.session_key,sessionName:session.session_name,startedAt:session.date_start,endedAt:session.date_end,kind:options.kind,positions};
}
