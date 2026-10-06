import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitOvertakeModel,expectedRaceOvertakes} from '../src/lib/overtake-model';
import type {ComponentObservation} from '../src/lib/component-calibration';
const rows:ComponentObservation[]=[];
for(let round=1;round<=8;round++)for(let i=1;i<=22;i++){
 const start=1+(i*5+round*3)%22;
 rows.push({season:2026,round,code:'D'+i,type:'DRIVER',team:'T',qualifying:{total:0,position:i,noTime:false},race:{total:0,failed:false,finishPosition:start,positionChange:0,overtakes:Math.round(1+start*.35),fastestLap:false,dotd:false}});
}
test('conditional overtake model learns starting-grid exposure',()=>{
 const model=fitOvertakeModel(rows,{season:2026,round:9});
 assert.ok(expectedRaceOvertakes(model,'D10',20,true)>expectedRaceOvertakes(model,'D10',2,true)+3);
});
test('target/future and other seasons cannot affect any overtake model parameter',()=>{
 const past=fitOvertakeModel(rows,{season:2026,round:6});
 assert.deepEqual(past,fitOvertakeModel([...rows,{...rows[0],round:6,race:{...rows[0].race!,overtakes:100}},{...rows[0],season:2027}],{season:2026,round:6}));
});
test('early-season, unknown-driver and failed-race estimates remain finite',()=>{
 const model=fitOvertakeModel([],{season:2026,round:1});
 for(const classified of [true,false])for(const start of [null,-10,1,22,100]){
  const value=expectedRaceOvertakes(model,'NEW',start,classified);assert.ok(Number.isFinite(value)&&value>=0&&value<=25);
 }
 assert.throws(()=>fitOvertakeModel(rows,{season:2026,round:0}));
});
import {simulateComponentWeekend} from '../src/lib/component-simulation';
import {calibrateComponents} from '../src/lib/component-calibration';
test('simulation consumes conditional race overtake rates without changing the default path',()=>{
 const drivers=['A1','A2','B1','B2'].map(code=>({code,team:code[0],baselineXPts:10,recentScores:[10]}));
 const constructors=[{code:'A',baselineXPts:20},{code:'B',baselineXPts:20}];
 const calibration=calibrateComponents([],{season:2026,round:1});calibration.driverSessions=1;calibration.globalDriverRates.dnfProbability=0;
 const options={sprint:false,simulations:1000,seed:123,calibration};
 const model=fitOvertakeModel([],{season:2026,round:1});model.coefficients=[Math.log(12),0,0,0];
 const current=simulateComponentWeekend(drivers,constructors,options);
 assert.deepEqual(current,simulateComponentWeekend(drivers,constructors,{...options,overtakeModel:undefined}));
 const conditional=simulateComponentWeekend(drivers,constructors,{...options,overtakeModel:model});
 for(const driver of conditional.drivers)assert.ok(driver.overtakes>11.5&&driver.overtakes<12.5);
 assert.notDeepEqual(current.drivers.map(d=>d.overtakes),conditional.drivers.map(d=>d.overtakes));
});
test('optional qualifying pace orders the grid independently from overall xPts',()=>{
 const drivers=['A1','A2','B1','B2'].map(code=>({code,team:code[0],baselineXPts:10,recentScores:[10]}));
 const calibration=calibrateComponents([],{season:2026,round:1});calibration.driverSessions=1;calibration.globalDriverRates.noTimeProbability=0;
 const result=simulateComponentWeekend(drivers,[{code:'A',baselineXPts:20},{code:'B',baselineXPts:20}],{sprint:false,simulations:100,seed:42,calibration,qualifyingPace:{A1:2,A2:1,B1:-1,B2:-2},qualifyingNoise:.01} as any);
 assert.equal(result.drivers.find(d=>d.code==='A1')!.qualifying,10);
 assert.equal(result.drivers.find(d=>d.code==='B2')!.qualifying,7);
});
