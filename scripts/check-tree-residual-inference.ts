import assert from 'node:assert/strict';
import {test} from 'node:test';
import parity from './fixtures/tree-inference-parity.json';
import {decodeTreeResidualModel,predictTreeResidual,applyTreeResidualCorrection} from '../src/lib/tree-residual-inference';
const model=()=>({schemaVersion:1,policy:'driver-only-tree-half-v1',scikitLearn:'1.7.2',featureCount:10,season:2025,beforeRound:6,baseValue:2,trees:[[{leaf:false,feature:0,threshold:1,left:1,right:2},{leaf:true,value:-3},{leaf:true,value:4}],...Array.from({length:59},()=>[{leaf:true,value:0}])]});
test('numeric inference routes threshold equality left and sums residual leaves',()=>{
 const m=decodeTreeResidualModel(model());assert.equal(predictTreeResidual(m,[1,...Array(9).fill(0)],{season:2025,round:6}),-1);assert.equal(predictTreeResidual(m,[1.01,...Array(9).fill(0)],{season:2025,round:6}),6);
});
test('future fit or different season and nonfinite features are rejected',()=>{
 const m=decodeTreeResidualModel(model());assert.throws(()=>predictTreeResidual(m,Array(10).fill(0),{season:2025,round:5}),/identity/);assert.throws(()=>predictTreeResidual(m,Array(10).fill(0),{season:2026,round:6}),/identity/);assert.throws(()=>predictTreeResidual(m,[NaN,...Array(9).fill(0)],{season:2025,round:6}),/features/);
});
test('malformed trees fail decoding instead of cycling or accessing absent children',()=>{
 const cycle=model();cycle.trees[0][0].left=0;assert.throws(()=>decodeTreeResidualModel(cycle),/tree/);
 const missing=model();missing.trees[0][0].right=99;assert.throws(()=>decodeTreeResidualModel(missing),/tree/);
 const infinity=model();infinity.baseValue=Infinity;assert.throws(()=>decodeTreeResidualModel(infinity),/model/);
});

for(const fixture of parity.cases)test('sklearn portable inference parity R'+fixture.model.beforeRound,()=>{
 const decoded=decodeTreeResidualModel(fixture.model);
 for(const row of fixture.inputs){
  const residual=predictTreeResidual(decoded,row.features,{season:fixture.model.season,round:fixture.model.beforeRound});
  assert.ok(Math.abs(residual-row.residual)<1e-10,'residual parity '+row.kind);
  assert.equal(applyTreeResidualCorrection(decoded,{season:fixture.model.season,round:fixture.model.beforeRound,type:'DRIVER',incumbent:row.incumbent,x:row.features}),row.candidate,'rounded candidate parity');
 }
});

test('constructor correction is exactly unchanged and driver negative zero is canonicalized',()=>{
 const decoded=decodeTreeResidualModel(model());
 assert.equal(applyTreeResidualCorrection(decoded,{season:2025,round:6,type:'CONSTRUCTOR',incumbent:32.1,x:Array(10).fill(0)}),32.1);
 assert.equal(applyTreeResidualCorrection(decoded,{season:2025,round:6,type:'DRIVER',incumbent:.49,x:Array(10).fill(0)}),0);
});
