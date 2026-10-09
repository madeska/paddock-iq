import assert from 'node:assert/strict';
import {test} from 'node:test';
import {forecastPointHistory,type PointHistoryRow} from '../src/lib/point-history-model';
const history:PointHistoryRow[]=Array.from({length:5},(_,i)=>[{season:2026,round:i+1,code:'A',type:'DRIVER' as const,team:'X',actualPoints:20+i,sprint:false},{season:2026,round:i+1,code:'B',type:'DRIVER' as const,team:'Y',actualPoints:5+i,sprint:false}]).flat();
const roster=[{code:'A',type:'DRIVER' as const,team:'X'},{code:'B',type:'DRIVER' as const,team:'Y'}];
const options={season:2026,round:6,sprint:false,alpha:.25,ridge:50,sprintFactor:1.3};
test('target/future labels and other seasons cannot alter point predictions',()=>{
 const a=forecastPointHistory(history,roster,options);const b=forecastPointHistory([...history,{...history[0],round:6,actualPoints:1000},{...history[0],round:7,actualPoints:-1000},{...history[0],season:2025,actualPoints:999}],roster,options);assert.deepEqual(a,b);
});
test('history and roster order do not change forecasts',()=>{
 assert.deepEqual(forecastPointHistory(history,roster,options),forecastPointHistory([...history].reverse(),[...roster].reverse(),options));
});
test('cold drivers use prior team information without pretending they raced',()=>{
 const p=forecastPointHistory(history,[{code:'C',type:'DRIVER',team:'X'},{code:'D',type:'DRIVER',team:'Y'}],options);
 assert.ok(Number.isFinite(p.C));assert.ok(p.C>p.D);
});
test('known sprint schedule changes forecast without using target sprint scores',()=>{
 const normal=forecastPointHistory(history,roster,options);const sprint=forecastPointHistory(history,roster,{...options,sprint:true});assert.equal(sprint.A,normal.A*1.3);
});
test('duplicate historical rows and invalid model settings are rejected',()=>{
 assert.throws(()=>forecastPointHistory([...history,history[0]],roster,options));assert.throws(()=>forecastPointHistory(history,roster,{...options,alpha:0}));assert.throws(()=>forecastPointHistory(history,roster,{...options,ridge:-1}));
});
test('the fitted regression path remains isolated from target labels',()=>{
 const rich:PointHistoryRow[]=Array.from({length:6},(_,i)=>Array.from({length:8},(_,j)=>({season:2026,round:i+1,code:'D'+j,type:'DRIVER' as const,team:'T'+Math.floor(j/2),actualPoints:j*4+i*(j%3-1),sprint:false}))).flat();
 const target=[{code:'D4',type:'DRIVER' as const,team:'T2'}],setting={...options,round:7};
 const a=forecastPointHistory(rich,target,setting);assert.ok(Number.isFinite(a.D4));
 assert.deepEqual(a,forecastPointHistory([...rich,{...rich[0],code:'D4',round:7,actualPoints:9999}],target,setting));
});
