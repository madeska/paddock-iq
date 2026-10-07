# Joint past-only weight and bias

Fixed research objective fits convex component weight and additive bias from earlier genuinely historical forecast frames. Prior20 observations at weight0.25,bias0; weight clamped[0,1], then bias recomputed conditional on that clamp. Types fit separately. Existing helper validates training identity/cutoff/finite moments. No hyperparameter search and no production caller.

Exploratory consumed2025 R6–24,379 paired drivers/190 constructors. Same audited2025 prices, shared baseline, field, practice policy, seed/scoring and rounding as the no-intercept experiment. Unsupported constructor components retain baseline fallback without affine correction. Reference parity, future input invariance and target/future parameter invariance run per round.

| Asset | Ref MAE | Candidate MAE | Ref RMSE | Candidate RMSE | Ref bias | Candidate bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Driver |10.5894|10.5435|14.1685|14.0612|0.3573|0.5536|
| Constructor |18.3568|18.2116|23.6429|23.2093|-0.1221|0.8179|

Delta-MAE race-block intervals cross zero: drivers[-0.2580,+0.1783], constructors[-0.5747,+0.2284]. Compared with weight-only stacking, driver bias improves0.9889→0.5536 while constructor bias worsens0.6695→0.8179. Both asset MAEs are slightly worse than weight-only, although still below reference. No convincing superiority or independent validation; keep inactive. Four unit tests and type checks pass.

Review found and fixed an eligibility mismatch: unsupported constructor fallback rows previously influenced affine bias despite receiving no correction. They are now excluded from affine training; full benchmark was rerun.
