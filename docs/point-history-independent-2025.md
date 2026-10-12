# Independent point-history comparison, 2025 R6–14

The v1 direct point model and v2 ensemble were selected on 2026 R6–11 and their protocols committed in `de97b1e` before this score-error benchmark. Protocol fingerprints are verified after JSON newline normalization; Git CRLF conversion does not invalidate the same protocol. No parameter was selected using these 2025 errors.

This is retrospective cross-season validation, not a model designed as if it were live in 2025. The third-party source audit and exact historical roster identify 180 driver and 90 constructor labels over nine races. Historic pre-lock prices are unavailable, so the reference omits the current baseline's price feature: drivers use 50% pooled ridge of own EWMA/mean + 50% EWMA; constructors retain 50% EWMA + 50% last-three mean. The reference then retains the 75% baseline / 25% existing component blend. It is an adaptation, not an exact reproduction of deployed production. References use three seeds × 1,200 simulations; target roster is canonically ordered rather than ordered by actual result. Known sprint calendar is used; no target/future score enters model fitting.

| Model | Driver MAE | Constructor MAE | Driver RMSE | Constructor RMSE |
|---|---:|---:|---:|---:|
| Price-free reference blend | 10.7534 | 17.4611 | 14.1233 | 21.5447 |
| Price-free historical baseline alone | 10.8364 | 18.1098 | 14.1739 | 22.0657 |
| Direct v1 | 10.9028 | 17.6673 | 14.3893 | 22.0175 |
| Ensemble v2 | 10.7534 | 17.3441 | 14.1233 | 21.4525 |

The direct model worsens both asset types, consistent with its 2026 failure. Ensemble v2 keeps driver forecasts identical by selected weight zero. Its constructor MAE gain is 0.1170, with paired race-block interval [-1.0928, +0.7322] for candidate-minus-reference. That interval spans deterioration as well as improvement; it does not establish stable superiority. The ensemble also worsened the already inspected later 2026 constructors. No rollout.

The results also argue against simply discarding simulation: the reference blend improves both MAE and RMSE over its baseline alone in this sample. They do not establish that the chosen 25% weight is globally optimal.

R15–21 remains reserved for a future frozen Fantasy-error test. This script imports only `fantasy-totals-2025.json` (R1–14), rejects an evaluation round at or beyond 15, and verifies both protocol hashes. It does not import the extended holdout file. R6–14 is now consumed and must not be labeled fresh for subsequent models. Physical ranks of later 2025 events were previously examined in other research, so the reserved Fantasy-error subset is not a wholly unseen set of events.

Reproduce: `npm run fantasy:backtest-point-independent`. Per-round errors, bootstrap and protocol identities: `point-history-independent-2025-results.json`. Production is unchanged.
