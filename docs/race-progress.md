# Grid-relative race progress

> Historical2026 price-dependent results below require recomputation after the 2026-10-08 quote-field correction. Original numbers are retained for audit history, not current accuracy evidence. See [quote field audit](official-price-field-2026.md). Frozen protocols are not silently rewritten.

This optional research model anchors finishing order to the sampled starting grid. Production does not pass `raceProgress` and remains unchanged.

## Model

`fitRaceProgress` estimates a driver's prior classified position-change awards, shrunk by five sessions toward zero. It excludes non-classified sessions, other seasons and the target/future rounds. The average includes promotions due to retirements; it is not a pure estimate of on-track passing ability.

Each classified driver's ranking strength is `(11.5 - sampledStart + historicalProgress) / 6`. Ranking these keys gives unique finishing places. Removing non-classified drivers promotes remaining drivers in the final ranking once. Unclassified drivers receive no position-change awards. Unknown drivers use zero progress.

Zero race noise produces ordering from grid and progress, with exact ties broken by already-sampled Gumbel shocks rather than input order. Optional shared form can supply the same shock mechanism. Default simulation settings take the original path and consume the same random draws as before.

## Selection and results

The development comparison tests 60 combinations: qualifying noise unchanged/0.15/0.3, race noise 0/0.05/0.15/0.3/0.5, current versus conditional overtakes, and current versus previously developed reliability/DOTD/pit calibration. Every comparison averages three seeded 1,200-simulation runs. All selection uses rounds 6–11.

A stricter eligibility gate requires no worse development MAE for all four: driver weekend points, constructor weekend points, driver position-change awards and driver overtakes. **Zero candidates pass.** The selected model therefore remains the current baseline.

For diagnosis only, the best aggregate candidate uses historical qualifying (noise 0.15), grid-relative progress (race noise 0), conditional overtakes and existing reliability. Its development driver/constructor MAE is 10.5098/15.6573, but position/overtake MAE is worse than the baseline, so it is ineligible.

On previously inspected rounds 12–16:

| MAE | Current production settings | Previous race-pace candidate | Grid-relative diagnostic |
|---|---:|---:|---:|
| Driver weekend points | 11.2749 | 11.2206 | 11.1783 |
| Constructor weekend points | 19.9005 | 19.5853 | 19.5880 |
| Driver position-change awards | 2.5042 | 3.5167 | 2.5790 |
| Driver overtakes | 3.8544 | 4.0469 | 4.0428 |

This reduces the previous candidate's position error by about 27% and improves driver weekend points. Yet it does not beat current settings for positions or overtakes, and constructor bias worsens. A better combined xPts error cannot by itself establish a better simulation. Later rounds were already inspected during prior experiments; all these results remain exploratory rather than independent holdout proof.

No model is activated or merged based on the diagnostic. Further work needs independent validation and better separation of on-track overtakes from finishing-position changes and retirement promotions.

## Reproduce

- `npm run fantasy:check-progress` — seven tests: shrinkage, cutoff, grid preservation, unique ordering, retirement promotion, default-path identity and unbiased tie handling.
- `npm run fantasy:backtest-progress` — development-only eligibility and aggregate diagnostic comparisons.

Numeric report: `race-progress-results.json`. Previous research commands remain available.
