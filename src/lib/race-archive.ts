export type ArchiveDriver={code:string;number:number;team:string;grid:number|null;pitLane:boolean;finish:number|null;resultKnown:boolean;dnf:boolean|null;dns:boolean|null;dsq:boolean|null;qualifyingPosition:number|null;qualifyingDsq:boolean|null;qualifyingDns:boolean|null};
export type ArchivedRace={year:number;round:number;sessionKey:number;qualifyingSessionKey:number;meetingKey:number;dateStart:string;circuit:string;drivers:ArchiveDriver[]};
const integer=(value:unknown,label:string)=>{if(typeof value!=='number'||!Number.isInteger(value)||value<1)throw Error('Invalid '+label);return value};
function position(value:unknown){if(value===null||value===undefined||value===0||['NC','DQ','DSQ','DNF','DNS','PL','PIT LANE'].includes(String(value).toUpperCase()))return null;return integer(value,'position')}
function rows(value:unknown){if(!Array.isArray(value)||!value.length)throw Error('Missing archive records');return value as any[]}
function indexed(value:unknown,sessionKey:number){const result=new Map<number,any>();for(const row of rows(value)){const number=integer(row.driver_number,'driver number');if(result.has(number))throw Error('Duplicate driver');if(row.session_key!==undefined&&row.session_key!==sessionKey)throw Error('Mixed sessions');result.set(number,row)}return result}
function flags(row:any){for(const key of ['dnf','dns','dsq'])if(typeof row[key]!=='boolean')throw Error('Missing '+key+' flag')}
/** Preserve missing rows and provider flags; never infer Fantasy classification labels. */
export function parseRaceArchive(input:{race:any;qualifying:any;names:unknown;qualifyingNames?:unknown;grid:unknown;finish:unknown;qualifyingResult:unknown},round:number):ArchivedRace{
 const {race,qualifying}=input;integer(round,'round');integer(race.year,'year');const sessionKey=integer(race.session_key,'race session'),qualifyingSessionKey=integer(qualifying.session_key,'qualifying session');
 const date=Date.parse(race.date_start),qDate=Date.parse(qualifying.date_start);
 if(!Number.isFinite(date)||!Number.isFinite(qDate)||qDate>=date||race.year!==qualifying.year||race.meeting_key!==qualifying.meeting_key)throw Error('Invalid paired sessions');
 const names=indexed(input.names,sessionKey),qualifyingNames=input.qualifyingNames?indexed(input.qualifyingNames,qualifyingSessionKey):new Map<number,any>();
 const grid=indexed(input.grid,qualifyingSessionKey),finish=indexed(input.finish,sessionKey),q=indexed(input.qualifyingResult,qualifyingSessionKey);const codes=new Set<string>();const grids=new Set<number>(),finishes=new Set<number>();
 const drivers:ArchiveDriver[]=[];
 const roster=[...new Set([...finish.keys(),...grid.keys(),...names.keys()])];
 for(const number of roster){
  const r=finish.get(number);if(r)flags(r);const name=names.get(number)??qualifyingNames.get(number),qual=q.get(number);if(!name)throw Error('Missing driver identity');if(qual)flags(qual);
  const alternative=qualifyingNames.get(number);if(names.has(number)&&alternative&&alternative.name_acronym!==name.name_acronym)throw Error('Conflicting driver identity');
  const code=name.name_acronym;if(typeof code!=='string'||!/^\w{3}$/.test(code)||codes.has(code))throw Error('Invalid or duplicate driver code');codes.add(code);
  const g=grid.get(number),start=g?position(g.position):null,end=r?position(r.position):null;
  if(start!==null){if(grids.has(start))throw Error('Duplicate grid position');grids.add(start)}
  if(end!==null){if(finishes.has(end))throw Error('Duplicate finish position');finishes.add(end)}else if(r&&!r.dnf&&!r.dns&&!r.dsq)throw Error('Missing successful finish');
  drivers.push({code,number,team:typeof name.team_name==='string'?name.team_name:'',grid:start,pitLane:!!g&&['PL','PIT LANE'].includes(String(g.position).toUpperCase()),finish:end,resultKnown:!!r,dnf:r?r.dnf:null,dns:r?r.dns:null,dsq:r?r.dsq:null,qualifyingPosition:qual?position(qual.position):null,qualifyingDsq:qual?qual.dsq:null,qualifyingDns:qual?qual.dns:null});
 }
 return {year:race.year,round,sessionKey,qualifyingSessionKey,meetingKey:integer(race.meeting_key,'meeting'),dateStart:race.date_start,circuit:String(race.circuit_short_name??''),drivers};
}
