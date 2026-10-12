import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseFantasyToolsComponents} from '../src/lib/fantasy-tools-components';
const HASH='8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162';
async function main(){
 const path=process.argv[2];if(!path)throw Error('Pass the pinned 2025 statistics snapshot');const raw=await readFile(path);
 if(createHash('sha256').update(raw).digest('hex')!==HASH)throw Error('Component source snapshot changed');
 const observations=parseFantasyToolsComponents(JSON.parse(raw.toString('utf8')),14),prior=JSON.parse(await readFile('src/data/fantasy-totals-2025.json','utf8'));
 if(observations.length!==420)throw Error('Incomplete component cohort');
 for(const old of prior.observations){const row=observations.find(r=>r.round===old.round&&r.type===old.type&&r.code===old.code);if(!row||row.actualPoints!==old.actualPoints)throw Error('Audited point total mismatch')}
 const sessions=observations.reduce((n,r)=>n+Number(!!r.qualifying)+Number(!!r.race)+Number(!!r.sprint),0);
 const report={schemaVersion:1,season:2025,lastCompletedRound:14,source:'https://f1fantasytools.com/api/statistics/2025',sourceSHA256:HASH,note:'Scored official-site component breakdowns via audited third-party history. NC and DSQ are explicit Fantasy failure labels. No physical failure or stop seconds inferred. R15–21 component labels excluded.',audit:{observations:observations.length,conservedSessions:sessions,verifiedPriorTotals:prior.observations.length},observations};
 await writeFile('src/data/component-history-2025.json',JSON.stringify(report)+'\n');console.log(report.audit);
}
main().catch(e=>{console.error(e);process.exitCode=1});
