# Pre-lock practice archive and residual experiment

The production practice selector previously checked session start before the deadline, but not session completion or the current forecast clock. It now requires the session to finish before both the lock and forecast time; cancelled, invalid and other-season sessions are omitted. A shared pure selector supplies the live helper and historical collector. Valid baseline and seeded simulation math remains unchanged.

Sources:
- OpenF1 sessions, driver identities and session-result endpoints: https://openf1.org/docs/
- Pinned public 2025 Fantasy calendar snapshot: https://f1fantasytools.com/api/statistics/2025
- Official 2025 sprint lock explanation: https://www.formula1.com/en/latest/article/f1-fantasy-strategist-selection-whats-the-best-line-up-for-the-chinese-grand.7d6p6DMdGQ7MRX6vwBlN8s

Fantasy lock is the qualifying start for ordinary weekends and Sprint start for sprint weekends. The historical collector chooses the earlier provider/calendar start when they disagree. It validates meeting and year, session kind, completion, driver identities and standings, and records raw source SHA-256 hashes. R1–14 has 14 complete 20-driver practice tables and three complete pre-lock Sprint Qualifying tables. No R15–21 performance features or forecast errors are imported by this collector.

Availability is reconstructed from session completion and published schedules. These are retrospective provider snapshots, not original result-publication timestamps. OpenF1 documents a publication delay after official results. The archive does not claim exact contemporaneous arrival of every record. The current API still skips sprint practice modifiers; SQ is an experimental feature only.

## Model and evaluation

A pooled ridge predicts residuals against the shared production pre-lock forecast. Inputs are pre-practice forecast, pre-event price, sprint indicator, pace availability, normalized pre-lock pace rank, best-lap gap percent, pace surprise relative to the prior forecast ranking and gap availability. Ordinary weekends use the latest completed practice; sprint weekends use completed SQ, falling back to FP1. Constructor pace is formed from its two current drivers. Every fitting label belongs to an earlier round in the same season. Future and target labels/quotes are tested through the entire frame builder and learner.

Select ridge from 10/50/200 and residual weight from 0/.25/.5/1 using R6–10 MAE separately by type. Both selected ridge10/weight1. R11–14 is a diagnostic segment, not an independent holdout, because these events were already consumed in prior research. Common cohort: 179 driver and90 constructor observations. COL R7 is explicitly missing from incumbent coverage.

| All exploratory R6–14 | Driver MAE | Constructor MAE |
| --- | ---: | ---: |
| Shared production before practice | 10.6844 | 17.4589 |
| Shared production before lock | 10.6609 | 17.4211 |
| Selected residual ridge | 10.7263 | 17.1156 |

Constructor delta -0.3056 has race-block interval [-1.1522,+0.5389]. Driver MAE worsens0.0654, interval [-0.4108,+0.5910]. Constructor RMSE also worsens21.4272→21.6120 and mean error shifts from-0.1922 to+2.5867. Thus the simple residual model does not establish a robust full-forecast improvement and is not activated. Full grid and per-round results are in prelock-residual-2025-results.json.

Next research should use the newly found official-session component breakdowns to calibrate coherent simulation rather than extrapolate this weak correction. Reserved R15–21 forecast errors remain unused. Cold-start coverage is still outstanding; passing leakage tests is not evidence that the overall accuracy objective is achieved.
