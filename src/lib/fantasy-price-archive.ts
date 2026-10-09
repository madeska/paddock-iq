export type ArchivedFantasyPrice={round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';team:string;priceBefore:number};
const aliases:Record<string,string>={AST:'AMR',HAA:'HAS',KCK:'SAU',RED:'RBR',VRB:'RB'};
const canonical=(code:string)=>aliases[code]??code;
/** Extract pre-event quotes only; outcome totals and subsequent price changes are not returned. */
export function normalizeFantasyPriceArchive(payload:any):ArchivedFantasyPrice[]{
 if(payload?.seasonResult?.season!==2025)throw Error('Unexpected price archive season');
 const rounds=payload.seasonResult.raceResults,observations:ArchivedFantasyPrice[]=[];
 if(!rounds||Object.keys(rounds).length!==24)throw Error('Expected complete 24-round archive');
 for(let round=1;round<=24;round++){
  const data=rounds[String(round)];if(!data||!Array.isArray(data.drivers)||!Array.isArray(data.constructors))throw Error('Missing price round '+round);
  const drivers=data.drivers.filter((r:any)=>r.isActive===true),constructors=data.constructors;
  if(drivers.length!==20||constructors.length!==10)throw Error('Incomplete active price roster '+round);
  const keys=new Set<string>(),teams=new Map<string,number>();
  for(const [type,rows] of [['DRIVER',drivers],['CONSTRUCTOR',constructors]] as const)for(const row of rows){
   if(typeof row.abbreviation!=='string'||!row.abbreviation.trim()||typeof row.id!=='string'||typeof row.price!=='number'||!Number.isFinite(row.price)||row.price<=0)throw Error('Invalid quote identity or value');
   const code=canonical(row.abbreviation),team=type==='DRIVER'?canonical(row.constructorId):code,key=type+':'+code;
   if(typeof team!=='string'||!team||keys.has(key))throw Error('Duplicate or unknown price identity '+key);keys.add(key);
   if(type==='DRIVER'){if(row.id!==row.constructorId+'_'+row.abbreviation)throw Error('Driver price identity mismatch');teams.set(team,(teams.get(team)??0)+1)}
   else if(canonical(row.id)!==code)throw Error('Constructor price identity mismatch');
   observations.push({round,code,type,team,priceBefore:row.price});
  }
  for(const row of observations.filter(r=>r.round===round&&r.type==='CONSTRUCTOR'))if(teams.get(row.code)!==2)throw Error('Incomplete constructor membership '+row.code);
 }
 return observations;
}
