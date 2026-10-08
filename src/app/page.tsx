'use client';

import {useEffect,useMemo,useState,useRef} from 'react';
import styles from './market-dashboard.module.css';

type Score={round:number;points:number;name:string};
type MarketAsset={
 code:string;name:string;type:'DRIVER'|'CONSTRUCTOR';price:number|null;
 actualPoints?:number|null;actualPointsUpdatedAt?:string|null;expectedPoints:number|null;boostExpectedPoints?:number|null;expectedDelta:number|null;horizonPoints?:number[];
 probabilityRise:number|null;probabilityFlat:number|null;probabilityFall:number|null;
 probabilityMaxRise:number|null;probabilitySmallRise:number|null;
 probabilitySmallFall:number|null;probabilityMaxFall:number|null;
 requiredPointsMaxRise:number|null;requiredPointsSmallRise:number|null;
 requiredPointsAvoidMaxFall:number|null;
 confidence:number|null;modelVersion:string|null;recentFantasyScores:Score[];
};
type MarketResponse={
 season:number;round:number;grandPrix:string;complete:boolean;incomplete:string[];
 currentModels:string[];assets:MarketAsset[];
};
type BuilderMode='points'|'balanced'|'budget'|'custom'|'horizon';
type AssetRule='neutral'|'include'|'exclude';
type BuilderTeam={
 drivers:MarketAsset[];
 constructors:MarketAsset[];
 boost:string;
 boostPoints:number;
 price:number;
 expectedPoints:number;
 expectedDelta:number;
 score:number;
 confidence:number|null;
 confidenceLabel:'HIGH'|'MEDIUM'|'LOW'|null;
};

const accents:Record<string,string>={
 VER:'#2658ff',RUS:'#08c9bd',ANT:'#20d2bf',LEC:'#f04545',HAM:'#ef4438',PIA:'#ff9f1a',NOR:'#ff9c18',
 HAD:'#263cff',HUL:'#ff592f',LIN:'#5c7df7',BOT:'#777d89',BEA:'#f2f2f2',PER:'#d9d9d9',STR:'#18aa9b',
 OCO:'#f5f5f5',LAW:'#7289ff',BOR:'#ff4b1f',SAI:'#1678ff',COL:'#ef73c6',ALB:'#237cf2',GAS:'#e36cae',ALO:'#26b7a2',
 RBR:'#2347ff',FER:'#ef4444',MER:'#20bfc0',MCL:'#ff9c18',ALP:'#d57cac',AUD:'#9b5d35',RB:'#5b77ee',
 HAS:'#e8e8e8',CAD:'#a9a9a9',WIL:'#2188ff',AST:'#159a89'
};

const pct=(v:number|null)=>v==null?'—':Math.round(v*100)+'%';
const delta=(v:number|null)=>v==null?'—':(v>0?'+':'')+v.toFixed(2);

function scoreFor(asset:MarketAsset,round:number){
 return asset.recentFantasyScores.find(s=>s.round===round)?.points;
}

function bucketProbabilities(asset:MarketAsset){
 const raw=[
  {delta:asset.price!=null&&asset.price>=18.5?-.3:-.6,p:asset.probabilityMaxFall??0},
  {delta:asset.price!=null&&asset.price>=18.5?-.1:-.2,p:asset.probabilitySmallFall??0},
  {delta:asset.price!=null&&asset.price>=18.5?.1:.2,p:asset.probabilitySmallRise??0},
  {delta:asset.price!=null&&asset.price>=18.5?.3:.6,p:asset.probabilityMaxRise??0},
 ];
 const floorDelta=asset.price==null?-Infinity:Math.round((3-asset.price)*100)/100;
 const ceilingDelta=asset.price==null?Infinity:Math.round((34-asset.price)*100)/100;
 const out=new Map<number,number>();
 for(const item of raw){
  const d=item.delta<0?Math.max(item.delta,floorDelta):Math.min(item.delta,ceilingDelta);
  out.set(d,(out.get(d)??0)+item.p);
 }
 if(asset.probabilityFlat!=null&&asset.probabilityFlat>0&&!out.has(0))out.set(0,asset.probabilityFlat);
 return out;
}

function thresholdText(asset:MarketAsset,bucket:number){
 const tierA=(asset.price??0)>=18.5;
 const t06=asset.requiredPointsAvoidMaxFall;
 const t09=asset.requiredPointsSmallRise;
 const t12=asset.requiredPointsMaxRise;
 const min=(v:number)=>Math.ceil(v-1e-9);
 if(bucket===(tierA?-.3:-.6)&&t06!=null)return '≤'+(min(t06)-1);
 if(bucket===(tierA?-.1:-.2)&&t06!=null&&t09!=null)return min(t06)+'–'+(min(t09)-1);
 if(bucket===(tierA?.1:.2)&&t09!=null&&t12!=null)return min(t09)+'–'+(min(t12)-1);
 if(bucket===(tierA?.3:.6)&&t12!=null)return '≥'+min(t12);
 return '';
}

function Board({title,tier,assets,round,query}:{title:string;tier:'A'|'B';assets:MarketAsset[];round:number;query:string}){
 const filtered=assets
  .filter(a=>((a.price??0)>=18.5)===(tier==='A'))
  .filter(a=>!query||a.code.toLowerCase().includes(query)||a.name.toLowerCase().includes(query))
  .sort((a,b)=>(b.expectedDelta??-99)-(a.expectedDelta??-99)||(b.price??0)-(a.price??0));
 const buckets=tier==='A'?[-.3,-.1,.1,.3]:[-.6,-.2,0,.2,.6];

 return <div className={styles.board}>
  <div className={styles.tierTitle}><strong>Tier {tier}</strong><span>{tier==='A'?'≥ $18.5M':'< $18.5M'}</span></div>
  <div className={styles.scroll}>
   <table className={styles.marketTable}>
    <thead>
     <tr>
      <th className={styles.assetCol}>{title==='Drivers'?'DR':'CR'}</th>
      <th>$</th>
      <th>R{round-2}<small>Pts</small></th>
      <th>R{round-1}<small>Pts</small></th>
      <th>R{round}<small>xPts</small></th>
      <th>R{round}<small>Official pts</small></th>
      {buckets.map(b=><th key={b} className={b<0?styles.negHead:b>0?styles.posHead:styles.flatHead}>{b>0?'+':''}{b.toFixed(1)}<small>Odds (pts)</small></th>)}
      <th>R{round}<small>xΔ$</small></th>
     </tr>
    </thead>
    <tbody>
     {filtered.map(asset=>{
      const probs=bucketProbabilities(asset);
      return <tr key={asset.code}>
       <td className={styles.assetCell}><span className={styles.code} style={{'--accent':accents[asset.code]??'#64748b'} as React.CSSProperties}>{asset.code}</span><span className={styles.assetName}>{asset.name}</span></td>
       <td>{asset.price==null?'—':asset.price.toFixed(1)}</td>
       <td>{scoreFor(asset,round-2)??'—'}</td>
       <td>{scoreFor(asset,round-1)??'—'}</td>
       <td className={styles.xpts}>{asset.expectedPoints==null?'—':asset.expectedPoints.toFixed(1)}</td>
       <td title={asset.actualPointsUpdatedAt?'Official points saved '+new Date(asset.actualPointsUpdatedAt).toLocaleString():undefined}>{asset.actualPoints??'—'}</td>
       {buckets.map(b=>{
        const p=probs.get(b)??0;
        const t=thresholdText(asset,b);
        return <td key={b} className={p>=.7?styles.probStrong:p>=.3?styles.probMid:styles.probLow}><b>{pct(p)}</b>{t&&<small>({t})</small>}</td>
       })}
       <td className={(asset.expectedDelta??0)>=0?styles.deltaPos:styles.deltaNeg}>{delta(asset.expectedDelta)}</td>
      </tr>
     })}
     {!filtered.length&&<tr><td colSpan={buckets.length+7} className={styles.empty}>No matching assets</td></tr>}
    </tbody>
   </table>
  </div>
 </div>
}

function teamCodes(team:Pick<BuilderTeam,'drivers'|'constructors'>){
 return new Set([...team.drivers,...team.constructors].map(a=>a.code));
}

function assetDifference(a:Pick<BuilderTeam,'drivers'|'constructors'>,b:Pick<BuilderTeam,'drivers'|'constructors'>){
 const ac=teamCodes(a),bc=teamCodes(b);
 let diff=0;
 for(const code of ac)if(!bc.has(code))diff++;
 for(const code of bc)if(!ac.has(code))diff++;
 return diff/2;
}

function diversifyTeams(teams:BuilderTeam[],minAssetChanges:number,limit=25){
 if(minAssetChanges<=0)return teams.slice(0,limit);
 const selected:BuilderTeam[]=[];
 for(const team of teams){
  if(selected.every(existing=>assetDifference(team,existing)>=minAssetChanges))selected.push(team);
  if(selected.length>=limit)break;
 }
 return selected;
}

function empiricalPairwiseRate(mode:BuilderMode,scoreGap:number){
 if(mode==='custom')return null;
 if(mode==='horizon'){
  if(scoreGap>=40)return null;
  return scoreGap<5?.478:scoreGap<10?.529:scoreGap<20?.705:.786;
 }
 const utilityGap=mode==='points'?scoreGap/20:scoreGap;
 const rates=mode==='points'
  ? [0.509,0.616,0.694]
  : mode==='balanced'
   ? [0.540,0.676,0.733]
   : [0.540,0.666,0.735];
 return rates[utilityGap<0.15?0:utilityGap<0.35?1:2];
}

function confidenceLabel(value:number):'HIGH'|'MEDIUM'|'LOW'{
 return value>=.68?'HIGH':value>=.60?'MEDIUM':'LOW';
}

function calibrateTeamConfidence(teams:BuilderTeam[],mode:BuilderMode){
 const raw=teams.map((team,index)=>{
  if(mode==='custom')return {...team,confidence:null,confidenceLabel:null};
  const lower=teams.slice(index+1);
  if(!lower.length)return {...team,confidence:null,confidenceLabel:null};
  const rates=lower
   .map(other=>empiricalPairwiseRate(mode,Math.max(0,team.score-other.score)))
   .filter((value):value is number=>value!=null);
  const confidence=rates.reduce((s,x)=>s+x,0)/rates.length;
  return {...team,confidence,confidenceLabel:confidenceLabel(confidence)};
 });
 let ceiling=1;
 return raw.map(team=>{
  if(team.confidence==null)return team;
  ceiling=Math.min(ceiling,team.confidence);
  return {...team,confidence:ceiling,confidenceLabel:confidenceLabel(ceiling)};
 });
}

function builderScore(points:number,valueDelta:number,mode:BuilderMode,weight:number){
 if(mode==='points'||mode==='horizon')return points;
 const w=mode==='budget'?.3:mode==='balanced'?.7:Math.max(0,Math.min(1,weight));
 return w*(points/20)+(1-w)*valueDelta;
}

function generateBudgetTeams(
 drivers:MarketAsset[],
 constructors:MarketAsset[],
 budget:number,
 mode:BuilderMode,
 customWeight:number,
 rules:Record<string,AssetRule>,
 limit=50
):BuilderTeam[]{
 const ds=drivers.filter(a=>a.price!=null&&a.expectedPoints!=null&&a.expectedDelta!=null&&rules[a.code]!=='exclude');
 const cs=constructors.filter(a=>a.price!=null&&a.expectedPoints!=null&&a.expectedDelta!=null&&rules[a.code]!=='exclude');
 const requiredDrivers=new Set(drivers.filter(a=>rules[a.code]==='include').map(a=>a.code));
 const requiredConstructors=new Set(constructors.filter(a=>rules[a.code]==='include').map(a=>a.code));
 const teams:BuilderTeam[]=[];

 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructorPair=[cs[a],cs[b]];
  if([...requiredConstructors].some(code=>!constructorPair.some(x=>x.code===code)))continue;
  const constructorPrice=(cs[a].price??0)+(cs[b].price??0);
  if(constructorPrice>budget)continue;

  for(let i=0;i<ds.length-4;i++)
   for(let j=i+1;j<ds.length-3;j++)
    for(let k=j+1;k<ds.length-2;k++)
     for(let l=k+1;l<ds.length-1;l++)
      for(let m=l+1;m<ds.length;m++){
       const driverFive=[ds[i],ds[j],ds[k],ds[l],ds[m]];
       if([...requiredDrivers].some(code=>!driverFive.some(x=>x.code===code)))continue;
       const price=constructorPrice+driverFive.reduce((s,x)=>s+(x.price??0),0);
       if(price>budget+1e-9)continue;

       let expectedPoints=0;
       let boost=driverFive[0];
       let boostPoints=Number(driverFive[0].boostExpectedPoints??driverFive[0].expectedPoints??0);
       if(mode==='horizon'){
        const all=[...constructorPair,...driverFive];
        for(let step=0;step<3;step++){
         expectedPoints+=all.reduce((s,x)=>s+Number(x.horizonPoints?.[step]??0),0);
         const best=driverFive.reduce((cur,x)=>Number(x.horizonPoints?.[step]??-Infinity)>Number(cur.horizonPoints?.[step]??-Infinity)?x:cur);
         expectedPoints+=Number(best.horizonPoints?.[step]??0);
         if(step===0){boost=best;boostPoints=Number(best.horizonPoints?.[step]??0)}
        }
       }else{
        boost=driverFive.reduce((best,x)=>Number(x.boostExpectedPoints??x.expectedPoints??-Infinity)>Number(best.boostExpectedPoints??best.expectedPoints??-Infinity)?x:best);
        boostPoints=Number(boost.boostExpectedPoints??boost.expectedPoints??0);
        expectedPoints=constructorPair.reduce((s,x)=>s+(x.expectedPoints??0),0)+driverFive.reduce((s,x)=>s+(x.expectedPoints??0),0)+boostPoints;
       }

       const expectedDelta=[...constructorPair,...driverFive].reduce((s,x)=>s+(x.expectedDelta??0),0);
       const score=builderScore(expectedPoints,expectedDelta,mode,customWeight);
       teams.push({drivers:driverFive,constructors:constructorPair,boost:boost.code,boostPoints,price,expectedPoints,expectedDelta,score,confidence:null,confidenceLabel:null});
      }
 }

 return teams.sort((x,y)=>y.score-x.score||y.expectedPoints-x.expectedPoints||y.expectedDelta-x.expectedDelta).slice(0,limit);
}
export default function Home(){
 const [data,setData]=useState<MarketResponse|null>(null);
 const [status,setStatus]=useState('Loading market…');
 const [driverQuery,setDriverQuery]=useState('');
 const [constructorQuery,setConstructorQuery]=useState('');
 const [builderBudget,setBuilderBudget]=useState(130);
 const [builderTeams,setBuilderTeams]=useState<BuilderTeam[]>([]);
 const [builderSort,setBuilderSort]=useState<'XPTS'|'DELTA'>('XPTS');
 const [builderSortDir,setBuilderSortDir]=useState<'DESC'|'ASC'>('DESC');
 const [builderStatus,setBuilderStatus]=useState('');
 const [builderMode,setBuilderMode]=useState<BuilderMode>('points');
 const [builderWeight,setBuilderWeight]=useState(.6);
 const [builderRules,setBuilderRules]=useState<Record<string,AssetRule>>({});
 const [builderDiversity,setBuilderDiversity]=useState<0|1|2>(2);
 const [builderConfidenceFilter,setBuilderConfidenceFilter]=useState<'ALL'|'MEDIUM_PLUS'|'HIGH'>('ALL');
 const [weekendContext,setWeekendContext]=useState<{practiceSnapshot:{sessionName:string;drivers:number;sprintQualifyingDrivers:number}|null;weekendNews:{mentions:{code:string|null;places:number|null;status:string;headline:string;sourceUrl:string}[];errors:string[];coverage:string}}|null>(null);
 const [scoresStatus,setScoresStatus]=useState('');
 const [scoresLoading,setScoresLoading]=useState(false);
 const scoresBusy=useRef(false);
 const season=2026,round=17;

 async function load(){
  setStatus('Loading market…');
  try{
   const r=await fetch('/api/market?season='+season+'&round='+round,{cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Market unavailable');
   setData(j);
   setStatus(j.complete?'':('Missing current projections: '+j.incomplete.join(', ')));
  }catch(e){setStatus(e instanceof Error?e.message:'Market unavailable')}
 }

 async function refresh(){
  setStatus('Refreshing xPts + price probabilities…');
  try{
   const r=await fetch('/api/predictions/auto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({season,round})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Prediction refresh failed');
   setWeekendContext(j);
   await load();
  }catch(e){setStatus(e instanceof Error?e.message:'Prediction refresh failed')}
 }

 async function updateOfficialScores(){
  if(scoresBusy.current)return;scoresBusy.current=true;setScoresLoading(true);
  try{const response=await fetch('/api/fantasy-scores/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({season,round})});const result=await response.json();if(!response.ok)throw Error(result.error||'Official results unavailable');
   setScoresStatus(result.errors.length&&result.verified===0?'Official points check failed: source breakdowns unavailable. Saved results retained.':result.status==='WAITING'?'Official points: waiting for the completed race and published totals.':'Official points verified: '+result.verified+'/'+result.total+' · Updated: '+result.saved+' · Corrections: '+result.corrected+(result.errors.length?' · Some official breakdowns are unavailable':''));
   if(result.saved>0)await load();
  }catch(error){setScoresStatus(error instanceof Error?error.message:'Official results unavailable')}finally{scoresBusy.current=false;setScoresLoading(false)}
 }
 useEffect(()=>{let mounted=true;void load().then(()=>{if(mounted)void updateOfficialScores()});const timer=setInterval(()=>{if(document.visibilityState==='visible')void updateOfficialScores()},5*60*1000);return()=>{mounted=false;clearInterval(timer)}},[]);

 const drivers=useMemo(()=>data?.assets.filter(a=>a.type==='DRIVER')??[],[data]);
 const constructors=useMemo(()=>data?.assets.filter(a=>a.type==='CONSTRUCTOR')??[],[data]);
 const visibleBuilderTeams=useMemo(()=>{
  const optimizerRanked=[...builderTeams].sort((a,b)=>b.score-a.score||b.expectedPoints-a.expectedPoints||b.expectedDelta-a.expectedDelta);
  const diversified=diversifyTeams(optimizerRanked,builderDiversity,25);
  const calibrated=calibrateTeamConfidence(diversified,builderMode);
  const filtered=calibrated.filter(team=>{
   if(builderConfidenceFilter==='ALL'||builderMode==='custom')return true;
   if(builderConfidenceFilter==='HIGH')return team.confidenceLabel==='HIGH';
   return team.confidenceLabel==='HIGH'||team.confidenceLabel==='MEDIUM';
  });
  return [...filtered].sort((a,b)=>{
   const av=builderSort==='XPTS'?a.expectedPoints:a.expectedDelta;
   const bv=builderSort==='XPTS'?b.expectedPoints:b.expectedDelta;
   return builderSortDir==='DESC'?bv-av:av-bv;
  });
 },[builderTeams,builderSort,builderSortDir,builderDiversity,builderConfidenceFilter,builderMode]);

 async function buildTeams(){
  if(!data)return;
  if(!Number.isFinite(builderBudget)||builderBudget<=0){setBuilderStatus('Enter a valid budget.');setBuilderTeams([]);return}
  if(!data.complete){setBuilderStatus('Complete market prices and projections first.');setBuilderTeams([]);return}
  const includedDrivers=drivers.filter(a=>builderRules[a.code]==='include').length;
  const includedConstructors=constructors.filter(a=>builderRules[a.code]==='include').length;
  if(includedDrivers>5||includedConstructors>2){setBuilderStatus('Too many required assets: max 5 drivers and 2 constructors.');setBuilderTeams([]);return}

  setBuilderStatus('Generating teams…');
  let builderDrivers=drivers;
  let builderConstructors=constructors;

  if(builderMode==='horizon'){
   try{
    const hr=await fetch('/api/predictions/horizon?season='+season+'&round='+round+'&length=3');
    const hj=await hr.json();
    if(!hr.ok)throw Error(hj.error||'Horizon unavailable');
    const byCode=new Map(hj.assets.map((a:any)=>[a.code,{points:a.rounds.map((r:any)=>r.expectedPoints),valueDelta:a.totalExpectedPriceDelta}]));
    const enrich=(asset:MarketAsset)=>{
     const h=byCode.get(asset.code) as any;
     return {...asset,horizonPoints:h?.points,expectedDelta:h?.valueDelta??asset.expectedDelta};
    };
    builderDrivers=drivers.map(enrich);
    builderConstructors=constructors.map(enrich);
    if([...builderDrivers,...builderConstructors].some(a=>!Array.isArray(a.horizonPoints)||a.horizonPoints.length<3))throw Error('Incomplete 3-GP horizon');
   }catch(e){
    setBuilderStatus(e instanceof Error?e.message:'Horizon unavailable');
    setBuilderTeams([]);
    return;
   }
  }

  setTimeout(()=>{
   const teams=generateBudgetTeams(builderDrivers,builderConstructors,builderBudget,builderMode,builderWeight,builderRules,250);
   setBuilderTeams(teams);
   const diversified=diversifyTeams(teams,builderDiversity,25);
   setBuilderStatus(teams.length?('Generated '+teams.length+' valid top-ranked teams · showing '+diversified.length+' diversified options under '+String.fromCharCode(36)+builderBudget.toFixed(1)+'M'):'No valid teams fit this budget and asset filters.');
  },0);
 }
 function changeBuilderSort(sort:'XPTS'|'DELTA'){
  if(sort===builderSort)setBuilderSortDir(prev=>prev==='DESC'?'ASC':'DESC');
  else{setBuilderSort(sort);setBuilderSortDir('DESC')}
 }

 return <main className={styles.page}>
  <nav className={styles.topbar}>
   <div><span className={styles.brand}>PADDOCK IQ</span><span className={styles.round}>R{data?.round??round} · {season}</span></div>
   <div className={styles.navlinks}><a href="/my-team">My Team</a><a href="/team/import">Team setup</a><button onClick={refresh}>Refresh projections</button><button onClick={updateOfficialScores} disabled={scoresLoading}>{scoresLoading?'Checking official points…':'Update official points'}</button></div>
  </nav>

  <header className={styles.hero}>
   <div>
    <span className={styles.kicker}>F1 FANTASY MARKET BOARD</span>
    <h1>R{round} Price & Points Outlook</h1>
    <p>Official F1 Fantasy prices and R{round-2}/R{round-1} scores · Paddock IQ xPts and price probabilities.</p>
   </div>
   <div className={styles.modelCard}>
    <small>Current models</small>
    <strong>75% calibrated baseline + 25% component simulation</strong>
    <span>Quali · Sprint · race · positions · overtakes · FL · DOTD · pit stops · bounded price model</span>
   </div>
  </header>

  <div className={styles.status}>{status||<>Market complete · {drivers.length} drivers · {constructors.length} constructors</>}</div>

  {scoresStatus&&<div className={styles.status} role="status">{scoresStatus}</div>}

  {weekendContext&&<section className={styles.teamBuilder} aria-label="Weekend information">
   <h2>Before team lock</h2>
   <p>{weekendContext.practiceSnapshot?weekendContext.practiceSnapshot.sessionName+': '+weekendContext.practiceSnapshot.drivers+' drivers · Sprint Qualifying: '+weekendContext.practiceSnapshot.sprintQualifyingDrivers+' drivers':'No completed practice data available'}</p>
   <p>{weekendContext.weekendNews.coverage}</p>
   {weekendContext.weekendNews.mentions.map(m=><p key={m.sourceUrl}><a href={m.sourceUrl} target="_blank" rel="noreferrer">{m.headline}</a> · {m.status==='CONFIRMED'?'Applied: '+m.code+' +'+m.places+' grid places':'Needs confirmation; not applied'}</p>)}
   {weekendContext.weekendNews.mentions.length===0&&<p>No applicable penalty found in the checked headlines.</p>}
   {weekendContext.weekendNews.errors.map(e=><p key={e}>{e}</p>)}
  </section>}

  <section className={styles.searchRow}>
   <label>Find a driver…<input value={driverQuery} onChange={e=>setDriverQuery(e.target.value.toLowerCase())} placeholder="e.g. VER or Norris"/></label>
   <label>Find a constructor…<input value={constructorQuery} onChange={e=>setConstructorQuery(e.target.value.toLowerCase())} placeholder="e.g. MER or Ferrari"/></label>
  </section>

  {data&&<section className={styles.teamBuilder}>
   <div className={styles.teamBuilderHeader}>
    <div>
     <span className={styles.kicker}>TEAM BUILDER</span>
     <h2>Generate teams by budget</h2>
     <p>Build complete 5-driver + 2-constructor lineups using current Paddock IQ xPts and projected price change.</p>
    </div>
    <div className={styles.builderModeBlock}>
     <div className={styles.builderTabs}>{(['points','balanced','budget','custom','horizon'] as const).map(value=><button type="button" key={value} className={builderMode===value?styles.builderTabActive:''} onClick={()=>{setBuilderMode(value);setBuilderTeams([])}}>{value==='horizon'?'3 GP hold':value}</button>)}</div>
     {builderMode==='custom'&&<label className={styles.builderWeight}>Points weight: {Math.round(builderWeight*100)}% · Budget weight: {Math.round((1-builderWeight)*100)}%<input type="range" min="0" max="1" step="0.05" value={builderWeight} onChange={e=>setBuilderWeight(Number(e.target.value))}/></label>}
    </div>
        <div className={styles.teamBuilderControls}>
     <label>Budget, $M<input type="number" min="50" max="200" step="0.1" value={builderBudget} onChange={e=>setBuilderBudget(Number(e.target.value))}/></label>
     <button type="button" onClick={buildTeams}>Generate teams</button>
    </div>
   </div>
   <div className={styles.builderAssetFilters}>
    <div className={styles.builderRuleLegend}><span>Asset filters:</span><b className={styles.ruleInclude}>IN = must use</b><b className={styles.ruleExclude}>OUT = exclude</b><button type="button" onClick={()=>{setBuilderRules({});setBuilderTeams([])}}>Clear</button></div>
    <div className={styles.builderRuleGroup}><strong>Drivers</strong><div>{drivers.map(asset=>{
     const rule=builderRules[asset.code]??'neutral';
     return <button type="button" key={asset.code} className={rule==='include'?styles.ruleIncludeButton:rule==='exclude'?styles.ruleExcludeButton:styles.ruleNeutralButton} onClick={()=>{setBuilderRules(prev=>({...prev,[asset.code]:(prev[asset.code]??'neutral')==='neutral'?'include':prev[asset.code]==='include'?'exclude':'neutral'}));setBuilderTeams([])}}>{asset.code}{rule==='include'?' · IN':rule==='exclude'?' · OUT':''}</button>;
    })}</div></div>
    <div className={styles.builderRuleGroup}><strong>Constructors</strong><div>{constructors.map(asset=>{
     const rule=builderRules[asset.code]??'neutral';
     return <button type="button" key={asset.code} className={rule==='include'?styles.ruleIncludeButton:rule==='exclude'?styles.ruleExcludeButton:styles.ruleNeutralButton} onClick={()=>{setBuilderRules(prev=>({...prev,[asset.code]:(prev[asset.code]??'neutral')==='neutral'?'include':prev[asset.code]==='include'?'exclude':'neutral'}));setBuilderTeams([])}}>{asset.code}{rule==='include'?' · IN':rule==='exclude'?' · OUT':''}</button>;
    })}</div></div>
   </div>
   {builderStatus&&<div className={styles.builderStatus}>{builderStatus}</div>}
   <div className={styles.builderResultControls}>
    <div className={styles.builderControlGroup}><span>Diversity</span>{([0,1,2] as const).map(value=><button type="button" key={value} className={builderDiversity===value?styles.builderControlActive:''} onClick={()=>setBuilderDiversity(value)}>{value===0?'Off':value+' asset'+(value===1?'':'s')}</button>)}</div>
    {builderMode!=='custom'?<div className={styles.builderControlGroup}><span>Confidence</span>
     <button type="button" className={builderConfidenceFilter==='ALL'?styles.builderControlActive:''} onClick={()=>setBuilderConfidenceFilter('ALL')}>All</button>
     <button type="button" className={builderConfidenceFilter==='MEDIUM_PLUS'?styles.builderControlActive:''} onClick={()=>setBuilderConfidenceFilter('MEDIUM_PLUS')}>Medium+</button>
     <button type="button" className={builderConfidenceFilter==='HIGH'?styles.builderControlActive:''} onClick={()=>setBuilderConfidenceFilter('HIGH')}>High only</button>
    </div>:null}
    <small>{builderMode==='custom'?'Empirical lineup confidence is not calibrated for custom mode yet.':builderMode==='horizon'?'3GP confidence = historical pairwise lineup-ranking accuracy by predicted 3GP xPts gap; pairs with gaps ≥40 xPts are not extrapolated.':'Confidence = average historical pairwise ranking accuracy versus the lower-ranked displayed teams. It is not a win probability.'}</small>
   </div>

   {builderTeams.length>0&&<div className={styles.bestTeamsBoard}>
    <div className={styles.bestTeamsScroll}>
     <table className={styles.bestTeamsTable}>
      <thead><tr>
       <th>#</th><th>CR</th><th>DR</th><th>$</th>
       <th><button type="button" className={styles.sortHeaderButton} onClick={()=>changeBuilderSort('DELTA')}>xΔ$ {builderSort==='DELTA'?(builderSortDir==='DESC'?'↓':'↑'):''}</button></th>
       <th><button type="button" className={styles.sortHeaderButton} onClick={()=>changeBuilderSort('XPTS')}>{builderMode==='horizon'?'3GP xPts':'xPts'} {builderSort==='XPTS'?(builderSortDir==='DESC'?'↓':'↑'):''}</button></th>
       <th>Confidence</th>
      </tr></thead>
      <tbody>{visibleBuilderTeams.slice(0,25).map((team,index)=><tr key={team.constructors.map(a=>a.code).join('-')+'-'+team.drivers.map(a=>a.code).join('-')}>
       <td><strong>{index+1}</strong></td>
       <td><div className={styles.teamAssetGroup}>{team.constructors.map(a=><span key={a.code} className={styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as React.CSSProperties}><b>{a.code}</b><small>{(builderMode==='horizon'?Number(a.horizonPoints?.[0]??0):Number(a.expectedPoints??0)).toFixed(1)} xPts · &#36;{Number(a.price??0).toFixed(1)} · {(Number(a.expectedDelta??0)>=0?'+':'')+Number(a.expectedDelta??0).toFixed(2)}</small></span>)}</div></td>
       <td><div className={styles.teamAssetGroup}>{team.drivers.map(a=><span key={a.code} className={styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as React.CSSProperties}><b>{a.code}{a.code===team.boost?<em className={styles.x2Badge} title={builderMode==='horizon'?'Projected first-round x2 score':'Calibrated x2 score: '+team.boostPoints.toFixed(1)}>x2 {team.boostPoints.toFixed(1)}</em>:null}</b><small>{(builderMode==='horizon'?Number(a.horizonPoints?.[0]??0):Number(a.expectedPoints??0)).toFixed(1)} xPts · &#36;{Number(a.price??0).toFixed(1)} · {(Number(a.expectedDelta??0)>=0?'+':'')+Number(a.expectedDelta??0).toFixed(2)}</small></span>)}</div></td>
       <td><strong>{team.price.toFixed(1)}</strong></td>
       <td className={team.expectedDelta>=0?styles.teamDeltaPos:styles.teamDeltaNeg}>{team.expectedDelta>=0?'+':''}{team.expectedDelta.toFixed(2)}</td>
       <td><strong>{team.expectedPoints.toFixed(1)}</strong></td>
       <td>{team.confidenceLabel&&team.confidence!=null?<span className={team.confidenceLabel==='HIGH'?styles.confHigh:team.confidenceLabel==='MEDIUM'?styles.confMedium:styles.confLow} title="Average historical pairwise ranking accuracy versus lower-ranked displayed teams; not a win probability">{team.confidenceLabel} · {Math.round(team.confidence*100)}%</span>:'—'}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </div>}
  </section>}

  {data&&<div className={styles.grid}>
   <section>
    <div className={styles.sectionHeading}><h2>Drivers</h2><span>{drivers.length} active</span></div>
    <Board title="Drivers" tier="A" assets={drivers} round={round} query={driverQuery}/>
    <Board title="Drivers" tier="B" assets={drivers} round={round} query={driverQuery}/>
   </section>
   <section>
    <div className={styles.sectionHeading}><h2>Constructors</h2><span>{constructors.length} active</span></div>
    <Board title="Constructors" tier="A" assets={constructors} round={round} query={constructorQuery}/>
    <Board title="Constructors" tier="B" assets={constructors} round={round} query={constructorQuery}/>
   </section>
  </div>}

  <footer className={styles.footer}>
   <span>Historical scores & prices: official F1 Fantasy round feeds.</span>
   <span>xPts/odds: Paddock IQ models — expected values, not official F1 projections.</span>
  </footer>
 </main>
}
