import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeTreeResidualModel,applyTreeResidualCorrection} from '../src/lib/tree-residual-inference';
async function main(){
 const path=process.argv[2];if(!path)throw Error('Usage: tsx scripts/check-snapshot-tree-parity.ts SNAPSHOT.json');
 const snapshot=JSON.parse(await readFile(path,'utf8')),model=decodeTreeResidualModel(snapshot.model);
 assert.equal(snapshot.policy,model.policy);
 assert.equal(snapshot.input.season,model.season);assert.equal(snapshot.input.round,model.beforeRound);
 assert.equal(snapshot.predictions.length,snapshot.input.targets.length);
 const seen=new Set<string>();
 for(const frame of snapshot.input.targets){
  const key=frame.type+':'+frame.code;assert.ok(!seen.has(key),'duplicate target');seen.add(key);
  const matches=snapshot.predictions.filter((r:any)=>r.type===frame.type&&r.code===frame.code);assert.equal(matches.length,1,'paired prediction identity');
  assert.equal(matches[0].incumbent,frame.incumbent);
  assert.equal(applyTreeResidualCorrection(model,frame),matches[0].candidate,'portable candidate parity');
 }
 console.log(JSON.stringify({predictions:seen.size,status:'Portable math parity only; source/capture eligibility requires separate audit'}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
