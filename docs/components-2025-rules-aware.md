# Audited 2025 components and season-aware replay

Pinned public source: https://f1fantasytools.com/api/statistics/2025, SHA-256 8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162. This is third-party official-site extraction, not an independently archived official raw feed. All420 audited R1–14 weekend totals match the earlier archive, and930 session sums conserve their reported totals. The committed component snapshot contains R1–14 only; reserved R15–21 components and forecast errors remain excluded.

Race and Sprint failure labels come from explicit NC/DSQ component deductions. Negative totals from lost positions do not imply failure. A separate disqualified flag preserves the difference. Overtakes are the scored legal-overlap counts, not OpenF1's broader physical position-change events. Constructor pitPoints is the sum of explicit pit awards, without guessing stop seconds. Unknown positions, missing/ambiguous identities and inconsistent scores fail validation.

## Scoring profiles

A full session replay exposed an incorrect assumption in historical testing: the 2026 Sprint NC rule had been applied to2025. Driver Sprint NC is-20 in2025 and-10 in2026. The official What's New for2026 section documents the reduction: https://fantasy.formula1.com/en/faqs and https://fantasy.formula1.com/fr/game-rules . Current2026 defaults remain unchanged.

Three historical race DSQ cases also establish a constructor penalty difference. ALP R2 and SAU R4 deduct30 per disqualified driver; FER R2 deducts60 for two. The corresponding driver totals already contain20 each, so the additional2025 constructor deduction is10 per driver. Current2026 rules state an additional20 beyond combined driver totals. The scoring helper now accepts the explicit season for this distinction. Observed2025 Sprint constructor sessions contain no DSQ event; their ordinary sums are conserved, without asserting validation of an unobserved historical Sprint-DSQ state.

All620 driver sessions and310 constructor sessions now exactly reproduce their reported totals, including qualifying teamwork, NC/DSQ and explicit pit awards. These tests validate score reconstruction, not predictive accuracy. The simulator still does not draw a separate disqualification subtype; empirical failure rates combine observed scoring failures. Additional constructor DSQ tails therefore remain a modeling limitation, not something these experiments have fixed.

## Rules-aware comparisons

Initial committed reports remain intact. They reproduced2026 scoring settings on2025 outcomes. Revised files use the2025 profile explicitly:
- production-history-2025-rules-aware-results.json
- prelock-residual-2025-rules-aware-results.json
- production-calibration-2025-results.json

Shared production replay retains prices, active rosters, baseline math, practice policy, intensity1.2,3000 draws, seed and output rounding. Calibration options are research only, with year and beforeRound checks and all sourceRounds preceding the target. Calibration strength16/halfLife16 is inherited from earlier2026 research, not newly selected here.

| R6–14 exploratory | Driver MAE | Constructor MAE |
| --- | ---: | ---: |
| Shared production before practice |10.6860|17.4711|
| Shared production before lock |10.6626|17.4333|
| Reliability/DOTD/pit calibration |10.6866|17.4422|
| All component calibration |10.7034|17.4467|
| R6–10 selected pre-lock residual |10.5972|17.1156|

With corrected scoring, the residual grid selects driver ridge50/weight.5 and constructor ridge10/weight1. Driver delta-0.0654 has race-block interval[-0.2994,+0.2006]; constructor delta-0.3178 has interval[-1.1622,+0.5267]. Constructor RMSE worsens21.4340→21.6134 and mean error rises-0.2356→+2.5756. Neither calibration nor the residual strategy demonstrates a robust overall improvement. No candidate is activated.

These events were consumed earlier, so the results are exploratory. Cold COL R7 remains missing from incumbent coverage and is not replaced with a fictitious zero. Independent confirmation, coherent pace/conditional-overtake modeling and cold-start coverage remain necessary for the accuracy goal.
