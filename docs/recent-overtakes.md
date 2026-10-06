# Recent overtake counts and independent-data probe

The optional Poisson count model can weight completed past race observations by a half-life in rounds and shrink driver-specific count corrections toward the pooled model. No overtakes are added merely because a driver finishes ahead of their starting position. Actual Fantasy overtake awards are the training labels. The starting-grid feature is reconstructed from archived finish plus position-change points for training only; future race finishes are not inputs to forecasts.

## Methods

Half-life candidates: unweighted, 1, 2, 4 and 8 rounds. Driver correction priors: disabled, 1, 5 and 10 effective sessions. For each driver, weighted observed counts are compared with the global model's weighted expected counts at those historical grids and prior qualifying pace, adding the same pooled prior to numerator and denominator. Unknown drivers use scale 1. Failed-race means also use optional recency weights, retaining earned overtakes before retirement.

Weights apply only after strict season/target-round filtering. If effective weights vanish, pooled priors keep estimates finite. Omitting both options preserves the former fitted coefficients and expectations. Qualifying and race pace histories are not recency-weighted by these options.

The search compares these settings across current rankings, the prior historical race-pace candidate and grid-relative progress: 60 combinations. Three seeded 1,200-simulation runs are averaged. All selection uses rounds 6–11, with the same four-metric eligibility gate as the progress experiment.

## Results

Zero candidates pass all four conditions. The best development overtake candidate uses grid-relative progress, qualifying noise 0.15, race noise 0, half-life 1 and driver prior 5. Its development overtake MAE is 2.3551 versus current 2.3444; its position error is also worse. On previously inspected rounds 12–16, overtake MAE worsens to 4.5725 versus 3.8544. This illustrates why a recent trend cannot safely replace a driver/grid/circuit model.

The numeric report uses constructor component25-v3, with the corrected 2026 Q2 cutoff. Its later constructor weekend MAE is 19.7998 versus 19.8985, while driver weekend MAE is effectively equal at 11.2752 versus 11.2749. A favorable constructor aggregate does not override worsened overtake and position errors. All later comparisons reuse previously examined rounds and remain exploratory. Changes in otherwise identical ranking metrics can include Monte Carlo draw-stream variation.

No recency/scaling model is enabled in production.

## Independent history availability

A read-only probe confirmed OpenF1's public 2025 metadata returns 24 race sessions. Melbourne race session 9693 provides race results, and qualifying session 9689 provides its 20-car starting grid. OpenF1 associates starting-grid records with the qualifying session key, not the race key; its parser obtains the official Formula 1 starting-grid page.

This is an availability/schema probe, not an imported or validated full-season dataset. OpenF1 race DNF flags and race points must not automatically be treated as Fantasy non-classification flags and Fantasy points. In particular, its overtakes endpoint includes pit-stop and penalty position exchanges and may be incomplete; those counts cannot replace Fantasy's legal on-track overtake awards.

Sources: [OpenF1 documentation](https://openf1.org/docs/), [starting-grid parser](https://github.com/br-g/openf1/blob/main/src/openf1/services/f1_scraping/starting_grid.py), [2025 race sessions](https://api.openf1.org/v1/sessions?year=2025&session_name=Race).

## Reproduce

- `npm run fantasy:check-overtakes` — ten tests, including recency, pooled driver correction, future exclusion and numerical fallback.
- `npm run fantasy:backtest-recent-overtakes` — development selection and reused-round comparisons.

Numeric report: `recent-overtakes-results.json`. The separate production Q2 correction is documented in `qualifying-rules-2026.md`.
