# Frozen2024 historical-adapter comparison

Protocol aa76a1b and adapter46ad0b9 precede the first2024 forecast-error evaluation. Candidate weight0.50 vs reference0.25; no tuning. Both use shared production baseline, completed pre-lock practice, seed202600+round, intensity1.2,3000 simulations,0.1 rounding and identical fixed2024 scoring/pit adapter. This is a limited historical-adapter comparison, not certified exact2026 production validation. Quote publication timing is not independently established. The pit model assumes two synthetic stops/team and does not explicitly sample DSQ subtypes.

| Quote mode | Asset | n | Reference MAE | Candidate MAE | Delta95% race-block interval |
| --- | --- | ---: | ---: | ---: | --- |
| Reported retrospective | Driver |377|8.8653|8.7639|[-0.2045,+0.0011]|
| Reported retrospective | Constructor |190|14.0705|14.0242|[-0.3421,+0.2537]|
| Initial + prior changes | Driver |362|8.8981|8.7704|[-0.2356,-0.0189]|
| Initial + prior changes | Constructor |190|13.9874|13.8553|[-0.3916,+0.1058]|

No convincing joint driver-and-constructor superiority: constructor intervals cross zero; bias worsens for both types in both modes. Keep production unchanged. Future errors from this season are now consumed; do not retune and relabel this as independent.

Coverage is paired within each mode, not between modes. Reported mode omits three cold-start forecasts; causal mode also drops identities lacking a starting quote or complete earlier change chain. This changes simulated field/constructor support and may affect all forecasts. Thus differences across modes are not a pure price effect. Red Bull disputed source quote is not certified or silently repaired; reconstructed quotes mechanically follow prior source deltas and inherit source errors.

The script asserts reference parity and full prediction invariance to target/future score mutations and later quote mutations each round. The two report files preserve metrics, missing asset identities and race blocks separately. No quote has been promoted to verified official pre-event status.
