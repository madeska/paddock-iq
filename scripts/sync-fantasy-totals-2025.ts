import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import races from '../src/data/race-archive-2025.json';
import manifest from '../src/data/fantasy-source-manifest-2025.json';
import type {ArchivedRace} from '../src/lib/race-archive';
import {normalizeFantasyTotals,repairFantasy2025CountryRounds,type TotalArchiveAsset} from '../src/lib/fantasy-total-archive';
const SHA='1bb0e02d06e1567e01cda53532e031a4086eac2f';
const teamCodes:Record<string,string>={'Alpine':'ALP','Aston Martin':'AMR','Ferrari':'FER','Haas F1 Team':'HAS','Kick Sauber':'SAU','McLaren':'MCL','Mercedes':'MER','Racing Bulls':'RB','Red Bull Racing':'RBR','Williams':'WIL'};
const roundNames:Record<number,string>={1:'Australia',2:'China',3:'Japan',4:'Bahrain',5:'Saudi Arabia',6:'United States',7:'Italy',8:'Monaco',9:'Spain',10:'Canada',11:'Austria',12:'United Kingdom',13:'Belgium',14:'Hungary',15:'Netherlands',16:'Italy',17:'Azerbaijan',18:'Singapore',19:'United States',20:'Mexico',21:'Brazil'};
function verifySource(body:string,sourcePath:string){
 const expected=(manifest.files as Record<string,string>)[sourcePath],actual=createHash('sha1').update('blob '+Buffer.byteLength(body,'utf8')+'\0').update(body).digest('hex');
 if(manifest.sourceCommit!==SHA||!expected||actual!==expected)throw Error('Pinned archive content mismatch: '+sourcePath);
}
async function main(){
 const cache=path.resolve(process.env.FANTASY_2025_CACHE??'../simulation-research/fantasy-2025-public/older');await mkdir(cache,{recursive:true});
 const drivers=[...new Set((races.meetings as ArchivedRace[]).filter(r=>r.round<=14).flatMap(r=>r.drivers.map(d=>d.code)))].sort();
 const assets:TotalArchiveAsset[]=[],provenance=[];
 for(const type of ['DRIVER','CONSTRUCTOR'] as const)for(const code of type==='DRIVER'?drivers:Object.values(teamCodes).sort()){
  const sourcePath='15-Netherlands/'+(type==='DRIVER'?'driver_data':'constructor_data')+'/'+code+'.json';const url='https://raw.githubusercontent.com/JoshCBruce/fantasy-data/'+SHA+'/'+sourcePath;const file=path.join(cache,sourcePath.replaceAll('/','_'));
  let body:string;try{body=await readFile(file,'utf8')}catch(error:any){if(error.code!=='ENOENT')throw error;const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Archive download failed '+response.status);body=await response.text();await writeFile(file,body)}
  verifySource(body,sourcePath);const raw=JSON.parse(body);assets.push({type,raw});provenance.push({type,code,url,sha256:createHash('sha256').update(body).digest('hex'),extractedAt:raw.extractedAt,reportedSeasonTotal:raw.seasonTotalPoints,rowTotal:raw.races.filter((r:any)=>Number(r.round)<=14).reduce((n:number,r:any)=>n+r.totalPoints,0)});
 }
 const observations=normalizeFantasyTotals(assets,races.meetings as ArchivedRace[],{throughRound:14,teamCodes,roundNames});
 if(observations.length!==420||observations.filter(r=>r.type==='DRIVER').length!==280)throw Error('Unexpected archive coverage');
 const data={schemaVersion:1,season:2025,lastCompletedRound:14,sourceRepository:'https://github.com/JoshCBruce/fantasy-data',sourceCommit:SHA,note:'Third-party reported Fantasy totals, not verified official raw feeds. No historical prices or inferred breakdowns. Historical active roster/team from separately validated OpenF1 archive. Country labels are mapped only within audited chronological rounds 1–14; R15 is unplayed in this snapshot. Inactive placeholder rows excluded. Season-total discrepancies for COL/DOO are retained in provenance, not hidden.',provenance,observations};
 if(process.argv.includes('--extended')){
  const extendedAssets:TotalArchiveAsset[]=[],extendedProvenance:any[]=[],allowedMissing=new Set<string>();
  const latestCache=path.resolve(cache,'../latest');await mkdir(latestCache,{recursive:true});
  for(let i=0;i<assets.length;i++){
   const asset=assets[i],older=asset.raw as any,sourcePath='latest/'+(asset.type==='DRIVER'?'driver_data':'constructor_data')+'/'+older.abbreviation+'.json';
   const url='https://raw.githubusercontent.com/JoshCBruce/fantasy-data/'+SHA+'/'+sourcePath,file=path.join(latestCache,sourcePath.replaceAll('/','_'));
   let body:string;try{body=await readFile(file,'utf8')}catch(error:any){if(error.code!=='ENOENT')throw error;const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Archive download failed '+response.status);body=await response.text();await writeFile(file,body)}
   verifySource(body,sourcePath);const raw=JSON.parse(body),captured=Date.parse(raw.extractedAt),lastRace=Date.parse(races.meetings.find(r=>r.round===21)!.dateStart),nextRace=Date.parse(races.meetings.find(r=>r.round===22)!.dateStart);
   if(!Number.isFinite(captured)||captured<lastRace+4*3600000||captured>=nextRace)throw Error('Unexpected extended snapshot chronology');
   const repaired=repairFantasy2025CountryRounds(raw,older);
   for(const round of repaired.unknownRounds.filter(r=>r<=21)){if(asset.type!=='DRIVER'||!['LAW','TSU'].includes(raw.abbreviation)||![16,19].includes(round))throw Error('Unexpected missing event');allowedMissing.add('2025:'+round+':DRIVER:'+raw.abbreviation)}
   extendedAssets.push({type:asset.type,raw:repaired.raw});extendedProvenance.push({type:asset.type,code:raw.abbreviation,url,sha256:createHash('sha256').update(body).digest('hex'),anchorSha256:provenance[i].sha256,extractedAt:raw.extractedAt,anchorsChecked:repaired.anchorsChecked,unknownRounds:repaired.unknownRounds,reportedSeasonTotal:raw.seasonTotalPoints,recoveredRowTotal:repaired.raw.races.filter((r:any)=>Number(r.round)<=21).reduce((n:number,r:any)=>n+r.totalPoints,0)});
  }
  const extended=normalizeFantasyTotals(extendedAssets,races.meetings as ArchivedRace[],{throughRound:21,teamCodes,roundNames,allowedMissing});
  if(extended.length!==626||allowedMissing.size!==4||JSON.stringify(extended.filter(r=>r.round<=14))!==JSON.stringify(observations))throw Error('Unexpected extended coverage or changed earlier labels');
  await writeFile('src/data/fantasy-totals-2025-extended.json',JSON.stringify({schemaVersion:1,season:2025,lastCompletedRound:21,sourceRepository:data.sourceRepository,sourceCommit:SHA,note:'Reported totals only. Country-name collision repaired using stable chronological occurrences documented in pinned scraper and exact earlier snapshot anchors. Lossy team-swap entries for LAW/TSU R16/R19 remain unknown, never zero. Earlier R1–14 exactly match the older normalized snapshot. R22 was unplayed at extraction and excluded. Historical prices/breakdowns are not inferred. R15–21 reserved for an untouched model-error holdout until a new protocol is frozen.',provenance:extendedProvenance,missingLabels:[...allowedMissing].sort(),observations:extended}));
  console.log(JSON.stringify({extendedRows:extended.length,missingLabels:[...allowedMissing].sort(),anchorsChecked:extendedProvenance.reduce((n,r)=>n+r.anchorsChecked,0)}));
 }
 await writeFile('src/data/fantasy-totals-2025.json',JSON.stringify(data));console.log(JSON.stringify({rows:observations.length,drivers:280,constructors:140,seasonTotalDiscrepancies:provenance.filter(r=>r.reportedSeasonTotal!==r.rowTotal).map(r=>({code:r.code,reported:r.reportedSeasonTotal,sum:r.rowTotal}))}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
