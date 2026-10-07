import assert from 'node:assert/strict';import {test} from 'node:test';import {causalQuoteFromPriorChanges} from '../src/lib/causal-price-history';
test('target and future price changes cannot influence the quote',()=>{const changes=[{round:1,change:.1},{round:2,change:-.2},{round:3,change:999}];assert.equal(causalQuoteFromPriorChanges(30,changes,3),29.9);assert.equal(causalQuoteFromPriorChanges(30,changes.map(r=>r.round>=3?{...r,change:-999}:r),3),29.9)});
test('missing or duplicate earlier changes are rejected',()=>{assert.throws(()=>causalQuoteFromPriorChanges(30,[{round:1,change:.1}],3));assert.throws(()=>causalQuoteFromPriorChanges(30,[{round:1,change:.1},{round:1,change:.2}],2))});
test('invalid initial quote or known earlier change cannot produce a forecast',()=>{assert.throws(()=>causalQuoteFromPriorChanges(NaN,[],1));assert.throws(()=>causalQuoteFromPriorChanges(3,[{round:1,change:-4}],2));assert.equal(causalQuoteFromPriorChanges(30,[],1),30)});

test('finite inputs cannot overflow into an infinite quote',()=>assert.throws(()=>causalQuoteFromPriorChanges(1e308,[{round:1,change:0}],2)));
