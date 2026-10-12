# Isolated reliability experiment

R18 United States GP is a normal weekend, confirmed against the live Fantasy Tools 2026 calendar on 2026-10-12. Its forecast has no Sprint session. Race reliability applies to both weekend types; sprint reliability is sampled only on sprint weekends.

The research mode `reliability-only` replaces only race and sprint failure probabilities with the existing historical component estimates. Overtakes, no-time qualifying, fastest lap, driver of the day, pits, blend weight and simulation configuration keep their incumbent behavior. Earlier calibration experiments changed several of these together. Production API calls do not enable this research mode.

Calibration uses earlier rounds only, with priorStrength 16 and halfLife 16 fixed from previous research. No hyperparameter search was performed. Paired forecasts use identical cohorts, quotes and practice context. The 2025 R6–14 experiment uses the tracked practice archive; 2026 R6–16 uses no practice on both policies. The seasons have distinct protocols. These already researched samples are exploratory, not independent validation; Singapore R17 and reserved 2025 R15–21 errors are not used to select this policy.

| Season | Weekend | Assets | Incumbent MAE | Reliability-only MAE | Change |
|---|---|---:|---:|---:|---:|
| 2025 | Normal | 209 | 13.207 | 13.211 | +0.004 |
| 2025 | Sprint | 60 | 11.555 | 11.652 | +0.097 |
| 2026 | Normal | 297 | 13.507 | 13.543 | +0.037 |
| 2026 | Sprint | 65 | 13.472 | 13.723 | +0.251 |

Lower MAE is better. Overall error rose by 0.025 in 2025 and 0.075 in 2026. Paired race-block 95% bootstrap intervals include zero overall; there are only two evaluated sprint rounds in each season, so sprint intervals are particularly fragile. No superiority or production activation is supported.

Race failure Brier score improved from 0.1545 to 0.1390 in the 2026 sample, including 0.1576 to 0.1403 on normal weekends. Sprint failure Brier worsened from 0.02257 to 0.02562; only one actual sprint failure was observed among 43 eligible driver observations. Better race failure probabilities did not translate into lower Fantasy point error. A possible issue to test next is whether a strength estimate derived from historical full scores already incorporates reliability losses; this experiment does not establish that explanation.

The default production simulation is unchanged, checked against original seeded full-component fixtures. Tests separately verify that normal weekends ignore sprint failure probabilities exactly and that unrelated component calibration cannot affect the isolated mode. Constructor points inherit driver changes through the existing simulation; no constructor model coefficients were changed.

Reproduce:

```
npx tsx --test scripts/check-reliability-only.ts scripts/check-production-forecast.ts scripts/check-component-calibration.ts
npx tsx scripts/backtest-reliability-only.ts
```

`reliability-only-results.json` contains all cohort metrics, missing observations, failure Brier scores and paired race-block bootstrap intervals. The bootstrap measures sampling variation over these already consumed rounds, not historical source-publication certainty or generalization to a new race.
