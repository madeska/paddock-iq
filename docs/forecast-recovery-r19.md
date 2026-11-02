# R19 forecast recovery — 28 October 2026

Root cause: the official market importer created R19 as `Mexico GP`, while the live Fantasy Tools calendar calls it `Mexico City Grand Prix`. The lock resolver stripped GP suffixes but required the remaining names to match exactly. With no stored deadline, the scheduler returned `Team lock unavailable` before generation, leaving every R19 main/boost prediction absent after the successful R18 rollover. Source prices and historical points were present for all 33 active assets.

Fix: canonical imported name `Mexico City GP`, plus a narrow legacy alias `mexico` → `mexico city` in the lock resolver. Round, unique calendar identity, race/session times, provider agreement and pre-lock guards remain enforced. A different race or round still fails closed. No simulation formulas, fallback points or invented deadlines were introduced.

Regression test reproduced the production mismatch (failed before the fix, passed after). A real R19 repair then used the existing generator and Neon lease, atomically saving all 33 main forecasts and 22 driver boost forecasts with their source context. Verified lock: 31 October 2026, 21:00 UTC, matching the live calendar and OpenF1 qualifying session.

The independent read-back audit checks exactly one current main forecast per active asset, finite xPts and price change, bounded post-change prices, valid price probabilities summing to one within rounding tolerance, exactly one finite x2 estimate per driver and no constructor x2 estimate. All 22 drivers and 11 constructors passed. Machine-readable output: [forecast-health-2026-r19.json](forecast-health-2026-r19.json).

To inspect a configured database without writes:

```
npx tsx scripts/audit-current-forecast.ts
```

Only an explicit `--repair` invokes generation under the maintenance lease; `--output=PATH` saves the audit. Use `PADDOCK_ENV_DIR` when the operator's environment file lives outside the checkout. Never commit that environment file.
