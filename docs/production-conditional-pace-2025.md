# Conditional overtakes and historical pace: 2025 exploratory replay

Three fixed candidates use existing overtake-model defaults: conditional overtakes alone, past qualifying/classified finishing pace alone, and both. No hyperparameter search or production activation. Evaluation covers already-consumed rounds 6–14, 179 drivers and 90 constructors; the cold-start COL omission remains explicit. Reserved rounds 15–21 were not evaluated.

The benchmark rebuilds the shared production baseline, pre-event roster/prices and completed practice policy. It asserts exact incumbent replay parity for each round, and that mutating target/future overtakes cannot change the fitted overtake model. All candidate features are past-only. Simulation uses 3000 draws, incumbent seed/intensity, season-2025 scoring, constructor support fallback and final 0.1 rounding.

| Model | Driver MAE | Constructor MAE |
| --- | ---: | ---: |
| Incumbent | 10.6626 | 17.4333 |
| Conditional overtakes | 10.6693 | 17.4489 |
| Historical pace | 10.5983 | 17.4356 |
| Historical pace and overtakes | 10.6073 | 17.4478 |

Every paired race-block bootstrap interval crosses zero. Historical pace also worsens constructor RMSE from 21.4340 to 21.5766. Thus neither standalone conditional overtakes nor historical pace provides convincing full driver-and-constructor improvement. Retain incumbent. Exact conservation of historical scores does not establish forecast quality.

Run: npx tsx scripts/backtest-production-conditional-pace-2025.ts. Full metrics and intervals: production-conditional-pace-2025-results.json.
