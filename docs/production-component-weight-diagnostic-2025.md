# Component weight diagnostic, 2025 rounds 6–14

Exploratory comparison on already-consumed data; not independent confirmation or production activation. Uses the same 179 driver and 90 constructor observations and cutoff/seed/practice/rounding controls as the conditional pace benchmark. The script asserts exact incumbent parity each round. Cold-start coverage remains incomplete.

| Variant | Driver MAE | Constructor MAE |
| --- | ---: | ---: |
| Current legacy simulation, 25% | 10.6626 | 17.4333 |
| Baseline only | 10.9743 | 18.0944 |
| Legacy simulation, 50% | 10.5430 | 17.2467 |
| Legacy simulation, 100% | 10.7486 | 17.8700 |
| Historical pace, 50% | 10.5436 | 17.7900 |
| Historical pace, 100% | 11.7760 | 20.3822 |

The historical-pace signal is not merely masked by the 25% blend: increasing its weight worsens constructors substantially. The legacy 50% blend improves both MAE and RMSE in this exploratory sample, but race-block MAE intervals cross zero (driver [-0.3228, +0.1094], constructor [-0.5800, +0.1756]). Bias worsens. Keep production at 25% until independent verification.

Next candidate is fixed at a 50% legacy component blend, without new pace/over­take/calibration options. Further tuning on the independent window is prohibited for this candidate. Reserved rounds 15–21 still have not been evaluated by this diagnostic.
