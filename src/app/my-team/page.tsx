'use client';

import { useState } from 'react';
import { type Mode } from '../../lib/optimizer';

type Score = { round: number; name: string; points: number };
type Asset = {
  code: string; name: string; type: string; isDoubled: boolean;
  price: number | null; expectedPoints: number | null; expectedDelta: number | null; modelVersion: string | null;
  probabilityMaxRise: number | null; probabilitySmallRise: number | null;
  probabilitySmallFall: number | null; probabilityMaxFall: number | null; probabilityFlat: number | null;
  requiredPointsMaxRise: number | null; requiredPointsSmallRise: number | null;
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

export default function MyTeam() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<Mode | 'horizon'>('balanced');
  const [customWeight, setCustomWeight] = useState(0.6);
  const [recs, setRecs] = useState<any[]>([]);
  const [locked, setLocked] = useState<string[]>([]);

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
          <h2>Lineup</h2>
          <div className="tablewrap"><table>
            <thead><tr><th>Asset</th><th>Price</th><th>Last 2 actual</th><th>xPts</th><th>Expected Δ</th><th>Most likely</th><th>Price probabilities</th><th>Rise thresholds</th></tr></thead>
            <tbody>{data.snapshot.assets.map((asset) => <tr key={asset.code}>
              <td><b>{asset.code}</b> · {asset.name}{asset.isDoubled ? ' · 2×' : ''}<br/><small>{asset.type}</small><br/><button type="button" onClick={() => setLocked((prev) => prev.includes(asset.code) ? prev.filter((code) => code !== asset.code) : [...prev, asset.code])}>{locked.includes(asset.code) ? 'Unlock' : 'Lock'}</button></td>
              <td>{asset.price == null ? '—' : '$' + asset.price + 'M'}</td>
              <td>{asset.recentFantasyScores.length ? asset.recentFantasyScores.map((score) => <span key={score.round}>R{score.round}: <b>{score.points}</b><br/></span>) : '—'}</td>
              <td>{asset.expectedPoints ?? '—'}{asset.modelVersion ? <><br/><small>{asset.modelVersion}</small></> : null}</td>
              <td>{fmtDelta(asset.expectedDelta)}</td>
              <td>{asset.mostLikelyDelta == null ? '—' : fmtDelta(asset.mostLikelyDelta) + ' · ' + pct(asset.mostLikelyProbability)}</td>
              <td><small>Max ↑ {pct(asset.probabilityMaxRise)}<br/>Small ↑ {pct(asset.probabilitySmallRise)}<br/>Small ↓ {pct(asset.probabilitySmallFall)}<br/>Max ↓ {pct(asset.probabilityMaxFall)}<br/>Flat {pct(asset.probabilityFlat)}</small></td>
              <td><small>Small ↑: {asset.requiredPointsSmallRise == null ? '—' : asset.requiredPointsSmallRise.toFixed(1) + ' pts'}<br/>Max ↑: {asset.requiredPointsMaxRise == null ? '—' : asset.requiredPointsMaxRise.toFixed(1) + ' pts'}</small></td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <section>
          <h2>Strategy optimizer</h2>
          <p><button onClick={generatePredictions}>Generate / refresh xPts + price probabilities</button></p>
          <div className="tabs">{(['points','balanced','budget','custom','horizon'] as const).map((value) => <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value as Mode | 'horizon')}>{value === 'horizon' ? '3 GP hold' : value}</button>)}</div>
          {mode === 'horizon' && <p><small>3 GP hold = projected R16–R18 points if you make transfers now and hold the lineup. Future transfers and track/Sprint/weather/news modifiers are not simulated.</small></p>}
          {mode === 'custom' && <div className="inputs"><label>Points weight: {Math.round(customWeight * 100)}% · Budget weight: {Math.round((1-customWeight) * 100)}%<input type="range" min="0" max="1" step="0.05" value={customWeight} onChange={(event) => setCustomWeight(Number(event.target.value))} /></label></div>}
          <p><small>Locked: {locked.length ? locked.join(', ') : 'none'}</small></p>
          <button onClick={optimize}>Generate recommendations</button>
          {recs.length > 0 && <div className="tablewrap"><table>
            <thead><tr><th>Sell</th><th>Buy</th><th>2× Boost</th><th>{mode === 'horizon' ? '3GP transfer pts' : 'Transfer pts'}</th><th>{mode === 'horizon' ? '3GP boost pts' : 'Boost pts'}</th><th>{mode === 'horizon' ? 'R16/R17/R18 gain' : 'Net pts'}</th>{mode === 'horizon' ? <th>3GP net pts</th> : null}<th>{mode === 'horizon' ? '3GP Value Δ' : 'Value Δ'}</th><th>Penalty</th><th>Cash after</th><th>Next FT</th></tr></thead>
            <tbody>{recs.slice(0,10).map((scenario:any,index:number) => <tr key={index}>
              <td>{scenario.out.join(', ') || 'Keep'}</td><td>{scenario.incoming.join(', ') || '—'}</td>
              <td>{scenario.recommendedBoost || '—'}{scenario.currentBoost && scenario.recommendedBoost !== scenario.currentBoost ? ' (was ' + scenario.currentBoost + ')' : ''}</td>
              <td>{scenario.transferPointsGain.toFixed(1)}</td><td>{scenario.boostGain.toFixed(1)}</td>
              <td>{mode === 'horizon' && Array.isArray(scenario.perRoundGain) ? scenario.perRoundGain.map((v:number) => v.toFixed(1)).join(' / ') : scenario.netPointsGain.toFixed(1)}</td>{mode === 'horizon' ? <td>{scenario.netPointsGain.toFixed(1)}</td> : null}<td>{scenario.projectedValueGain.toFixed(2)}</td><td>{scenario.penalty}</td>
              <td>{'$' + scenario.cashRemaining.toFixed(1) + 'M'}</td><td>{scenario.projectedNextFreeTransfers}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>
        <section><h2>Chips</h2><div className="chips">{data.snapshot.chips.map((chip) => <span key={chip.code}>{chip.code} <b>{chip.status}</b></span>)}</div></section>
      </>}
    </main>
  );
}