# Frozen half-blend validation: 2025 R15–21

Candidate and protocol were committed in b6e5f91 before this forecast-error evaluation. No tuning: legacy simulation component weight 0.50 versus incumbent 0.25, with identical pre-event prices, active rosters, shared baseline, pre-lock practice, seed, intensity, season rules and rounding. Collector stores a separate extended pre-lock archive; original R1–14 archive is preserved. All 21 practices were parsed, without exclusions. This is a held-out forecast-error window, not a wholly blind historical season: physical race results and raw archives existed previously. Retrospective provider publication timestamps remain unknown.

| Metric | Drivers incumbent | Drivers candidate | Constructors incumbent | Constructors candidate |
| --- | ---: | ---: | ---: | ---: |
| n | 136 | 136 | 70 | 70 |
| MAE | 10.6294 | 10.5051 | 18.6157 | 18.5100 |
| RMSE | 14.4732 | 14.3106 | 24.2904 | 23.8848 |
| Bias | 0.0926 | 0.4449 | -0.4529 | 0.1414 |

Driver paired race-block delta-MAE interval [-0.3071, +0.0636]; constructor [-0.6071, +0.2857]. Both cross zero. Lower average errors replicate directionally in both asset types, but convincing superiority is not established. Driver bias worsens. Keep production weight unchanged under the frozen activation requirement.

Four unavailable driver labels (LAW/TSU at R16 and R19) are omitted from paired evaluation, not assigned zero. All other active forecasts are covered. Future scores and quotes are filtered by the shared replay; baseline simulation parity is asserted for each round. This window is now consumed; do not repeatedly tune and describe it as independent.

Run: npx tsx scripts/backtest-production-component-half-validation-2025.ts. Metrics and race blocks: production-component-half-validation-2025-results.json.
