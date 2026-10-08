import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import history from '../src/data/component-history-2026.json';
import audit from '../docs/official-price-field-2026-audit.json';
import {buildTreeForecastFrames} from './tree-forecast-frames';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const canon=(code:string)=>({AMR:'AST',HAA:'HAS',RBS:'RB',VRB:'RB',RED:'RBR'} as Record<string,string>)[code]??code;
const metric=(errors:number[])=>({n:errors.length,MAE:errors.reduce((n,e)=>n+Math.abs(e),0)/errors.length,RMSE:Math.sqrt(errors.reduce((n,e)=>n+e*e,0)/errors.length)});
async function main(){
 const raw=await readFile('../simulation-research/f1fantasytools-statistics-2026-prospective-audit.json');assert.equal(createHash('sha256').update(raw).digest('hex'),audit.archiveSHA256);const calendar=JSON.parse(raw.toString()).races;
 const old:ArchivedFantasyPrice[]=[];
 for(const source of audit.sourceHashes){const bytes=await readFile('../simulation-research/round-'+source.round+'.json');assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);for(const row of JSON.parse(bytes.toString()).Data.Value.filter((r:any)=>String(r.IsActive)==='1')){const matched=history.observations.find(h=>h.round===source.round&&h.code===canon(row.DriverTLA)&&h.type===row.PositionName);assert.ok(matched);old.push({round:source.round,code:matched.code,type:matched.type as 'DRIVER'|'CONSTRUCTOR',team:matched.team,priceBefore:Number(row.OldPlayerValue)})}}
 const corrected:ArchivedFantasyPrice[]=history.observations.map(r=>({round:r.round,code:r.code,type:r.type as 'DRIVER'|'CONSTRUCTOR',team:r.team,priceBefore:r.priceBefore}));
 const scores=history.observations.map(r=>({...r,type:r.type as 'DRIVER'|'CONSTRUCTOR'}));const outcomes:any[]=[];
 for(let round=6;round<=16;round++){
  const sprint=calendar.find((r:any)=>r.roundNumber===round)?.sprint;assert.equal(typeof sprint,'boolean');
  const base=buildTreeForecastFrames(scores,old,{season:2026,round,sprint,practice:null}),next=buildTreeForecastFrames(scores,corrected,{season:2026,round,sprint,practice:null});
  assert.deepEqual(base.map(r=>[r.type,r.code]),next.map(r=>[r.type,r.code]));
  for(const [i,row] of base.entries()){const actual=history.observations.find(r=>r.round===round&&r.code===row.code&&r.type===row.type)!.actualPoints;outcomes.push({round,code:row.code,type:row.type,oldError:row.incumbent-actual,correctedError:next[i].incumbent-actual})}
 }
 const summary=['DRIVER','CONSTRUCTOR','ALL'].map(type=>{const rows=outcomes.filter(r=>type==='ALL'||r.type===type);return {type,staleOldField:metric(rows.map(r=>r.oldError)),correctValueField:metric(rows.map(r=>r.correctedError))}});
 const report={note:'Consumed2026R6–16 field-effect diagnostic only. Same active cohort, scores, fixed shared production math, simulations and seeds. No practice modifier on either side. Not a replay of persisted forecasts or independent model validation. Correct field is determined by source audit, not selected by lower error.',summary,sourceAudit:'official-price-field-2026-audit.json',activation:false};await writeFile('docs/official-price-field-2026-effect.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
