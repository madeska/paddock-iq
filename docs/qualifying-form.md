# Qualifying form experiment

Research-only comparison on the OpenF1 2025 archive. Normal forecasts are unchanged.

The fitter uses only earlier same-season qualifying sessions, excludes DNS/DSQ and unknown positions, and weights history by an optional half-life. Driver history is restricted to the current team; newcomers borrow team pace. Empty histories remain neutral. Ranking uses Gumbel noise with canonical driver ordering and common random numbers.

Selection: 72 settings, rounds 6–12, three seeds × 2,000 simulations. The selected setting uses all prior current-team driver observations, no driver/team prior, and noise 0.3. Recent weighting and a positive team prior did not win. Baseline: prior-5 historical qualifying pace, noise 0.15. This is an archive comparator, not the production Fantasy baseline.

| Qualifying rank MAE | Development R6–12 | Later R13–24 |
|---|---:|---:|
| Historical comparator | 3.1794 | 3.3545 |
| Selected form model | 3.0473 | 3.2648 |
| Historical comparator with noise 0.3 | — | 3.2506 |

The simpler noise-only ablation performs better on the later races than the selected form model. That ablation was added after examining the selected result and is exploratory; it is not a independently selected model. There is no evidence here that recent form or the team prior improves the later forecasts.

Selected-minus-baseline MAE: -0.0897; paired race-block bootstrap interval [-0.1430, -0.0384]. This interval is descriptive: the later season partition was already inspected in earlier archive research, and it does not account for adaptive research or parameter selection. There are 139 valid development and 234 valid later qualifying positions; unknown and DNS/DSQ positions are excluded from scoring. Target roster/team is assumed known beforehand. Target qualifying positions enter evaluation only.

This evaluates qualifying ranks, not penalty-adjusted race grids, overtakes, or Fantasy xPts. No production activation. A bounded follow-up should test a development-selected noise-only option through the full weekend model before drawing conclusions about race forecasts.

Commands: `npm run fantasy:check-qualifying-form`, `npm run fantasy:backtest-qualifying-form`. Raw results: `qualifying-form-results.json`.
