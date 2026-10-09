import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {planOfficialHistoryRepair,OFFICIAL_SCORE_SOURCE} from '../src/lib/official-history-reconciliation';
const cache=process.argv[2];if(!cache)throw Error('Pass the cached official source directory');
async function main(){
 const manifest:Record<string,string>={};
 async function read(name:string){const raw=await readFile(resolve(cache,name));manifest[name]=createHash('sha256').update(raw).digest('hex');return JSON.parse(raw.toString('utf8'))}
 const popups:Record<string,unknown>={};for(const id of ['11032','114','116'])popups[id]=await read('player-'+id+'.json');
 const cases=[];
 for(const round of [12,13,14]){
  const data=await read('round-'+round+'.json'),rows=data.Data.Value;
  for(const code of ['HAD','LAW']){
   const stored={id:code+'-'+round,code,round,points:0,source:OFFICIAL_SCORE_SOURCE};
   cases.push({code,round,assumedLegacyPoints:0,...planOfficialHistoryRepair(stored,rows,popups,17)});
  }
 }
 const report={scope:'Source replay of hypothetical legacy generated zeros; not a database audit or forecast accuracy measurement.',season:2026,cutoffRound:17,sourceHashes:manifest,cases};
 await writeFile('docs/official-history-source-evidence.json',JSON.stringify(report,null,2)+'\n');console.table(cases);
}
main().catch(e=>{console.error(e);process.exitCode=1});
