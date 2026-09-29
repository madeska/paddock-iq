'use client';

import { useState, type CSSProperties } from 'react';
import { type Mode } from '../../lib/optimizer';
import styles from '../market-dashboard.module.css';

type Score = { round: number; name: string; points: number };
type Asset = {
  code: string; name: string; type: string; isDoubled: boolean;
  price: number | null; expectedPoints: number | null; expectedDelta: number | null; modelVersion: string | null;
  probabilityMaxRise: number | null; probabilitySmallRise: number | null;
  probabilitySmallFall: number | null; probabilityMaxFall: number | null; probabilityFlat: number | null;
  requiredPointsMaxRise: number | null; requiredPointsSmallRise: number | null; requiredPointsAvoidMaxFall: number | null;
  mostLikelyDelta: number | null; mostLikelyProbability: number | null;
  recentFantasyScores: Score[];
};
type Data = {
  user: { name: string | null; email: string };
  teams: { id: string; name: string }[];
  team: { name: string; season: number };
  snapshot: {
    grandPrix: { round: number; name: string };
    cashBalance: number | null; freeTransfers: number | null; totalPoints: number | null;
    assets: Asset[]; chips: { code: string; status: string }[];
  };
};

const pct = (value: number | null) => value == null ? '—' : Math.round(value * 100) + '%';
const fmtDelta = (value: number | null) => value == null ? '—' : (value > 0 ? '+' : '') + value.toFixed(2) + 'M';

const accents: Record<string,string> = {
  VER:'#2658ff',RUS:'#08c9bd',ANT:'#20d2bf',LEC:'#f04545',HAM:'#ef4438',PIA:'#ff9f1a',NOR:'#ff9c18',
  HAD:'#263cff',HUL:'#ff592f',LIN:'#5c7df7',BOT:'#777d89',BEA:'#f2f2f2',PER:'#d9d9d9',STR:'#18aa9b',
  OCO:'#f5f5f5',LAW:'#7289ff',BOR:'#ff4b1f',SAI:'#1678ff',COL:'#ef73c6',ALB:'#237cf2',GAS:'#e36cae',ALO:'#26b7a2',
  RBR:'#2347ff',FER:'#ef4444',MER:'#20bfc0',MCL:'#ff9c18',ALP:'#d57cac',AUD:'#9b5d35',RB:'#5b77ee',
  HAS:'#e8e8e8',CAD:'#a9a9a9',WIL:'#2188ff',AST:'#159a89'
};

function teamBucketProbabilities(asset: Asset) {
  if (asset.price == null) return new Map<number,number>();
  const tierA = asset.price >= 18.5;
  const raw = [
    { delta: tierA ? -.3 : -.6, p: asset.probabilityMaxFall ?? 0 },
    { delta: tierA ? -.1 : -.2, p: asset.probabilitySmallFall ?? 0 },
    { delta: tierA ? .1 : .2, p: asset.probabilitySmallRise ?? 0 },
    { delta: tierA ? .3 : .6, p: asset.probabilityMaxRise ?? 0 },
  ];
  const floorDelta = Math.round((3 - asset.price) * 100) / 100;
  const out = new Map<number,number>();
  for (const item of raw) {
    const d = item.delta < 0 ? Math.max(item.delta, floorDelta) : item.delta;
    out.set(d, (out.get(d) ?? 0) + item.p);
  }
  if ((asset.probabilityFlat ?? 0) > 0 && !out.has(0)) out.set(0, asset.probabilityFlat ?? 0);
  return out;
}

function teamThresholdText(asset: Asset, bucket: number) {
  if (asset.price == null) return '';
  const tierA = asset.price >= 18.5;
  if (bucket === (tierA ? -.3 : -.6) && asset.requiredPointsAvoidMaxFall != null) return '≤' + asset.requiredPointsAvoidMaxFall.toFixed(0);
  if (bucket === (tierA ? -.1 : -.2) && asset.requiredPointsSmallRise != null) return '<' + asset.requiredPointsSmallRise.toFixed(0);
  if (bucket === (tierA ? .1 : .2) && asset.requiredPointsMaxRise != null) return '<' + asset.requiredPointsMaxRise.toFixed(0);
  if (bucket === (tierA ? .3 : .6) && asset.requiredPointsMaxRise != null) return '≥' + asset.requiredPointsMaxRise.toFixed(0);
  return '';
}

function scoreAt(asset: Asset, round: number) {
  return asset.recentFantasyScores.find((score) => score.round === round)?.points;
}

function TeamMarketBoard({title,tier,assets,round,locked,onToggleLock}:{title:string;tier:'A'|'B';assets:Asset[];round:number;locked:string[];onToggleLock:(code:string)=>void}) {
  const filtered = assets
    .filter((asset) => asset.price != null && ((asset.price >= 18.5) === (tier === 'A')))
    .sort((a,b) => (b.expectedDelta ?? -99) - (a.expectedDelta ?? -99));
  if (!filtered.length) return null;
  const buckets = tier === 'A' ? [-.3,-.1,.1,.3] : [-.6,-.2,0,.2,.6];

  return <div className={styles.board}>
    <div className={styles.tierTitle}><strong>{title} · Tier {tier}</strong><span>{tier === 'A' ? '≥ $18.5M' : '< $18.5M'}</span></div>
    <div className={styles.scroll}><table className={styles.marketTable}>
      <thead><tr>
        <th className={styles.assetCol}>{title === 'Drivers' ? 'DR' : 'CR'}</th>
        <th>$</th>
        <th>R{round-2}<small>Pts</small></th>
        <th>R{round-1}<small>Pts</small></th>
        <th>R{round}<small>xPts</small></th>
        {buckets.map((bucket) => <th key={bucket} className={bucket < 0 ? styles.negHead : bucket > 0 ? styles.posHead : styles.flatHead}>{bucket > 0 ? '+' : ''}{bucket.toFixed(1)}<small>Odds (pts)</small></th>)}
        <th>R{round}<small>xΔ$</small></th>
      </tr></thead>
      <tbody>{filtered.map((asset) => {
        const probs = teamBucketProbabilities(asset);
        return <tr key={asset.code}>
          <td className={styles.assetCell}>
            <span className={styles.code} style={{'--accent':accents[asset.code] ?? '#64748b'} as CSSProperties}>{asset.code}</span>
            <span className={styles.assetName}>{asset.name}{asset.isDoubled ? ' · 2×' : ''}</span>
            <button type="button" className={styles.lockChip} title={locked.includes(asset.code) ? 'Unlock asset' : 'Lock asset'} onClick={() => onToggleLock(asset.code)}>{locked.includes(asset.code) ? '🔒' : '○'}</button>
          </td>
          <td>{asset.price?.toFixed(1) ?? '—'}</td>
          <td>{scoreAt(asset,round-2) ?? '—'}</td>
          <td>{scoreAt(asset,round-1) ?? '—'}</td>
          <td className={styles.xpts}>{asset.expectedPoints == null ? '—' : asset.expectedPoints.toFixed(1)}</td>
          {buckets.map((bucket) => {
            const p = probs.get(bucket) ?? 0;
            const threshold = teamThresholdText(asset,bucket);
            return <td key={bucket} className={p >= .7 ? styles.probStrong : p >= .3 ? styles.probMid : styles.probLow}><b>{pct(p)}</b>{threshold && <small>({threshold})</small>}</td>;
          })}
          <td className={(asset.expectedDelta ?? 0) >= 0 ? styles.deltaPos : styles.deltaNeg}>{asset.expectedDelta == null ? '—' : (asset.expectedDelta > 0 ? '+' : '') + asset.expectedDelta.toFixed(2)}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}


const scenarioKey = (scenario:any) => [scenario.out?.join(','),scenario.incoming?.join(','),scenario.recommendedBoost ?? ''].join('>');

type TeamViewAsset = {code:string;type:string;price:number;expectedDelta:number;expectedPoints?:number;horizonPoints?:number[];isDoubled?:boolean};
type TeamView = {assets:TeamViewAsset[];boost:string|null;price:number;expectedDelta:number;expectedPoints:number;penalty:number};

function buildTeamView(current:any[],market:any[],scenario:any,horizon:boolean):TeamView{
  const byCode=new Map([...current,...market].map((a:any)=>[a.code,a]));
  const outgoing=new Set<string>(scenario?.out??[]);
  const lineupCodes=[
    ...current.filter((a:any)=>!outgoing.has(a.code)).map((a:any)=>a.code),
    ...(scenario?.incoming??[])
  ];
  const assets=lineupCodes.map((code:string)=>byCode.get(code)).filter(Boolean) as TeamViewAsset[];
  const price=assets.reduce((s,a)=>s+Number(a.price??0),0);
  const expectedDelta=assets.reduce((s,a)=>s+Number(a.expectedDelta??0),0);
  const penalty=Number(scenario?.penalty??0);
  let expectedPoints=0;
  if(horizon){
    const steps=Math.min(3,...assets.map(a=>Array.isArray(a.horizonPoints)?a.horizonPoints.length:0));
    for(let step=0;step<steps;step++){
      expectedPoints+=assets.reduce((s,a)=>s+Number(a.horizonPoints?.[step]??0),0);
      const drivers=assets.filter(a=>a.type==='DRIVER');
      if(drivers.length)expectedPoints+=Math.max(...drivers.map(a=>Number(a.horizonPoints?.[step]??0)));
    }
  }else{
    expectedPoints=assets.reduce((s,a)=>s+Number(a.expectedPoints??0),0);
    const boost=scenario?.recommendedBoost ? byCode.get(scenario.recommendedBoost) : null;
    expectedPoints+=Number(boost?.expectedPoints??0);
  }
  return {assets,boost:scenario?.recommendedBoost??null,price,expectedDelta,expectedPoints:expectedPoints-penalty,penalty};
}

function buildCurrentTeamView(current:any[],horizon:boolean):TeamView{
  const assets=current as TeamViewAsset[];
  const price=assets.reduce((s,a)=>s+Number(a.price??0),0);
  const expectedDelta=assets.reduce((s,a)=>s+Number(a.expectedDelta??0),0);
  const currentBoost=assets.find(a=>a.type==='DRIVER'&&a.isDoubled)??null;
  let expectedPoints=0;
  if(horizon){
    const steps=Math.min(3,...assets.map(a=>Array.isArray(a.horizonPoints)?a.horizonPoints.length:0));
    for(let step=0;step<steps;step++){
      expectedPoints+=assets.reduce((s,a)=>s+Number(a.horizonPoints?.[step]??0),0);
      const drivers=assets.filter(a=>a.type==='DRIVER');
      const boost=step===0&&currentBoost?currentBoost:(drivers.length?drivers.reduce((best,a)=>Number(a.horizonPoints?.[step]??-Infinity)>Number(best.horizonPoints?.[step]??-Infinity)?a:best):null);
      expectedPoints+=Number(boost?.horizonPoints?.[step]??0);
    }
  }else{
    expectedPoints=assets.reduce((s,a)=>s+Number(a.expectedPoints??0),0)+Number(currentBoost?.expectedPoints??0);
  }
  return {assets,boost:currentBoost?.code??null,price,expectedDelta,expectedPoints,penalty:0};
}

export default function MyTeam() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<Mode | 'horizon'>('balanced');
  const [customWeight, setCustomWeight] = useState(0.6);
  const [recs, setRecs] = useState<any[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL'|'MEDIUM_PLUS'|'HIGH'>('ALL');
  const [currentTeamView, setCurrentTeamView] = useState<TeamView | null>(null);
  const [possibleTeamsSort, setPossibleTeamsSort] = useState<'XPTS'|'DELTA'>('XPTS');
  const [possibleTeamsSortDir, setPossibleTeamsSortDir] = useState<'ASC'|'DESC'>('DESC');

  async function load() {
    setStatus('Loading…');
    try {
      const response = await fetch('/api/team?email=' + encodeURIComponent(email));
      const json = await response.json();
      if (!response.ok) throw Error(json.error || 'Load failed');
      setData(json); setLocked((prev) => prev.filter((code) => json.snapshot.assets.some((a: Asset) => a.code === code))); setStatus('');
    } catch (error) {
      setData(null); setStatus(error instanceof Error ? error.message : 'Load failed');
    }
  }

  async function generatePredictions() {
    if (!data) return;
    setStatus('Generating xPts + price probabilities…');
    try {
      const response = await fetch('/api/predictions/auto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: data.team.season, round: data.snapshot.grandPrix.round }),
      });
      const json = await response.json();
      if (!response.ok) throw Error(json.error || 'Prediction failed');
      setStatus('Generated ' + json.created + ' predictions. Reloading team…');
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Prediction failed');
    }
  }

  async function optimize() {
    if (!data) return;
    setStatus('Calculating…');
    try {
      const marketResponse = await fetch('/api/market?season=' + data.team.season + '&round=' + data.snapshot.grandPrix.round);
      const marketJson = await marketResponse.json();
      if (!marketResponse.ok) throw Error(marketJson.error || 'Market unavailable');
      const current = data.snapshot.assets.map((asset) => ({
        code: asset.code, type: asset.type, price: asset.price,
        expectedPoints: asset.expectedPoints, expectedDelta: asset.expectedDelta, isDoubled: asset.isDoubled,
      }));
      const owned = new Set(current.map((asset) => asset.code));
      const market = marketJson.assets.filter((asset: any) => !owned.has(asset.code));
      if ([...current, ...market].some((asset: any) => asset.price == null || asset.expectedPoints == null || asset.expectedDelta == null))
        throw Error('Complete market prices and predictions first.');
      let endpoint='/api/optimize';
      let optimizeCurrent=current;
      let optimizeMarket=market;
      if(mode==='horizon'){
        const hr=await fetch('/api/predictions/horizon?season='+data.team.season+'&round='+data.snapshot.grandPrix.round+'&length=3');
        const hj=await hr.json();
        if(!hr.ok)throw Error(hj.error||'Horizon unavailable');
        const byCode=new Map(hj.assets.map((a:any)=>[a.code,{points:a.rounds.map((r:any)=>r.expectedPoints),valueDelta:a.totalExpectedPriceDelta}]));
        optimizeCurrent=current.map((a:any)=>{const h=byCode.get(a.code) as any;return {...a,horizonPoints:h?.points,expectedDelta:h?.valueDelta??a.expectedDelta}});
        optimizeMarket=market.map((a:any)=>{const h=byCode.get(a.code) as any;return {...a,horizonPoints:h?.points,expectedDelta:h?.valueDelta??a.expectedDelta}});
        if([...optimizeCurrent,...optimizeMarket].some((a:any)=>!Array.isArray(a.horizonPoints)||a.horizonPoints.length<3))throw Error('Incomplete 3-GP horizon');
        endpoint='/api/optimize/horizon';
      }
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: optimizeCurrent, market: optimizeMarket, cash: data.snapshot.cashBalance ?? 0, freeTransfers: data.snapshot.freeTransfers ?? 0, mode: mode==='horizon'?'points':mode, weight: customWeight, maxChanges: 3, locked }),
      });
      const json = await response.json();
      if (!response.ok) throw Error(json.error || 'Optimization failed');
      const scenarios = Array.isArray(json.scenarios) ? json.scenarios : Array.isArray(json.proposals) ? json.proposals : Array.isArray(json) ? json : [];
      const horizonMode=mode==='horizon';
      const enriched=scenarios.map((scenario:any)=>({...scenario,teamView:buildTeamView(optimizeCurrent,optimizeMarket,scenario,horizonMode)}));
      setCurrentTeamView(buildCurrentTeamView(optimizeCurrent,horizonMode));
      setRecs(enriched); setStatus(enriched.length ? '' : 'No valid transfer scenarios found.');
    } catch (error) {
      setRecs([]); setStatus(error instanceof Error ? error.message : 'Optimization failed');
    }
  }

  const visibleRecs = recs.filter((scenario:any) => {
    if (scenario.transfers === 0) return true;
    if (confidenceFilter === 'ALL') return true;
    if (confidenceFilter === 'HIGH') return scenario.transferConfidence === 'HIGH';
    return scenario.transferConfidence === 'HIGH' || scenario.transferConfidence === 'MEDIUM';
  });
  const ownedCodes = new Set(currentTeamView?.assets.map((asset) => asset.code) ?? []);
  const possibleTeamRows = visibleRecs
    .filter((scenario:any) => scenario.transfers > 0)
    .sort((a:any,b:any) => {
      const av = possibleTeamsSort === 'XPTS' ? Number(a.teamView?.expectedPoints ?? -Infinity) : Number(a.teamView?.expectedDelta ?? -Infinity);
      const bv = possibleTeamsSort === 'XPTS' ? Number(b.teamView?.expectedPoints ?? -Infinity) : Number(b.teamView?.expectedDelta ?? -Infinity);
      return possibleTeamsSortDir === 'DESC' ? bv-av : av-bv;
    });
  const changePossibleTeamsSort = (sort:'XPTS'|'DELTA') => {
    if (sort === possibleTeamsSort) setPossibleTeamsSortDir((prev) => prev === 'DESC' ? 'ASC' : 'DESC');
    else {
      setPossibleTeamsSort(sort);
      setPossibleTeamsSortDir('DESC');
    }
  };

  return (
    <main>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:18}}>
        <a href="/" style={{textDecoration:'none'}}>← Market Board</a>
        <a href="/team/import" style={{textDecoration:'none'}}>Team setup</a>
      </nav>
      <header>
        <span className="eyebrow">PADDOCK IQ · DATABASE TEAM</span>
        <h1>My Team</h1>
        <p>Actual F1 Fantasy history + Paddock IQ projections.</p>
      </header>
      <section>
        <div className="inputs"><label>Paddock IQ email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label></div>
        <button onClick={load}>Load my team</button>{' '}<a href="/team/import">Create / update team</a>
        <p className="notice">{status}</p>
      </section>
      {data && <>
        <section>
          <h2>{data.team.name} · {data.team.season}</h2>
          <div className="stats">
            <article><small>GP</small><strong>{data.snapshot.grandPrix.name}</strong></article>
            <article><small>Points</small><strong>{data.snapshot.totalPoints ?? '—'}</strong></article>
            <article><small>Cash</small><strong>{data.snapshot.cashBalance == null ? '—' : '$' + data.snapshot.cashBalance + 'M'}</strong></article>
            <article><small>Free transfers</small><strong>{data.snapshot.freeTransfers ?? '—'}</strong></article>
          </div>
        </section>
        <section>
          <div className={styles.sectionHeading}><h2>Lineup</h2><span>{data.snapshot.assets.length} assets · same format as Market Board</span></div>
          <TeamMarketBoard title="Drivers" tier="A" assets={data.snapshot.assets.filter((asset) => asset.type === 'DRIVER')} round={data.snapshot.grandPrix.round} locked={locked} onToggleLock={(code) => setLocked((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code])}/>
          <TeamMarketBoard title="Drivers" tier="B" assets={data.snapshot.assets.filter((asset) => asset.type === 'DRIVER')} round={data.snapshot.grandPrix.round} locked={locked} onToggleLock={(code) => setLocked((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code])}/>
          <TeamMarketBoard title="Constructors" tier="A" assets={data.snapshot.assets.filter((asset) => asset.type === 'CONSTRUCTOR')} round={data.snapshot.grandPrix.round} locked={locked} onToggleLock={(code) => setLocked((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code])}/>
          <TeamMarketBoard title="Constructors" tier="B" assets={data.snapshot.assets.filter((asset) => asset.type === 'CONSTRUCTOR')} round={data.snapshot.grandPrix.round} locked={locked} onToggleLock={(code) => setLocked((prev) => prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code])}/>
          <p><small>Forecast model: driver ridge50 / constructor hybrid · price probabilities v0.3 floor-aware.</small></p>
        </section>
        <section>
          <h2>Strategy optimizer</h2>
          <p><button onClick={generatePredictions}>Generate / refresh xPts + price probabilities</button></p>
          <div className="tabs">{(['points','balanced','budget','custom','horizon'] as const).map((value) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value as Mode | 'horizon')}>{value === 'horizon' ? '3 GP hold' : value}</button>)}</div>
          {mode === 'horizon' && <p><small>3 GP hold = projected R16–R18 points if you make transfers now and hold the lineup. Sprint-format correction is applied; future transfers and circuit/weather/news modifiers are not simulated. Historical single-asset forecast RMSE is roughly 16 pts for drivers and 21–22 pts for constructors, so treat small differences between scenarios cautiously.</small></p>}
          {mode === 'custom' && <div className="inputs"><label>Points weight: {Math.round(customWeight * 100)}% · Budget weight: {Math.round((1-customWeight) * 100)}%<input type="range" min="0" max="1" step="0.05" value={customWeight} onChange={(event) => setCustomWeight(Number(event.target.value))} /></label></div>}
          <p><small>Locked: {locked.length ? locked.join(', ') : 'none'}</small></p>
          <button onClick={optimize}>Generate recommendations</button>
          {recs.length > 0 && <>
          <div className={styles.confidenceFilters}>
            <span>Confidence:</span>
            <button className={confidenceFilter === 'ALL' ? styles.confidenceFilterActive : ''} onClick={() => setConfidenceFilter('ALL')}>All</button>
            <button className={confidenceFilter === 'MEDIUM_PLUS' ? styles.confidenceFilterActive : ''} onClick={() => setConfidenceFilter('MEDIUM_PLUS')}>Medium+</button>
            <button className={confidenceFilter === 'HIGH' ? styles.confidenceFilterActive : ''} onClick={() => setConfidenceFilter('HIGH')}>High only</button>
          </div>
          {currentTeamView && <div className={styles.bestTeamsBoard}>
            <div className={styles.bestTeamsTitle}>
              <div><h3>Possible teams</h3><small>{mode === 'horizon' ? 'Ranked by 3 GP hold score' : 'Ranked by selected optimizer mode'}</small></div>
              <span>{possibleTeamRows.length} options</span>
            </div>
            <div className={styles.bestTeamsScroll}>
              <table className={styles.bestTeamsTable}>
                <thead><tr>
                  <th>#</th>
                  <th>CR</th>
                  <th>DR</th>
                  <th>$</th>
                  <th><button type="button" className={styles.sortHeaderButton} onClick={() => changePossibleTeamsSort('DELTA')}>xΔ$ {possibleTeamsSort === 'DELTA' ? (possibleTeamsSortDir === 'DESC' ? '↓' : '↑') : ''}</button></th>
                  <th><button type="button" className={styles.sortHeaderButton} onClick={() => changePossibleTeamsSort('XPTS')}>{mode === 'horizon' ? '3GP xPts' : 'xPts'} {possibleTeamsSort === 'XPTS' ? (possibleTeamsSortDir === 'DESC' ? '↓' : '↑') : ''}</button></th>
                  <th>Confidence</th>
                </tr></thead>
                <tbody>
                  <tr className={styles.currentTeamRow}>
                    <td>—</td>
                    <td><div className={styles.teamAssetGroup}>{currentTeamView.assets.filter(a=>a.type==='CONSTRUCTOR').map(a=><span key={a.code} className={styles.teamAssetChipOwned} style={{'--accent':accents[a.code]??'#64748b'} as CSSProperties}><b>{a.code}</b><small>${a.price.toFixed(1)} · {(mode === 'horizon' ? ((a.horizonPoints??[]).reduce((s,v)=>s+Number(v??0),0)).toFixed(1) : Number(a.expectedPoints??0).toFixed(1))} xPts · {(a.expectedDelta>=0?'+':'')+a.expectedDelta.toFixed(2)}</small></span>)}</div></td>
                    <td><div className={styles.teamAssetGroup}>{currentTeamView.assets.filter(a=>a.type==='DRIVER').map(a=><span key={a.code} className={styles.teamAssetChipOwned} style={{'--accent':accents[a.code]??'#64748b'} as CSSProperties}><b>{a.code}<em className={styles.ownedBadge}>OWN</em>{a.code===currentTeamView.boost?<em className={styles.x2Badge}>x2</em>:null}</b><small>${a.price.toFixed(1)} · {(mode === 'horizon' ? ((a.horizonPoints??[]).reduce((s,v)=>s+Number(v??0),0)).toFixed(1) : Number(a.expectedPoints??0).toFixed(1))} xPts · {(a.expectedDelta>=0?'+':'')+a.expectedDelta.toFixed(2)}</small></span>)}</div></td>
                    <td><strong>{currentTeamView.price.toFixed(1)}</strong></td>
                    <td className={currentTeamView.expectedDelta>=0?styles.teamDeltaPos:styles.teamDeltaNeg}>{currentTeamView.expectedDelta>=0?'+':''}{currentTeamView.expectedDelta.toFixed(2)}</td>
                    <td><strong>{currentTeamView.expectedPoints.toFixed(1)}</strong></td>
                    <td>—</td>
                  </tr>
                  {possibleTeamRows.slice(0,25).map((scenario:any,index:number)=>{
                    const tv=scenario.teamView as TeamView;
                    const key=scenarioKey(scenario);
                    return <tr key={key} className={hoveredScenario===key?styles.bestTeamRowActive:styles.bestTeamRow} onMouseEnter={()=>setHoveredScenario(key)} onMouseLeave={()=>setHoveredScenario(null)} onClick={()=>{setHoveredScenario(key);document.getElementById('scenario-'+encodeURIComponent(key))?.scrollIntoView({behavior:'smooth',block:'center'});}}>
                      <td><strong>{index+1}</strong></td>
                      <td><div className={styles.teamAssetGroup}>{tv.assets.filter(a=>a.type==='CONSTRUCTOR').map(a=><span key={a.code} className={ownedCodes.has(a.code)?styles.teamAssetChipOwned:styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as CSSProperties}><b>{a.code}</b><small>${a.price.toFixed(1)} · {(mode === 'horizon' ? ((a.horizonPoints??[]).reduce((s,v)=>s+Number(v??0),0)).toFixed(1) : Number(a.expectedPoints??0).toFixed(1))} xPts · {(a.expectedDelta>=0?'+':'')+a.expectedDelta.toFixed(2)}</small></span>)}</div></td>
                      <td><div className={styles.teamAssetGroup}>{tv.assets.filter(a=>a.type==='DRIVER').map(a=>{
                        const owned=ownedCodes.has(a.code);
                        return <span key={a.code} className={owned?styles.teamAssetChipOwned:styles.teamAssetChip} style={{'--accent':accents[a.code]??'#64748b'} as CSSProperties}>
                          <b>{a.code}{owned?<em className={styles.ownedBadge}>OWN</em>:null}{a.code===tv.boost?<em className={styles.x2Badge}>x2</em>:null}</b>
                          <small>${a.price.toFixed(1)} · {(mode === 'horizon' ? ((a.horizonPoints??[]).reduce((s,v)=>s+Number(v??0),0)).toFixed(1) : Number(a.expectedPoints??0).toFixed(1))} xPts · {(a.expectedDelta>=0?'+':'')+a.expectedDelta.toFixed(2)}</small>
                        </span>;
                      })}</div></td>
                      <td><strong>{tv.price.toFixed(1)}</strong></td>
                      <td className={tv.expectedDelta>=0?styles.teamDeltaPos:styles.teamDeltaNeg}>{tv.expectedDelta>=0?'+':''}{tv.expectedDelta.toFixed(2)}</td>
                      <td><strong>{tv.expectedPoints.toFixed(1)}</strong>{tv.penalty>0?<small className={styles.teamPenalty}> −{tv.penalty} penalty</small>:null}</td>
                      <td>{scenario.transferConfidence ? <span className={scenario.transferConfidence === 'HIGH' ? styles.confHigh : scenario.transferConfidence === 'MEDIUM' ? styles.confMedium : styles.confLow} title={scenario.empiricalHitRate != null ? (mode === 'horizon' ? 'Historical hit rate for optimizer-selected 3GP recommendations with similar net gain: ' : 'Historical hit rate: ') + Math.round(scenario.empiricalHitRate * 100) + '%' : ''}>{scenario.transferConfidence}{scenario.empiricalHitRate != null ? ' · ' + Math.round(scenario.empiricalHitRate * 100) + '%' : ''}</span> : '—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>}
          <div className="stats">{[0,1,2,3].map((count) => {
            const candidates = visibleRecs.filter((scenario:any) => scenario.transfers === count);
            const best = candidates[0];
            const headline = !best ? '—'
              : mode === 'budget' ? ((best.projectedValueGain >= 0 ? '+' : '') + best.projectedValueGain.toFixed(2) + 'M')
              : mode === 'horizon' ? ((best.netPointsGain >= 0 ? '+' : '') + best.netPointsGain.toFixed(1) + ' net pts')
              : ((best.transferPointsGain >= 0 ? '+' : '') + best.transferPointsGain.toFixed(1) + ' pts');
            const key = best ? scenarioKey(best) : null;
            return <article
              key={count}
              className={key && hoveredScenario === key ? styles.summaryCardActive : styles.summaryCard}
              onMouseEnter={() => key && setHoveredScenario(key)}
              onMouseLeave={() => setHoveredScenario(null)}
              onClick={() => {
                if (!key) return;
                setHoveredScenario(key);
                document.getElementById('scenario-' + encodeURIComponent(key))?.scrollIntoView({behavior:'smooth',block:'center'});
              }}
            >
              <small>{count} transfer{count === 1 ? '' : 's'}</small>
              <strong>{headline}</strong>
              {best ? <small>
                {best.out.join(', ') || 'Keep lineup'}{best.incoming.length ? ' → ' + best.incoming.join(', ') : ''}
                {mode === 'horizon' && <>
                  <br/>Transfers {(best.transferPointsGain >= 0 ? '+' : '') + best.transferPointsGain.toFixed(1)}
                  {' · '}2× {(best.boostGain >= 0 ? '+' : '') + best.boostGain.toFixed(1)}
                  {' · '}Penalty {best.penalty}
                  {best.currentBoost && best.recommendedBoost && best.currentBoost !== best.recommendedBoost && <><br/>2× {best.currentBoost} → {best.recommendedBoost}</>}
                </>}
                {(mode === 'balanced' || mode === 'custom') && <><br/>Value Δ {(best.projectedValueGain >= 0 ? '+' : '') + best.projectedValueGain.toFixed(2) + 'M'}</>}
                <br/>Next FT {best.projectedNextFreeTransfers}
              </small> : null}
            </article>;
          })}</div>{visibleRecs.length === 0 ? <p className="notice">No recommendations match this confidence filter.</p> : null}</>}
        </section>
        <section><h2>Chips</h2><div className="chips">{data.snapshot.chips.map((chip) => <span key={chip.code}>{chip.code} <b>{chip.status}</b></span>)}</div></section>
      </>}
    </main>
  );
}