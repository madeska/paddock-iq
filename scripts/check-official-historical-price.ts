import assert from 'node:assert/strict';
import {test} from 'node:test';
import {officialHistoricalFantasyPrice} from '../src/lib/official-historical-price';
test('official R16 quotes use Value rather than the previous-round OldPlayerValue',()=>{
 assert.equal(officialHistoricalFantasyPrice({Value:26.9,OldPlayerValue:26.6}),26.9);
 assert.equal(officialHistoricalFantasyPrice({Value:10,OldPlayerValue:10.6}),10);
});
test('historical quote extraction cannot silently fall back to old values',()=>{
 for(const value of [undefined,null,'',NaN,Infinity,0,-1])assert.throws(()=>officialHistoricalFantasyPrice({Value:value,OldPlayerValue:26.6}),/quote/);
 assert.equal(officialHistoricalFantasyPrice({Value:'26.9'}),26.9);
});
