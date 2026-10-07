# Cold-start coverage on2024 entrant events

Fixed prior from20a778d:half target teammate past-scoreEWMA(alpha.25), half pooled past driver scores. Same25% component blend both models; legacy baseline rows preserved. Explores R2–24 after other2024 model errors have already been consumed. No independently blind validation claim or tuning. Retrospective quote timing and historical pit/DSQ assumptions remain limits.

| New forecast | Round | Prediction | Actual | Absolute error |
| --- | ---: | ---: | ---: | ---: |
| BEA |2|15.5|26|10.5|
| COL |16|7.2|11|3.8|
| LAW |19|6.3|20|13.7|
| DOO |24|10.2|8|2.2|

New-coverage MAE7.55 across four events. These predictions have no incumbent forecast to compare against; never treat missing incumbent as zero. On455 paired existing drivers MAE8.97055→8.97033 and RMSE slightly worsens. On230 paired constructors MAE14.19174→14.12043. Restored field/support changes all simulated outcomes at affected events. Bootstrap has many unaffected blocks; it does not provide23 independent cold-start events.

Causal-price mode omits entrant identities lacking initial quote history, so this policy cannot recover those forecasts in that mode. It demonstrates that coverage depends on obtaining an actual known market quote; no new entrant quote is invented. Reported and causal cohorts are separate, not pure price sensitivity.

Per-round incumbent parity and full prior invariance to target/future score mutations are asserted. Additional predictions and missing labels stay separate from paired metrics. Production does not enable this policy. More independent entrant events or a prospective comparison are required before accuracy claims.
