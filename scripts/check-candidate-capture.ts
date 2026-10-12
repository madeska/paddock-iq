import assert from 'node:assert/strict';
import {test} from 'node:test';
import fixture from './fixtures/production-baseline-parity.json';
import type {ProductionForecastAsset} from '../src/lib/production-forecast';
import * as capture from '../src/lib/candidate-capture';
import {evaluateCandidateCapture} from '../src/lib/candidate-evaluation';
const input={season:2026,round:9,asOf:new Date('2026-06-01T12:00:00Z'),deadline:new Date('2026-06-02T12:00:00Z'),sprint:false,assets:fixture.assets as ProductionForecastAsset[],teams:{D0:'C8',D1:'C8',D2:'C9',D3:'C9'},history:[]};
test('pre-lock driver candidate capture preserves incumbent constructors and strips future inputs',()=>{
 assert.equal(typeof capture.buildCandidateCapture,'function');
 const r=capture.buildCandidateCapture(input);
 assert.ok(r.rows.length>0);for(const row of r.rows.filter(r=>r.type==='CONSTRUCTOR'))assert.equal(row.candidate,row.incumbent);
 assert.ok(r.inputs.assets.every(a=>a.scores.every(s=>s.round<input.round)&&a.prices.every(p=>p.round<=input.round)));
 assert.deepEqual(capture.buildCandidateCapture({...input,assets:input.assets.map(a=>({...a,scores:[...a.scores,{round:9,points:99999}],prices:[...a.prices,{round:10,price:99999}]}))}),r);
});
test('locked or sprint weekends cannot be represented as an eligible normal-weekend capture',()=>{
 assert.throws(()=>capture.buildCandidateCapture({...input,asOf:input.deadline}));assert.throws(()=>capture.buildCandidateCapture({...input,sprint:true}));
});
test('evaluation waits for all official results and preserves genuine zero totals',()=>{
 const c=capture.buildCandidateCapture(input),market={season:input.season,round:input.round,assets:c.rows.map(r=>({code:r.code,type:r.type,actualPoints:0 as number|null}))};
 const ready=evaluateCandidateCapture(c,market);assert.equal(ready.status,'READY');assert.equal(ready.metrics!.find(r=>r.type==='ALL')!.incumbent!.n,c.rows.length);
 market.assets[0].actualPoints=null;const waiting=evaluateCandidateCapture(c,market);assert.equal(waiting.status,'WAITING');assert.equal(waiting.metrics,null);
 assert.throws(()=>evaluateCandidateCapture(c,{...market,round:input.round+1}));
});
