import assert from 'node:assert/strict';
import {test} from 'node:test';
import components from '../src/data/component-history-2024.json';
import practice from '../src/data/prelock-practice-2024.json';
import stored from '../docs/tree-forecast-frames-2024.json';
import {buildTreeForecastFrames} from './tree-forecast-frames';
const quotes=components.observations.map(r=>({round:r.round,code:r.code,type:r.type as 'DRIVER'|'CONSTRUCTOR',team:r.team,priceBefore:r.priceBefore}));
const weekend=practice.weekends.find(w=>w.round===6)!;
const context={season:2024,round:6,sprint:weekend.isSprint,practice:{isSprint:weekend.isSprint,positions:new Map(weekend.practice?.positions.map(p=>[p.code,p.position])??[])}};
const scores=components.observations.map(r=>({season:r.season,round:r.round,code:r.code,type:r.type as 'DRIVER'|'CONSTRUCTOR',actualPoints:r.actualPoints}));
test('exported shared frames preserve committed full-forecast features and predictions',()=>{
 const frames=buildTreeForecastFrames(scores,quotes,context);
 const expected=stored.frames.filter(r=>r.round===6).map(({actual,...row})=>row);
 assert.deepEqual(frames,expected);
 assert.ok(frames.some(r=>r.type==='DRIVER'));assert.ok(frames.some(r=>r.type==='CONSTRUCTOR'));
});
test('target labels and future scores or prices cannot change features',()=>{
 const base=buildTreeForecastFrames(scores,quotes,context);
 const poisoned=scores.map(r=>r.round>=6?{...r,actualPoints:99999}:r);
 const prices=quotes.map(r=>r.round>6?{...r,priceBefore:99999}:r);
 assert.deepEqual(buildTreeForecastFrames(poisoned,prices,context),base);
});
test('invalid historical quotes and duplicate historical scores fail closed',()=>{
 assert.throws(()=>buildTreeForecastFrames(scores,quotes.map((r,i)=>i===0?{...r,priceBefore:NaN}:r),context),/quote/);
 assert.throws(()=>buildTreeForecastFrames([...scores,scores[0]],quotes,context),/Duplicate score/);
});
test('missing own history remains absent and does not fabricate target labels',()=>{
 const frames=buildTreeForecastFrames(scores.filter(r=>r.code!=='VER'),quotes,context);
 assert.equal(frames.some(r=>r.code==='VER'),false);
 assert.ok(frames.every(r=>!Object.hasOwn(r,'actual')));
});
