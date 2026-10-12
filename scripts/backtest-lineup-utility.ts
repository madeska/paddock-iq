import {writeFile} from 'node:fs/promises';
import components25 from '../src/data/component-history-2025.json';
import components26 from '../src/data/component-history-2026.json';
import totals25 from '../src/data/fantasy-totals-2025.json';
import prices25 from '../src/data/fantasy-prices-2025.json';
import practices25 from '../src/data/prelock-practice-2025.json';
import practices26 from '../src/data/session-pace-practice-2026.json';
import {fitSessionPace} from '../src/lib/session-pace';
import {fitClassifiedProgress} from '../src/lib/race-progress-model';
import {forecastProductionBaselines} from '../src/lib/production-forecast';
import {replayProductionHistory,type ReplayScore} from '../src/lib/production-history-replay';
import type {ArchivedFantasyPrice} from '../src/lib/fantasy-price-archive';
import type {ComponentObservation} from '../src/lib/component-calibration';
import {selectPointsLineup,type LineupAsset,type PointsLineup} from '../src/lib/lineup-utility';
const budgets=[120,125,130,135];
type Result={season:number;round:number;budget:number;incumbent:PointsLineup;candidate:PointsLineup;incumbentActual:number;candidateActual:number;delta:number;oracleActual:number;changed:boolean};
const mean=(xs:number[])=>xs.reduce((s,x)=>s+x,0)/xs.length;
async function main(){
 const rows:Result[]=[],coverage:{season:number;round:number;eligible:number;excluded:string[]}[]=[];
 for(const season of [2025,2026]){
  const history=(season===2025?totals25.observations:components26.observations) as ReplayScore[];
  const quotes=(season===2025?prices25.observations:components26.observations.map(r=>({round:r.round,code:r.code,type:r.type,team:r.team,priceBefore:r.priceBefore}))) as ArchivedFantasyPrice[];
  const components=(season===2025?components25.observations:components26.observations) as ComponentObservation[];
  for(const round of season===2025?[6,7,8,9,10,11,12,13,14]:[6,7,8,9,10,11,12,13,14,15,16]){
   const weekend=(season===2025?practices25.weekends:practices26.weekends).find(w=>w.round===round);
   if(weekend?.isSprint??[2,4,5,9,12,17].includes(round))continue;
   if(weekend?.practice&&Date.parse(weekend.practice.endedAt)>=Date.parse(weekend.lockTime))throw Error('Practice after lock');
   const practice=weekend?.practice?{isSprint:false,positions:new Map(weekend.practice.positions.map(p=>[p.code,p.position]))}:null;
   const roster=quotes.filter(q=>q.round===round);
   const assets=roster.map(q=>({season,code:q.code,type:q.type,currentPrice:q.priceBefore,prices:quotes.filter(p=>p.code===q.code&&p.type===q.type&&p.round<=round).map(p=>({round:p.round,price:p.priceBefore})),scores:history.filter(h=>h.season===season&&h.code===q.code&&h.type===q.type&&h.round<round).map(h=>({round:h.round,points:h.actualPoints}))}));
   const baselines=forecastProductionBaselines(assets,{season,round,practice}).baselines;
   const incumbent=replayProductionHistory(history,quotes,{season,round,sprint:false,practice});
   const pace=fitSessionPace(components,{season,round,drivers:roster.filter(q=>q.type==='DRIVER').map(q=>q.code),practice:practice?.positions});
   const progress=fitClassifiedProgress(components,{season,round,priorStrength:5});
   const candidate=replayProductionHistory(history,quotes,{season,round,sprint:false,practice,componentOverrides:{qualifyingPace:pace.qualifying,raceProgress:progress.progress}}).map(r=>r.type==='CONSTRUCTOR'?incumbent.find(i=>i.code===r.code&&i.type===r.type)!:r);
   // Eligibility depends only on pre-event quote/history coverage, never actual scores.
   const eligible=roster.filter(q=>incumbent.find(r=>r.code===q.code&&r.type===q.type)?.prediction!=null&&candidate.find(r=>r.code===q.code&&r.type===q.type)?.prediction!=null);
   coverage.push({season,round,eligible:eligible.length,excluded:roster.filter(q=>!eligible.includes(q)).map(q=>q.code)});
   const actuals=new Map(history.filter(h=>h.season===season&&h.round===round).map(h=>[`${h.type}:${h.code}`,h.actualPoints]));
   for(const q of eligible)if(!actuals.has(`${q.type}:${q.code}`))throw Error(`Missing actual ${season}/${round}/${q.code}; do not select on outcome availability`);
   const modelRoster=(forecasts:typeof incumbent):LineupAsset[]=>eligible.map(q=>{const boost=baselines.get(q.code)!.boostXPts;return {code:q.code,type:q.type,price:q.priceBefore,points:forecasts.find(r=>r.code===q.code&&r.type===q.type)!.prediction!,boostPoints:q.type==='DRIVER'&&boost!=null?Math.round(boost*10)/10:null}});
   const actual=(lineup:PointsLineup)=>lineup.drivers.reduce((s,c)=>s+actuals.get(`DRIVER:${c}`)!,0)+lineup.constructors.reduce((s,c)=>s+actuals.get(`CONSTRUCTOR:${c}`)!,0)+actuals.get(`DRIVER:${lineup.boost}`)!;
   for(const budget of budgets){
    const a=selectPointsLineup(modelRoster(incumbent),budget),b=selectPointsLineup(modelRoster(candidate),budget);
    if(!a||!b)throw Error(`No feasible paired lineup ${season}/${round}/${budget}`);
    const oracle=selectPointsLineup(eligible.map(q=>({code:q.code,type:q.type,price:q.priceBefore,points:actuals.get(`${q.type}:${q.code}`)!})),budget)!;
    const incumbentActual=actual(a),candidateActual=actual(b);
    rows.push({season,round,budget,incumbent:a,candidate:b,incumbentActual,candidateActual,delta:candidateActual-incumbentActual,oracleActual:actual(oracle),changed:JSON.stringify([a.drivers,a.constructors,a.boost])!==JSON.stringify([b.drivers,b.constructors,b.boost])});
   }
  }
 }
 const summary=[2025,2026].map(season=>{
  const cohort=rows.filter(r=>r.season===season),blocks=[...new Set(cohort.map(r=>r.round))].map(round=>mean(cohort.filter(r=>r.round===round).map(r=>r.delta)));
  let seed=771;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const draws=Array.from({length:10000},()=>mean(blocks.map(()=>blocks[Math.floor(random()*blocks.length)]))).sort((a,b)=>a-b);
  return {season,rounds:blocks.length,lineups:cohort.length,changed:cohort.filter(r=>r.changed).length,wins:cohort.filter(r=>r.delta>0).length,losses:cohort.filter(r=>r.delta<0).length,meanIncumbentActual:mean(cohort.map(r=>r.incumbentActual)),meanCandidateActual:mean(cohort.map(r=>r.candidateActual)),meanDelta:mean(blocks),raceBootstrap95:[draws[250],draws[9749]],incumbentOracleRegret:mean(cohort.map(r=>r.oracleActual-r.incumbentActual)),candidateOracleRegret:mean(cohort.map(r=>r.oracleActual-r.candidateActual))};
 });
 const report={capturedAt:new Date().toISOString(),scope:'Exploratory previously consumed normal-weekend 2025 R6–14 and 2026 R6–16. Fixed budgets120/125/130/135, points mode, five drivers/two constructors/x2. No transfers or chips. Oracle uses only the same pre-event eligible roster and is descriptive, never used for selection.',policy:'Incumbent versus driver-only classified progress, fixed prior5 and practice25%; constructors unchanged. Boost uses production ridge forecast, falling back to each policy main forecast when unavailable. Lexical deterministic ties; budgets are correlated, bootstrap resamples whole rounds averaging all four budgets. Cold-start assets excluded identically without consulting actuals. No search or production activation.',summary,coverage,rows};
 await writeFile('docs/lineup-utility-results.json',JSON.stringify(report,null,2)+'\n');console.table(summary);
}
main().catch(error=>{console.error(error);process.exitCode=1});
