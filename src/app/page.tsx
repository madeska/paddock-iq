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

const accents:Record<string,string>={
 VER:'#2658ff',RUS:'#08c9bd',ANT:'#20d2bf',LEC:'#f04545',HAM:'#ef4438',PIA:'#ff9f1a',NOR:'#ff9c18',
 HAD:'#263cff',HUL:'#ff592f',LIN:'#5c7df7',BOT:'#777d89',BEA:'#f2f2f2',PER:'#d9d9d9',STR:'#18aa9b',
 OCO:'#f5f5f5',LAW:'#7289ff',BOR:'#ff4b1f',SAI:'#1678ff',COL:'#ef73c6',ALB:'#237cf2',GAS:'#e36cae',ALO:'#26b7a2',
 RBR:'#2347ff',FER:'#ef4444',MER:'#20bfc0',MCL:'#ff9c18',ALP:'#d57cac',AUD:'#9b5d35',RB:'#5b77ee',
 HAS:'#e8e8e8',CAD:'#a9a9a9',WIL:'#2188ff',AST:'#159a89'
};

const pct=(v:number|null)=>v==null?'—':Math.round(v*100)+'%';
const money=(v:number|null)=>v==null?'—':'$'+Number(v.toFixed(2))+'M';
const delta=(v:number|null)=>v==null?'—':(v>0?'+':'')+v.toFixed(2);

function scoreFor(asset:MarketAsset,round:number){
 return asset.recentFantasyScores.find(s=>s.round===round)?.points;
}

function bucketProbabilities(asset:MarketAsset){
 const raw=[
  {delta:asset.price!=null&&asset.price>=18.5?-.3:-.6,p:asset.probabilityMaxFall??0,key:'maxFall'},
  {delta:asset.price!=null&&asset.price>=18.5?-.1:-.2,p:asset.probabilitySmallFall??0,key:'smallFall'},
  {delta:asset.price!=null&&asset.price>=18.5?.1:.2,p:asset.probabilitySmallRise??0,key:'smallRise'},
  {delta:asset.price!=null&&asset.price>=18.5?.3:.6,p:asset.probabilityMaxRise??0,key:'maxRise'},
 ] as const;
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

export default function Home(){
 const [data,setData]=useState<MarketResponse|null>(null);
 const [status,setStatus]=useState('Loading market…');
 const [driverQuery,setDriverQuery]=useState('');
 const [constructorQuery,setConstructorQuery]=useState('');
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
