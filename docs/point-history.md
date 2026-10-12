# Price-free team-history point forecast

> Historical2026 price-dependent results below require recomputation after the 2026-10-08 quote-field correction. Original numbers are retained for audit history, not current accuracy evidence. See [quote field audit](official-price-field-2026.md). Frozen protocols are not silently rewritten.

Research-only pooled ridge using own EWMA, last-three mean, overall mean, current-team driver EWMA, own recent trend, score standard deviation, and history size n/(n+5). Separate regressions for drivers and constructors. Each historical training feature is rebuilt from strictly earlier same-season rows. Historic sprint totals may be normalized by a fixed sprint factor and the known target sprint schedule then reapplied. No price field or target score enters a feature. Cold drivers borrow prior team information; empty histories stay finite. Duplicate historical identities and invalid settings are rejected.

Development-only selection uses 2026 R6–11. Later R12–16 was already inspected and remains exploratory. Alpha 0.15/0.25/0.4, ridge 10/50/200 and sprint factor 1/1.3 are compared.

The direct v1 winner uses driver alpha 0.25/ridge 200 and constructor alpha 0.15/ridge 10, both sprint factor 1.3. Direct forecasts fail to beat current forecasts: later driver MAE 11.5750 vs 11.2749, constructor MAE 20.1844 vs 19.8985. No rollout.

The v2 experiment blends the direct model with the current forecast at weights 0/0.1/0.25/0.5/1. Development selects zero point-model weight for drivers and 0.5 for constructors. Later constructor MAE still worsens, 19.9684 vs 19.8985; driver forecasts are identical. No rollout or improvement claim.

Both protocols are frozen before any independent 2025 score-error benchmark, and should remain immutable as versioned records:

- `point-history-frozen-protocol.json`, SHA256 `4d800dfc98ab371adb92de95ce2988f57923c72bd8e3113ad7375c37e866ba6d`.
- `point-history-ensemble-frozen-protocol.json`, SHA256 `6127611f7b318795b9661742adc84669fd853735f639befec0c958fc2291959b`.

They specify independent R6–14 and reserve R15–21. A price-free reference for 2025 is an adaptation, not an exact recreation of production without historical prices. Version, source hashes, candidate grids and selection objectives must be retained with results. Independent failure must not be hidden or used to relabel a tuned model as fresh validation.

Commands: `npm run fantasy:check-point-history`, `npm run fantasy:backtest-point-history`, `npm run fantasy:backtest-point-ensemble`. Results are in the corresponding `point-history-2026-results.json` and `point-history-ensemble-2026-results.json` reports. Production forecast behavior and version IDs are unchanged.
