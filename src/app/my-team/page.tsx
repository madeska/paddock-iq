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

export default function MyTeam() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<Mode | 'horizon'>('balanced');
  const [customWeight, setCustomWeight] = useState(0.6);
  const [recs, setRecs] = useState<any[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);

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
      setRecs(scenarios); setStatus(scenarios.length ? '' : 'No valid transfer scenarios found.');
    } catch (error) {
      setRecs([]); setStatus(error instanceof Error ? error.message : 'Optimization failed');
    }
  }

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
          {recs.length > 0 && <><div className="stats">{[0,1,2,3].map((count) => {
            const candidates = recs.filter((scenario:any) => scenario.transfers === count);
            const best = candidates[0];
            const headline = !best ? '—'
              : mode === 'budget' ? ((best.projectedValueGain >= 0 ? '+' : '') + best.projectedValueGain.toFixed(2) + 'M')
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
                {best.out.join(', ') || 'Keep'}{best.incoming.length ? ' → ' + best.incoming.join(', ') : ''}
                {(mode === 'balanced' || mode === 'custom') && <><br/>Value Δ {(best.projectedValueGain >= 0 ? '+' : '') + best.projectedValueGain.toFixed(2) + 'M'}</>}
                <br/>Next FT {best.projectedNextFreeTransfers}
              </small> : null}
            </article>;
          })}</div><div className="tablewrap"><table>
            <thead><tr><th>Sell</th><th>Buy</th><th>2× Boost</th><th>{mode === 'horizon' ? '3GP transfer pts' : 'Transfer pts'}</th>{mode === 'horizon' ? <th>R16/R17/R18 transfer gain</th> : null}<th>{mode === 'horizon' ? '3GP Value Δ' : 'Value Δ'}</th><th>Penalty</th><th>Cash after</th><th>Next FT</th></tr></thead>
            <tbody>{recs.slice(0,10).map((scenario:any,index:number) => {
              const key = scenarioKey(scenario);
              return <tr
                key={index}
                id={'scenario-' + encodeURIComponent(key)}
                className={hoveredScenario === key ? styles.recommendationRowActive : styles.recommendationRow}
                onMouseEnter={() => setHoveredScenario(key)}
                onMouseLeave={() => setHoveredScenario(null)}
              >
                <td>{scenario.out.join(', ') || 'Keep'}</td>
                <td>{scenario.incoming.join(', ') || '—'}</td>
                <td>{scenario.recommendedBoost || '—'}{scenario.currentBoost && scenario.recommendedBoost !== scenario.currentBoost ? ' (was ' + scenario.currentBoost + ')' : ''}</td>
                <td>{scenario.transferPointsGain.toFixed(1)}</td>
                {mode === 'horizon' ? <td>{Array.isArray(scenario.perRoundTransferGain) ? scenario.perRoundTransferGain.map((v:number) => (v > 0 ? '+' : '') + v.toFixed(1)).join(' / ') : '—'}</td> : null}
                <td>{scenario.projectedValueGain.toFixed(2)}</td>
                <td>{scenario.penalty}</td>
                <td>{'$' + scenario.cashRemaining.toFixed(1) + 'M'}</td>
                <td>{scenario.projectedNextFreeTransfers}</td>
              </tr>;
            })}</tbody>
          </table></div></>}
        </section>
        <section><h2>Chips</h2><div className="chips">{data.snapshot.chips.map((chip) => <span key={chip.code}>{chip.code} <b>{chip.status}</b></span>)}</div></section>
      </>}
    </main>
  );
}