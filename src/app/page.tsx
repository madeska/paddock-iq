'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './market-dashboard.module.css';

type Score={round:number;points:number;name:string};
type MarketAsset={
 code:string;name:string;type:'DRIVER'|'CONSTRUCTOR';price:number|null;
 expectedPoints:number|null;expectedDelta:number|null;
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
type BuilderTeam={
 drivers:MarketAsset[];
 constructors:MarketAsset[];
 boost:string;
 price:number;
 expectedPoints:number;
 expectedDelta:number;
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
 const out=new Map<number,number>();
 for(const item of raw){
  const d=item.delta<0?Math.max(item.delta,floorDelta):item.delta;
  out.set(d,(out.get(d)??0)+item.p);
 }
 if(asset.probabilityFlat!=null&&asset.probabilityFlat>0&&!out.has(0))out.set(0,asset.probabilityFlat);
 return out;
}

function thresholdText(asset:MarketAsset,bucket:number){
 const tierA=(asset.price??0)>=18.5;
 if(bucket===(tierA?-.3:-.6)&&asset.requiredPointsAvoidMaxFall!=null)return '≤'+asset.requiredPointsAvoidMaxFall.toFixed(0);
 if(bucket===(tierA?-.1:-.2)&&asset.requiredPointsSmallRise!=null)return '<'+asset.requiredPointsSmallRise.toFixed(0);
 if(bucket===(tierA?.1:.2)&&asset.requiredPointsMaxRise!=null)return '<'+asset.requiredPointsMaxRise.toFixed(0);
 if(bucket===(tierA?.3:.6)&&asset.requiredPointsMaxRise!=null)return '≥'+asset.requiredPointsMaxRise.toFixed(0);
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
       {buckets.map(b=>{
        const p=probs.get(b)??0;
        const t=thresholdText(asset,b);
        return <td key={b} className={p>=.7?styles.probStrong:p>=.3?styles.probMid:styles.probLow}><b>{pct(p)}</b>{t&&<small>({t})</small>}</td>
       })}
       <td className={(asset.expectedDelta??0)>=0?styles.deltaPos:styles.deltaNeg}>{delta(asset.expectedDelta)}</td>
      </tr>
     })}
     {!filtered.length&&<tr><td colSpan={buckets.length+6} className={styles.empty}>No matching assets</td></tr>}
    </tbody>
   </table>
  </div>
 </div>
}

function generateBudgetTeams(drivers:MarketAsset[],constructors:MarketAsset[],budget:number,limit=50):BuilderTeam[]{
 const ds=drivers.filter(a=>a.price!=null&&a.expectedPoints!=null&&a.expectedDelta!=null);
 const cs=constructors.filter(a=>a.price!=null&&a.expectedPoints!=null&&a.expectedDelta!=null);
 const teams:BuilderTeam[]=[];

 for(let a=0;a<cs.length-1;a++)for(let b=a+1;b<cs.length;b++){
  const constructorPair=[cs[a],cs[b]];
  const constructorPrice=(cs[a].price??0)+(cs[b].price??0);
  const constructorPoints=(cs[a].expectedPoints??0)+(cs[b].expectedPoints??0);
  const constructorDelta=(cs[a].expectedDelta??0)+(cs[b].expectedDelta??0);
  if(constructorPrice>budget)continue;

  for(let i=0;i<ds.length-4;i++)
   for(let j=i+1;j<ds.length-3;j++)
    for(let k=j+1;k<ds.length-2;k++)
     for(let l=k+1;l<ds.length-1;l++)
      for(let m=l+1;m<ds.length;m++){
       const driverFive=[ds[i],ds[j],ds[k],ds[l],ds[m]];
       const driverPrice=driverFive.reduce((s,x)=>s+(x.price??0),0);
       const price=constructorPrice+driverPrice;
       if(price>budget+1e-9)continue;
       const boost=driverFive.reduce((best,x)=>(x.expectedPoints??-Infinity)>(best.expectedPoints??-Infinity)?x:best);
       const expectedPoints=constructorPoints+driverFive.reduce((s,x)=>s+(x.expectedPoints??0),0)+(boost.expectedPoints??0);
       const expectedDelta=constructorDelta+driverFive.reduce((s,x)=>s+(x.expectedDelta??0),0);
       teams.push({drivers:driverFive,constructors:constructorPair,boost:boost.code,price,expectedPoints,expectedDelta});
      }
 }

 return teams.sort((x,y)=>y.expectedPoints-x.expectedPoints||y.expectedDelta-x.expectedDelta||y.price-x.price).slice(0,limit);
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
 const season=2026,round=16;

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
   await load();
  }catch(e){setStatus(e instanceof Error?e.message:'Prediction refresh failed')}
 }

 useEffect(()=>{load()},[]);

 const drivers=useMemo(()=>data?.assets.filter(a=>a.type==='DRIVER')??[],[data]);
 const constructors=useMemo(()=>data?.assets.filter(a=>a.type==='CONSTRUCTOR')??[],[data]);
 const visibleBuilderTeams=useMemo(()=>[...builderTeams].sort((a,b)=>{
  const av=builderSort==='XPTS'?a.expectedPoints:a.expectedDelta;
  const bv=builderSort==='XPTS'?b.expectedPoints:b.expectedDelta;
  return builderSortDir==='DESC'?bv-av:av-bv;
 }),[builderTeams,builderSort,builderSortDir]);

 function buildTeams(){
  if(!data)return;
  if(!Number.isFinite(builderBudget)||builderBudget<=0){setBuilderStatus('Enter a valid budget.');setBuilderTeams([]);return}
  if(!data.complete){setBuilderStatus('Complete market prices and projections first.');setBuilderTeams([]);return}
  setBuilderStatus('Generating teams…');
  setTimeout(()=>{
   const teams=generateBudgetTeams(drivers,constructors,builderBudget,50);
   setBuilderTeams(teams);
   setBuilderStatus(teams.length?('Showing top '+teams.length+' teams under $'+builderBudget.toFixed(1)+'M'):'No valid teams fit this budget.');
  },0);
 }

 function changeBuilderSort(sort:'XPTS'|'DELTA'){
  if(sort===builderSort)setBuilderSortDir(prev=>prev==='DESC'?'ASC':'DESC');
  else{setBuilderSort(sort);setBuilderSortDir('DESC')}
 }

 return <main className={styles.page}>
  <nav className={styles.topbar}>
   <div><span className={styles.brand}>PADDOCK IQ</span><span className={styles.round}>{data?.grandPrix??'R16'} · 2026</span></div>
   <div className={styles.navlinks}><a href="/my-team">My Team</a><a href="/team/import">Team setup</a><button onClick={refresh}>Refresh projections</button></div>
  </nav>

  <header className={styles.hero}>
   <div>
    <span className={styles.kicker}>F1 FANTASY MARKET BOARD</span>
    <h1>R{round} Price & Points Outlook</h1>
    <p>Official F1 Fantasy prices and R{round-2}/R{round-1} scores · Paddock IQ xPts and price probabilities.</p>
   </div>
   <div className={styles.modelCard}>
    <small>Current models</small>
    <strong>Driver ridge50 · Constructor hybrid</strong>
    <span>Price model v0.3 · floor-aware</span>
   </div>
  </header>

  <div className={styles.status}>{status||<>Market complete · {drivers.length} drivers · {constructors.length} constructors</>}</div>

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
    <div className={styles.teamBuilderControls}>
     <label>Budget, $M<input type="number" min="50" max="200" step="0.1" value={builderBudget} onChange={e=>setBuilderBudget(Number(e.target.value))}/></label>
     <button type="button" onClick={buildTeams}>Generate teams</button>
    </div>
   </div>
   {builderStatus&&<div className={styles.builderStatus}>{builderStatus}</div>}
   {builderTeams.length>0&&<div className={styles.bestTeamsBoard}>
    <div className={styles.bestTeamsScroll}>
     <table className={styles.bestTeamsTable}>
      <thead><tr>
       <th>#</th><th>CR</th><th>DR</th><th>$</th>
       <th><button type="button" className={styles.sortHeaderButton} onClick={()=>changeBuilderSort('DELTA')}>xΔ$ {builderSort==='DELTA'?(builderSortDir==='DESC'?'↓':'↑'):''}</button></th>
       <th><button type="button" className={styles.sortHeaderButton} onClick={()=>changeBuilderSort('XPTS')}>xPts {builderSort==='XPTS'?(builderSortDir==='DESC'?'↓':'↑'):''}</button></th>
      </tr></thead>
      <tbody>{visibleBuilderTeams.slice(0,25).map((team,index)=><tr key={team.constructors.map(a=>a.code).join('-')+'-'+team.drivers.map(a=>a.code).join('-')}>
       <td><strong>{index+1}</strong></td>
       <td><div className={styles.teamAssetGroup}>{team.constructors.map(a=><span key={a.code} className={styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as React.CSSProperties}><b>{a.code}</b><small>{Number(a.expectedPoints??0).toFixed(1)} xPts · {'$'}{Number(a.price??0).toFixed(1)} · {(Number(a.expectedDelta??0)>=0?'+':'')+Number(a.expectedDelta??0).toFixed(2)}</small></span>)}</div></td>
       <td><div className={styles.teamAssetGroup}>{team.drivers.map(a=><span key={a.code} className={styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as React.CSSProperties}><b>{a.code}{a.code===team.boost?<em className={styles.x2Badge}>x2</em>:null}</b><small>{Number(a.expectedPoints??0).toFixed(1)} xPts · {'$'}{Number(a.price??0).toFixed(1)} · {(Number(a.expectedDelta??0)>=0?'+':'')+Number(a.expectedDelta??0).toFixed(2)}</small></span>)}</div></td>
       <td><strong>{team.price.toFixed(1)}</strong></td>
       <td className={team.expectedDelta>=0?styles.teamDeltaPos:styles.teamDeltaNeg}>{team.expectedDelta>=0?'+':''}{team.expectedDelta.toFixed(2)}</td>
       <td><strong>{team.expectedPoints.toFixed(1)}</strong></td>
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
