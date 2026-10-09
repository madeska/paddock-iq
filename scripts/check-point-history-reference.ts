import assert from 'node:assert/strict';
import {test} from 'node:test';
import {priceFreeHistoricalBaseline} from '../src/lib/point-history-reference';
import type {PointHistoryRow} from '../src/lib/point-history-model';
const rows:PointHistoryRow[]=Array.from({length:5},(_,i)=>({season:2025,round:i+1,code:'A',type:'DRIVER' as const,team:'X',actualPoints:10+i,sprint:false}));
const roster=[{code:'A',type:'DRIVER' as const,team:'X'}];
test('price-free reference excludes target/future points and snapshot value fields',()=>{
 const a=priceFreeHistoricalBaseline(rows,roster,{season:2025,round:6});
 assert.deepEqual(a,priceFreeHistoricalBaseline([...rows,{...rows[0],round:6,actualPoints:1000},{...rows[0],season:2026,actualPoints:999}],roster.map(r=>({...r,value:99.9})),{season:2025,round:6}));
});
test('constructor reference reproduces half EWMA plus half last-three mean',()=>{
 const history=rows.map(r=>({...r,type:'CONSTRUCTOR' as const}));const expectedEWMA=rows.reduce((n,r,i)=>i?.25*r.actualPoints+.75*n:r.actualPoints,0);
 assert.equal(priceFreeHistoricalBaseline(history,[{...roster[0],type:'CONSTRUCTOR'}],{season:2025,round:6}).A,.5*expectedEWMA+.5*13);
});
test('a constant driver history yields a constant reference forecast',()=>{
 assert.equal(priceFreeHistoricalBaseline(rows.map(r=>({...r,actualPoints:10})),roster,{season:2025,round:6}).A,10);
});
