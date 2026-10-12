import assert from 'node:assert/strict';
import {test} from 'node:test';
import totals from '../src/data/fantasy-totals-2025.json';
import priceData from '../src/data/fantasy-prices-2025.json';
import archive from '../src/data/prelock-practice-2025.json';
import {buildPrelockResidualFrames} from '../src/lib/prelock-residual-frames';
import {forecastPrelockResidual} from '../src/lib/prelock-residual-model';
import type {ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
import type {PrelockWeekend} from '../src/lib/prelock-session-archive';
const history=totals.observations as ReplayScore[],prices=priceData.observations as ArchivedFantasyPrice[],weekends=archive.weekends as PrelockWeekend[];
test('full frame pipeline excludes target/future label and quote leakage',()=>{
 const options={season:2025,throughRound:9},model={season:2025,round:9,ridge:50,weight:.5};
 const first=buildPrelockResidualFrames(history,prices,weekends,options),changed=buildPrelockResidualFrames(history.map(r=>r.round>=9?{...r,actualPoints:99999}:r),prices.map(r=>r.round>9?{...r,priceBefore:99999}:r),weekends,options);
 assert.deepEqual(forecastPrelockResidual(changed.frames,changed.frames.filter(r=>r.round===9),model),forecastPrelockResidual(first.frames,first.frames.filter(r=>r.round===9),model));
});
test('session results crossing the lock cutoff are rejected in the feature pipeline',()=>{const altered=structuredClone(weekends);altered[8].practice!.endedAt=altered[8].lockTime;assert.throws(()=>buildPrelockResidualFrames(history,prices,altered,{season:2025,throughRound:9}))});
test('cold-start missing forecasts remain explicit in comparator coverage',()=>{const result=buildPrelockResidualFrames(history,prices,weekends,{season:2025,throughRound:7});assert.ok(result.missing.some(r=>r.round===7&&r.code==='COL'));assert.ok(!result.frames.some(r=>r.round===7&&r.code==='COL'))});
