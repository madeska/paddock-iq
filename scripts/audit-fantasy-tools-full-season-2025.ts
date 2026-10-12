import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseFantasyToolsComponents} from '../src/lib/fantasy-tools-components';
async function main(){
 const raw=await readFile('../simulation-research/f1fantasytools-statistics-2025.json');const hash=createHash('sha256').update(raw).digest('hex');if(hash!=='8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162')throw Error('Pinned source changed');
 const rows=parseFantasyToolsComponents(JSON.parse(raw.toString()),24),prior=JSON.parse(await readFile('src/data/fantasy-totals-2025-extended.json','utf8'));
 const mismatches=prior.observations.flatMap((old:any)=>{const row=rows.find(r=>r.round===old.round&&r.code===old.code&&r.type===old.type);return !row||row.actualPoints!==old.actualPoints?[{round:old.round,code:old.code,type:old.type,prior:old.actualPoints,current:row?.actualPoints}]:[]});
 const recovered=rows.filter(r=>r.round<=21&&!prior.observations.some((o:any)=>o.round===r.round&&o.code===r.code&&o.type===r.type));
 const report={sourceSHA256:hash,totalRows:rows.length,priorRows:prior.observations.length,mismatches,recovered:recovered.map(r=>({round:r.round,code:r.code,type:r.type,actualPoints:r.actualPoints})),remainingRounds:rows.filter(r=>r.round>=22).length,note:'Source conservation audit only; no new forecast errors or parameter tuning.'};
 await writeFile('docs/fantasy-tools-full-season-audit-2025.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 if(mismatches.length)throw Error('Disputed total labels; inspect before extending validation');
}
main().catch(e=>{console.error(e);process.exitCode=1});
