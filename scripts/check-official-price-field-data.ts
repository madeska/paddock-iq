import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import data from '../src/data/component-history-2026.json';
import migration from '../docs/official-price-field-2026-migration.json';
test('quote correction preserves all original scores and scoring components',()=>{
 assert.equal(data.quoteField,'Value');assert.equal(data.observations.length,528);
 const unchanged=JSON.stringify(data.observations.map(({priceBefore,...row})=>row));
 assert.equal(createHash('sha256').update(unchanged).digest('hex'),migration.unchangedScoresAndComponentsSHA256);
 assert.equal(migration.changedQuotes,471);
});
test('corrected R16 quotes agree with the independently compared official/public archive values',()=>{
 const cases={ANT:26.9,COL:10,LIN:8.8,LAW:9.1,OCO:9.1,MER:33.8,RBR:32.1,FER:27.6,ALP:19.4,RB:15.3};
 for(const [code,price] of Object.entries(cases))assert.equal(data.observations.find(r=>r.round===16&&r.code===code)?.priceBefore,price);
});
