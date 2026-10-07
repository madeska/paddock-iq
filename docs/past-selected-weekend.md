# Past-selected weekend model and blend

Research-only expanding-window comparison. For each target round R9–16, select a model family and simulation weight separately for drivers and constructors using out-of-sample forecasts for earlier rounds R6 onward. Each earlier forecast itself uses only history before that forecast's round. Three validation rounds are required before selection starts. Target scores enter evaluation after the choice is made.

Preset families: current simulation; classified-relative progress with legacy overtakes; classified-relative progress with conditional overtakes; the same with driver prior 5. The three progress families fix qualifying noise 0.3 and race noise 0. All forecasts use three seeds × 1,200 simulations. Blend weights: 0, 0.1, 0.25, 0.5, 1. Selection minimizes asset-type MAE; ties favor smaller simulation weight, then preset family order. This is a past-performance policy, not a forecast guaranteed to be optimal.

| R9–16 | Driver MAE | Constructor MAE | Driver RMSE | Constructor RMSE |
|---|---:|---:|---:|---:|
| Current 25% blend | 10.7345 | 18.6093 | 14.6374 | 23.2724 |
| Historical baseline only | 10.9231 | 19.1291 | 14.7157 | 24.0608 |
| Past-selected family/weight | 10.6108 | 18.0935 | 14.5689 | 22.8604 |

There are 176 driver and 88 constructor observations across eight races. Comparison with the historical baseline alone indicates that removing simulation entirely is not supported by this dataset. The selected policy improves the aggregate point estimate, but its paired race-block bootstrap MAE difference includes zero: drivers -0.1237 [-0.5967, +0.4436], constructors -0.5158 [-1.8017, +0.6093]. These intervals are descriptive; they do not account for adaptive family design on repeatedly inspected 2026 data. The policy's training sets are temporally isolated, but the research design is not a fresh independent test.

No production activation or claim of globally best accuracy. Selection often assigns 100% simulation based on a short history; that is a material stability concern, not permission to apply that weight. A next validation should freeze the policy and compare it prospectively on new completed rounds or obtain a separate Fantasy-labelled season. Rank-only OpenF1 archives cannot establish Fantasy xPts accuracy.

Reproduce: `npx tsx scripts/backtest-past-selected-weekend.ts`. Full per-round settings, errors and uncertainty are in `past-selected-weekend-results.json`. This experiment changes no production API or default simulation path.
