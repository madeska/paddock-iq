import assert from 'node:assert/strict';
import {test} from 'node:test';
import totals from '../src/data/fantasy-totals-2025.json';
import priceData from '../src/data/fantasy-prices-2025.json';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
const history=totals.observations.map(r=>({...r,season:2025})) as ReplayScore[],prices=priceData.observations as ArchivedFantasyPrice[];
test('target and future labels and later quotes cannot influence replay predictions',()=>{
 const options={season:2025,round:9,sprint:false};const reference=replayProductionHistory(history,prices,options);
 const changed=history.map(r=>r.round>=9?{...r,actualPoints:99999}:r),quotes=prices.map(r=>r.round>9?{...r,priceBefore:99999}:r);
 assert.deepEqual(replayProductionHistory(changed,quotes,options),reference);
});
test('unrelated seasons cannot influence replay',()=>{
 const options={season:2025,round:9,sprint:false};assert.deepEqual(replayProductionHistory([...history,...history.map(r=>({...r,season:2026,actualPoints:99999}))],prices,options),replayProductionHistory(history,prices,options));
});
test('cold-start coverage is explicit rather than a fabricated zero projection',()=>{
 const rows=replayProductionHistory(history,prices,{season:2025,round:7,sprint:false});assert.equal(rows.length,30);assert.equal(rows.find(r=>r.code==='COL')?.prediction,null);assert.equal(rows.filter(r=>r.prediction!==null).length,29);
});
