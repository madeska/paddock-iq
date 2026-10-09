import assert from 'node:assert/strict';import {test} from 'node:test';import {fitPastOnlyAffineBlend} from '../src/lib/past-only-affine-blend';
const options={season:2025,round:3,type:'DRIVER' as const};const rows=Array.from({length:20},(_,i)=>({season:2025,round:1,code:'D'+i,type:'DRIVER' as const,baseline:0,component:i%2?1:-1,actual:2+.25*(i%2?1:-1)}));
test('no observations preserve incumbent weight and zero bias',()=>{const r=fitPastOnlyAffineBlend([],options);assert.equal(r.weight,.25);assert.equal(r.bias,0)});
test('balanced contrasts learn a shrunken bias without changing weight',()=>{const r=fitPastOnlyAffineBlend(rows,options);assert.equal(r.weight,.25);assert.equal(r.bias,1)});
test('target/future residuals cannot influence either parameter',()=>assert.deepEqual(fitPastOnlyAffineBlend([...rows,...rows.map(r=>({...r,round:3,actual:-99999}))],options),fitPastOnlyAffineBlend(rows,options)));
test('weight remains convex and invalid observations are rejected',()=>{const r=fitPastOnlyAffineBlend(rows.map(r=>({...r,actual:r.component*100})),options);assert.ok(r.weight>=0&&r.weight<=1);assert.throws(()=>fitPastOnlyAffineBlend([...rows,rows[0]],options))});
