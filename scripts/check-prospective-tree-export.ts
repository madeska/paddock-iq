import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
function syntheticSource(){
 const identities=[{code:'D0',type:'DRIVER',team:'C0'},{code:'D1',type:'DRIVER',team:'C0'},{code:'C0',type:'CONSTRUCTOR',team:'C0'}];
 return {season:2026,round:18,sourceCapturedAt:new Date().toISOString(),sourceEvidence:[{status:'SYNTHETIC TEST FIXTURE; NOT VALIDATION EVIDENCE'}],scores:Array.from({length:17},(_,i)=>identities.map((r,j)=>({season:2026,round:i+1,code:r.code,type:r.type,actualPoints:10+j*3+(i%3)}))).flat(),quotes:Array.from({length:18},(_,i)=>identities.map(r=>({...r,round:i+1,priceBefore:10}))).flat(),contexts:Array.from({length:17},(_,i)=>({round:i+2,sprint:false,lockAt:i===16?new Date(Date.now()+3600000).toISOString():new Date(Date.UTC(2026,0,10+i*7)).toISOString(),practice:null}))};
}
function run(source:ReturnType<typeof syntheticSource>,action:(result:ReturnType<typeof spawnSync>,output:string,input:string)=>void){
 const directory=mkdtempSync(join(tmpdir(),'paddock-tree-export-'));
 try{const input=join(directory,'source.json'),output=join(directory,'frames.json');writeFileSync(input,JSON.stringify(source));const result=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),'scripts/export-prospective-tree-frames.ts',input,output],{encoding:'utf8'});action(result,output,input)}finally{rmSync(directory,{recursive:true,force:true})}
}
test('prospective CLI generates earlier labeled training and label-free targets from normalized sources',()=>run(syntheticSource(),(result,output)=>{
 assert.equal(result.status,0,result.stderr);const saved=JSON.parse(readFileSync(output,'utf8'));
 assert.equal(saved.targets.length,3);assert.ok(saved.training.length>0);
 assert.ok(saved.training.every((r:any)=>r.round<18&&Number.isFinite(r.actual)));
 assert.ok(saved.targets.every((r:any)=>r.round===18&&!Object.hasOwn(r,'actual')));
 assert.equal(saved.missingTargets.length,0);assert.equal(saved.sourceSHA256.length,64);
}));
test('prospective CLI rejects target outcome contamination before creating output',()=>{
 const source=syntheticSource();source.scores.push({...source.scores[0],round:18});run(source,(result,output)=>{assert.notEqual(result.status,0);assert.match(result.stderr,/target\/future scores/);assert.equal(existsSync(output),false)})
});
