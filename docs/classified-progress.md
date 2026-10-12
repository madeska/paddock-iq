# Classified-relative race progress

> Historical2026 price-dependent results below require recomputation after the 2026-10-08 quote-field correction. Original numbers are retained for audit history, not current accuracy evidence. See [quote field audit](official-price-field-2026.md). Frozen protocols are not silently rewritten.

Research-only alternative to raw historical position change. The simulator ranks surviving drivers in a unique finishing permutation, so historical promotions due to other drivers retiring should not also be treated as intrinsic driver progress.

For each past race, reconstruct a classified driver's start as finish + reported position change. Rank those starting positions among the classified drivers and subtract observed finish. The sum of these relative changes is zero for a complete classified field. Shrink each driver's mean toward zero with prior 5. Earlier same-season sessions only; duplicate driver/round rows are deduplicated. Invalid starts, duplicate starts, and non-contiguous finishing ranks exclude a session. Missing tail finishers cannot be detected from contiguous ranks alone. This measures net reordering, not legal on-track overtakes or pure driver ability.

Six race-noise values were compared on R6–11 using the full-weekend driver MAE + 0.5 constructor MAE objective. Historical qualifying noise is fixed at 0.3. Noise 0 won. Three seeds × 1,200 simulations. R12–16 was already inspected: exploratory evaluation, not independent validation.

| Later MAE | Current | Raw progress, matched noise | Classified-relative progress |
|---|---:|---:|---:|
| Driver xPts | 11.2749 | 11.2507 | 11.2474 |
| Constructor xPts | 19.8985 | 19.7608 | 19.7418 |
| Positions | 2.5042 | 2.5832 | 2.5579 |
| Overtakes | 3.8544 | 4.3883 | 4.4105 |

The matched comparison modestly favors classified-relative progress for xPts and positions, but overtakes worsen. Relative to production, the aggregate improvement is small and positions/overtakes remain worse. No production activation. The qualifying mapping, race ranking and random streams also differ from current, so aggregate differences are not pure causal effects of removing retirement promotions.

Next work should calibrate overtakes conditional on the simulated start and net progress, with explicit failed-driver handling. Arithmetic repair of an individual component is insufficient.

Reproduce: `npx tsx --test scripts/check-classified-progress.ts`; `npx tsx scripts/backtest-classified-progress.ts`. Raw results: `classified-progress-results.json`.
