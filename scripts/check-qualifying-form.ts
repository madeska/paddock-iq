import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitQualifyingForm,expectedQualifyingRanks} from '../src/lib/qualifying-form';
import type {ArchivedRace} from '../src/lib/race-archive';
const row=(round:number,code:string,team:string,position:number,year=2025)=>({year,round,drivers:[{code,team,qualifyingPosition:position,qualifyingDsq:false,qualifyingDns:false}]} as ArchivedRace);
const roster=[{code:'A',team:'X'},{code:'B',team:'X'}];
test('future and other seasons cannot affect qualifying forecasts',()=>{
 const h=[row(1,'A','X',2)];const options={year:2025,round:3};
 assert.deepEqual(fitQualifyingForm(h,roster,options),fitQualifyingForm([...h,row(3,'A','X',20),row(2,'A','X',20,2026)],roster,options));
});
test('new drivers inherit team pace and switched drivers discard old car history',()=>{
 const h=[row(1,'A','X',2),row(1,'B','Y',20)];
 const p=fitQualifyingForm(h,roster,{year:2025,round:2,driverPrior:5,teamPrior:0});
 assert.equal(p.A,p.B);assert.ok(p.B>0);
});
test('recent form receives greater weight while empty histories stay finite',()=>{
 const h=[row(1,'A','X',20),row(4,'A','X',1)];
 assert.ok(fitQualifyingForm(h,roster,{year:2025,round:5,halfLife:1,driverPrior:0}).A>fitQualifyingForm(h,roster,{year:2025,round:5,driverPrior:0}).A);
 assert.deepEqual(fitQualifyingForm([],roster,{year:2025,round:1,driverPrior:0,teamPrior:0}),{A:0,B:0});
});
test('rank sampling is invariant to roster order and tied drivers are treated fairly',()=>{
 const a=expectedQualifyingRanks({A:0,B:0,C:0},0,10000,7);
 assert.deepEqual(a,expectedQualifyingRanks({C:0,B:0,A:0},0,10000,7));
 for(const value of Object.values(a))assert.ok(Math.abs(value-2)<.04);
 assert.ok(Math.abs(Object.values(a).reduce((a,b)=>a+b,0)-6)<1e-10);
});
test('invalid fitting and sampling options are rejected',()=>{
 assert.throws(()=>fitQualifyingForm([],roster,{year:2025,round:1,halfLife:0}));
 assert.throws(()=>expectedQualifyingRanks({A:NaN},.15,100,1));
});
