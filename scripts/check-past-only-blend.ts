import assert from 'node:assert/strict';import {test} from 'node:test';import {fitPastOnlyBlend} from '../src/lib/past-only-blend';
const options={season:2025,round:3,type:'DRIVER' as const};const rows=Array.from({length:20},(_,i)=>({season:2025,round:1,code:'D'+i,type:'DRIVER' as const,baseline:0,component:10,actual:10}));
test('empty history retains incumbent prior',()=>assert.equal(fitPastOnlyBlend([],options).weight,.25));
test('component evidence shrinks toward prior instead of directly selecting winner',()=>assert.equal(fitPastOnlyBlend(rows,options).weight,.625));
test('target/future and other season labels do not affect learned weight',()=>assert.deepEqual(fitPastOnlyBlend([...rows,...rows.map(r=>({...r,round:3,actual:-99999})),...rows.map(r=>({...r,season:2024,actual:-99999}))],options),fitPastOnlyBlend(rows,options)));
test('zero component contrast retains prior and invalid/duplicate training rows fail',()=>{assert.equal(fitPastOnlyBlend(rows.map(r=>({...r,component:0})),options).weight,.25);assert.throws(()=>fitPastOnlyBlend([...rows,rows[0]],options));assert.throws(()=>fitPastOnlyBlend(rows.map(r=>({...r,actual:NaN})),options))});
