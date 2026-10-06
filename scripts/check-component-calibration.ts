import assert from 'node:assert/strict';
import {test} from 'node:test';
import {raceDriverPoints,sprintDriverPoints} from '../src/lib/fantasy-scoring';
import {scoreDriverWeekend} from '../src/lib/fantasy-score-calculator';
import {parseComponentHistory,calibrateComponents} from '../src/lib/component-calibration';
const info={code:'HAD',type:'DRIVER' as const,team:'RBR',season:2026};
const stats=(events:any[])=>({Value:{MatchWiseStats:[{GamedayId:1,RaceDayWise:[{Season:'2026',MatchStatus:'4',IsPlayed:1,SessionType:'Race',StatsWise:events}]}]}});
test('DNF retains earned overtakes while finish and position points are suppressed',()=>{
 assert.equal(raceDriverPoints({classified:false,startPosition:3,finishPosition:7,overtakes:4}),-16);
 assert.equal(sprintDriverPoints({classified:false,startPosition:2,finishPosition:null,overtakes:2}),-8);
 assert.equal(scoreDriverWeekend({qualifyingPosition:3,raceStartPosition:3,raceFinishPosition:null,dnf:true,overtakes:4}).total,-8);
});
test('a negative score from lost positions is not treated as a DNF',()=>{
 const rows=parseComponentHistory(stats([{Event:'Total',Value:-2},{Event:'Race Position',Frequency:'16th',Value:0},{Event:'Race Position lost',Value:-7},{Event:'race overtake bonus',Value:5}]),info);
 assert.equal(rows.length,1);assert.equal(rows[0].race?.failed,false);assert.equal(rows[0].race?.overtakes,5);assert.equal(rows[0].race?.positionChange,-7);
});
test('explicit failure retains pre-retirement overtakes in history',()=>{
 const rows=parseComponentHistory(stats([{Event:'Total',Value:-16},{Event:'Race not classified ',Value:-20},{Event:'race overtake bonus',Value:4}]),info);
 assert.equal(rows[0].race?.failed,true);assert.equal(rows[0].race?.total,-16);assert.equal(rows[0].race?.overtakes,4);
});
test('unplayed or empty sessions are not fabricated as successful race observations',()=>{
 assert.equal(parseComponentHistory(stats([]),info).length,0);const raw=stats([{Event:'Race Position',Frequency:'1st',Value:25}]);raw.Value.MatchWiseStats[0].RaceDayWise[0].IsPlayed=0;assert.equal(parseComponentHistory(raw,info).length,0);
});
test('calibration excludes target and future rounds',()=>{
 const past=parseComponentHistory(stats([{Event:'Race Position',Frequency:'10th',Value:1},{Event:'race overtake bonus',Value:2}]),info);
 const future={...past[0],round:3,race:{...past[0].race!,failed:true,overtakes:100,total:-20}};
 const a=calibrateComponents(past,{season:2026,round:3});const b=calibrateComponents([...past,future,{...future,round:10}],{season:2026,round:3});assert.deepEqual(a,b);
});
test('constructor pit components sum awards without inferring stop seconds',()=>{
 const rows=parseComponentHistory(stats([{Event:'Total',Value:67},{Event:'Race Position',Value:43},{Event:'Fastest Pitstop',Value:10},{Event:'2nd Fastest Pitstop',Value:5},{Event:'race overtake bonus',Value:9}]),{code:'MER',type:'CONSTRUCTOR',team:'MER',season:2026});assert.equal(rows[0].pitPoints,15);
});
import {simulateComponentWeekend} from '../src/lib/component-simulation';
test('simulation uses observed DNF/overtake/pit rates and preserves its component totals',()=>{
 const calibration=calibrateComponents([],{season:2026,round:3});calibration.driverSessions=10;
 calibration.globalDriverRates={...calibration.globalDriverRates,dnfProbability:1,sprintDnfProbability:1,noTimeProbability:0,failedRaceOvertakesMean:4,failedSprintOvertakesMean:2};
 calibration.pitPoints={A:[{points:15,probability:1}],B:[{points:5,probability:1}]};
 const drivers=['A1','A2','B1','B2'].map(code=>({code,team:code[0],baselineXPts:10,recentScores:[10,10]}));
 const result=simulateComponentWeekend(drivers,[{code:'A',baselineXPts:20},{code:'B',baselineXPts:20}],{sprint:true,simulations:1000,seed:123,calibration} as any);
 for(const d of result.drivers){assert.equal(d.dnfPenalty,-20);assert.ok(d.overtakes>3.7&&d.overtakes<4.3);assert.ok(d.sprint> -8.3&&d.sprint< -7.7);assert.ok(Math.abs(d.total-(d.qualifying+d.sprint+d.raceFinish+d.positions+d.overtakes+d.fastestLap+d.driverOfTheDay+d.dnfPenalty))<1e-8)}
 assert.equal(result.constructors.find(c=>c.code==='A')!.pitStops,15);assert.equal(result.constructors.find(c=>c.code==='B')!.pitStops,5);
 assert.deepEqual(result,simulateComponentWeekend(drivers,[{code:'A',baselineXPts:20},{code:'B',baselineXPts:20}],{sprint:true,simulations:1000,seed:123,calibration} as any));
});
import history from '../src/data/component-history-2026.json';
test('official historical driver sessions replay through the scoring rules',()=>{
 let races=0,sprints=0;
 for(const row of history.observations){
  if(row.type!=='DRIVER')continue;
  for(const kind of ['race','sprint'] as const){
   const event=(row as any)[kind];if(!event)continue;
   const input={classified:!event.failed,finishPosition:event.finishPosition,startPosition:event.finishPosition===null?1:event.finishPosition+event.positionChange,overtakes:event.overtakes,fastestLap:event.fastestLap,driverOfTheDay:event.dotd};
   assert.equal(kind==='race'?raceDriverPoints(input):sprintDriverPoints(input),event.total,row.code+' round '+row.round+' '+kind);
   if(kind==='race')races++;else sprints++;
  }
 }
 assert.equal(races,352);assert.ok(sprints>0);
});
test('no-time drivers do not earn constructor qualifying progression awards',()=>{
 const calibration=calibrateComponents([],{season:2026,round:3});calibration.driverSessions=1;calibration.globalDriverRates.noTimeProbability=1;
 const drivers=['A1','A2','B1','B2'].map(code=>({code,team:code[0],baselineXPts:10,recentScores:[10]}));
 const result=simulateComponentWeekend(drivers,[{code:'A',baselineXPts:20},{code:'B',baselineXPts:20}],{sprint:false,simulations:100,calibration});
 for(const c of result.constructors)assert.equal(c.qualifying,-11);
});

