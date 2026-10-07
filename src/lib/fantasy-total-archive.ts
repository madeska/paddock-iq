import type {ArchivedRace} from './race-archive';
export type FantasyTotalRow={season:number;round:number;code:string;type:'DRIVER'|'CONSTRUCTOR';team:string;actualPoints:number};
export type TotalArchiveAsset={type:'DRIVER'|'CONSTRUCTOR';raw:unknown};
/** Import reported totals only. Snapshot prices and incomplete breakdowns are deliberately omitted. */
export function normalizeFantasyTotals(assets:TotalArchiveAsset[],races:ArchivedRace[],options:{throughRound:number;teamCodes:Record<string,string>;roundNames:Record<number,string>;allowedMissing?:ReadonlySet<string>}):FantasyTotalRow[]{
 if(!Number.isInteger(options.throughRound)||options.throughRound<1)throw Error('Invalid completed-round cutoff');
 const indexed=new Map<string,Map<number,{name:string;points:number}>>();
 for(const asset of assets){
  const raw=asset.raw as any;if(!raw||typeof raw.abbreviation!=='string'||!Array.isArray(raw.races))throw Error('Invalid archive asset');
  const key=asset.type+':'+raw.abbreviation;if(indexed.has(key))throw Error('Duplicate archive asset');const rows=new Map<number,{name:string;points:number}>();
  for(const row of raw.races){const round=Number(row.round);if(!Number.isInteger(round)||round<1)throw Error('Invalid archive round');if(round>options.throughRound)continue;
   if(rows.has(round))throw Error('Duplicate archive round');if(typeof row.totalPoints!=='number'||!Number.isFinite(row.totalPoints)||!Number.isInteger(row.totalPoints))throw Error('Invalid reported total');
   if(typeof row.raceName!=='string'||row.raceName!==options.roundNames[round])throw Error('Ambiguous event identity');rows.set(round,{name:row.raceName,points:row.totalPoints});
  }indexed.set(key,rows);
 }
 const output:FantasyTotalRow[]=[];const seen=new Set<string>();
 for(const race of races.filter(r=>r.round<=options.throughRound).sort((a,b)=>a.round-b.round)){
  const add=(code:string,type:'DRIVER'|'CONSTRUCTOR',team:string)=>{const key=race.year+':'+race.round+':'+type+':'+code;if(seen.has(key))throw Error('Duplicate roster identity');seen.add(key);
   const row=indexed.get(type+':'+code)?.get(race.round);if(!row){if(options.allowedMissing?.has(key))return;throw Error('Missing active Fantasy label '+key)}output.push({season:race.year,round:race.round,code,type,team,actualPoints:row.points});
  };
  for(const driver of race.drivers){const team=options.teamCodes[driver.team];if(!team)throw Error('Unknown historical team');add(driver.code,'DRIVER',team)}
  for(const team of [...new Set(race.drivers.map(d=>options.teamCodes[d.team]))].sort())add(team,'CONSTRUCTOR',team);
 }
 if(!output.length)throw Error('Empty archive');return output;
}
/** Specific repair for the pinned 2025 scraper's country-name Map collision.
 * Stable sorting preserves chronological occurrences for unmerged assets. Earlier
 * snapshot anchors must match; lossy team-swap groups cannot be reconstructed. */
export function repairFantasy2025CountryRounds(latest:any,older:any):{raw:any;unknownRounds:number[];anchorsChecked:number}{
 if(!latest||!older||latest.abbreviation!==older.abbreviation||!Array.isArray(latest.races)||!Array.isArray(older.races)||!older.races.length)throw Error('Invalid paired snapshots');
 const earliest=Math.min(...older.races.map((r:any)=>Number(r.round)));if(!Number.isInteger(earliest)||earliest<1)throw Error('Invalid first observed round');
 const recovered:any[]=[],unknown=new Set<number>();
 for(const name of new Set<string>(latest.races.map((r:any)=>r.raceName))){
  const group=latest.races.filter((r:any)=>r.raceName===name),slots=(name==='United States'?[6,19,22]:name==='Italy'?[7,16]:[Number(group[0].round)]).filter(r=>r>=earliest);
  if(group.length!==slots.length){if(latest.teamSwap!==true||!['United States','Italy'].includes(name))throw Error('Unexplained country occurrence count');for(const round of slots)unknown.add(round);continue;}
  group.forEach((row:any,i:number)=>recovered.push({...row,round:String(slots[i])}));
 }
 let anchorsChecked=0;
 for(const prior of older.races.filter((r:any)=>Number(r.round)<=14)){
  const round=Number(prior.round),matches=recovered.filter(r=>Number(r.round)===round);
  if(matches.length>1)throw Error('Duplicate recovered event');
  if(matches.length===1){if(matches[0].raceName!==prior.raceName||matches[0].totalPoints!==prior.totalPoints)throw Error('Snapshot anchor mismatch');anchorsChecked++}
  else if(unknown.has(round)){recovered.push({...prior,round:String(round)});unknown.delete(round);anchorsChecked++}
  else throw Error('Missing earlier snapshot anchor');
 }
 recovered.sort((a,b)=>Number(a.round)-Number(b.round));
 return {raw:{...latest,races:recovered},unknownRounds:[...unknown].sort((a,b)=>a-b),anchorsChecked};
}
