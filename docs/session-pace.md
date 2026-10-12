# Classification pace with completed practice

Research experiment for normal weekends, including R18 United States GP. The production API does not enable this candidate. Existing projections and their model version remain unchanged.

The component simulation gets separate qualifying and race strength maps fitted from earlier classification ranks. Qualifying no-time and race failure are missing pace observations, not last-place ranks. Fantasy points, position-change awards, overtakes, fastest lap and driver-of-the-day bonuses are not predictors in these strength maps. The 75% historical Fantasy-point baseline remains unchanged; this is a change to the component ranking signal, not a wholly new point forecast.

Fixed initial policy: ranks normalized to the archived field; half-life 4 rounds; five neutral prior observations; strength standardized across supported active drivers; unknown drivers get neutral strength. Complete, unique practice contributes 25% of the ranking signal. Contradictory practice compresses the signal rather than being standardized back to its previous magnitude. Partial or invalid practice leaves historical strength unchanged. These are fixed research assumptions, not calibrated optima.

Normal weekends use the latest eligible completed practice, normally FP3 with FP2/FP1 fallback. The paired replay keeps the incumbent practice baseline modifier in all policies, so the candidate adds a practice ranking signal while holding the point-baseline input constant. No new per-lap fuel, tyre, long-run or weather feature is available here; practice classification is only a proxy for pace. Race ranks among finishers still reflect race circumstances and survivor selection.

## Paired normal-weekend results with practice

| Season/cohort | Assets | Incumbent MAE | Pace + practice MAE | Change |
|---|---:|---:|---:|---:|
| 2025 all | 209 | 13.207 | 13.192 | -0.015 |
| 2025 drivers | 139 | 10.584 | 10.572 | -0.012 |
| 2025 constructors | 70 | 18.416 | 18.396 | -0.020 |
| 2026 all | 297 | 13.247 | 13.219 | -0.029 |
| 2026 drivers | 198 | 10.880 | 10.895 | +0.015 |
| 2026 constructors | 99 | 17.983 | 17.866 | -0.117 |

Lower is better. Overall 95% paired race-block intervals: 2025 [-0.114, +0.081], 2026 [-0.091, +0.026]. Both permit deterioration, and 2026 driver MAE worsens. No convincing joint superiority is established; no activation for R18.

Historical pace without the additional practice ranking signal worsens overall MAE in both practice-enabled season protocols. A separate 2026 no-practice diagnostic showed a small improvement, but that is a different control and must not be substituted for the actual practice-enabled incumbent. Both reports are preserved.

All evaluated windows (2025 R6–14, 2026 R6–16) were previously consumed by research. 2025 R15–21 is not evaluated by this experiment, but it was already consumed by prior frozen half-blend validation, as documented in production-component-half-validation-2025.md. It must not be called a fresh holdout for this candidate. No tuning/search was performed after inspecting these pace results. Chronological training excludes each target and future rounds. Retrospective session-end timing does not prove contemporaneous source publication.

The derived 2026 normal practice input keeps source hashes, original archive hash, session identity and timestamps; it leaves the existing local archive untouched. Field-size inference from historical observations can detect ranks beyond an incomplete roster but cannot certify undetectable missing tail drivers. This limits retrospective pace normalization.

Reproduce:

```
npx tsx --test scripts/check-session-pace.ts scripts/check-production-forecast.ts
npx tsx scripts/backtest-session-pace.ts
npx tsx scripts/backtest-session-pace.ts --without-2026-practice
```

Results: session-pace-with-practice-results.json and session-pace-results.json. Both use identical active cohorts, prices, seeds, scoring rules and blend within each comparison; failures, bonuses and pit model remain incumbent. Practice coverage per round is included in each report.
