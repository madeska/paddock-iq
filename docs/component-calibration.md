# Component calibration research

> Historical2026 price-dependent results below require recomputation after the 2026-10-08 quote-field correction. Original numbers are retained for audit history, not current accuracy evidence. See [quote field audit](official-price-field-2026.md). Frozen protocols are not silently rewritten.

Corrected production forecasts receive component25-v2 model IDs, with v1 kept as a fallback until refresh. This branch corrects earned overtake points after retirement and qualifying no-time handling. It adds an optional historical calibrator and reproducible evaluation. Historical calibration is deliberately not enabled in the production forecast: neither the complete candidate nor the component-specific hybrid improves the combined xPts MAE.

## Data and methods

The snapshot contains 352 driver and 176 constructor weekends from completed 2026 rounds 1–16. Sources are the official public `https://fantasy.formula1.com/feeds/drivers/{round}_en.json` and `https://fantasy.formula1.com/feeds/popup/playerstats_{PlayerId}.json` feeds. Only active assets and finalized, complete sessions are included. Reconstructed session totals match the archived official points. An explicitly reported retirement is distinct from negative points caused by lost positions. Pit history records awarded points, not measured stop duration.

Calibration uses recency-weighted, pooled priors and only rounds strictly before the forecast round. Parameters were selected on rounds 6–11. The initial holdout was rounds 12–16; the hybrid is an exploratory ablation after inspecting that initial holdout, not a fresh independent validation. It retains the legacy overtakes and fastest-lap estimates. Each final forecast averages three seeded 1,200-simulation runs. The original run incorrectly required OldPlayerValue, which is the preceding snapshot quote. The corrected collector requires finite positive Value. Field semantics are audited; exact pre-lock publication timing remains unverified. The original metrics below used the stale field.

## Results

Full calibration reduces holdout DNF Brier error from 0.1590 to 0.1397, DOTD Brier from 0.0414 to 0.0379, and pit-point MAE from 3.1534 to 2.7854. Overtake and fastest-lap errors worsen. With the production 75/25 baseline/component blend, driver MAE changes from 11.2749 to 11.2832 and constructor MAE from 19.9005 to 19.9707. The hybrid also does not improve overall MAE. Five holdout weekends are a small sample; these component improvements do not establish better team recommendations.

The full numeric report is `component-calibration-results.json`. Keep the new calibrator optional until stronger validation demonstrates an overall benefit. Further work should focus on conditional pace, grid and circuit models for overtakes and race order, rather than replacing every event with a driver's unconditional historical rate.

## Reproduce

- `npm run fantasy:check-components`
- `npm run fantasy:check-scoring`
- `npm run fantasy:backtest-calibration`
- `npm run fantasy:sync-components` rebuilds the snapshot from public feeds, caching downloads in `COMPONENT_HISTORY_CACHE` (default `../simulation-research`). Set `COMPONENT_HISTORY_BEFORE_ROUND` to the first excluded round (default 17). Use an empty cache when refreshing current player histories. The snapshot is fixed to season 2026 and is not fetched automatically by production.

No F1 account credentials are used. Unclassified drivers retain earned overtake awards; finish and position-change points are suppressed. Sprint disqualifications are currently pooled with non-classification for rate estimation; specific constructor disqualification penalties are not modeled by this research simulator.
