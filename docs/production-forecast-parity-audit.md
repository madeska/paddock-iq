# Production forecast parity audit

Source checked at `b11b0ee`: `src/app/api/predictions/auto/route.ts`, `src/lib/fantasy-official-sync.ts`, `scripts/backtest-component-calibration.ts`, cached official 2026 round/player feeds. This audit changes no production behavior.

## Confirmed comparator differences

- Production overtake intensity is 1.2; the historical research harness uses 1.8.
- Production driver ridge training starts at target round 6, using currently active database assets. Research training starts at round 3 and uses all historical driver observations.
- Production ridge standardizes with sample SD; research uses population SD.
- Production applies a normal-GP practice modifier when a valid snapshot is available. The research harness has no practice input.
- Production constructor baseline has a -5 floor; the research baseline does not.
- Production fallback without a fitted ridge is 0.7 EWMA + 0.3 season mean. The research fallback effectively returns EWMA.
- Production prices come from `Value`-based official market histories. The research snapshot's `priceBefore` is copied from feed `OldPlayerValue`. Those selectors differ. Field names alone do not establish quote timing; do not assume a price leak or change the source field without checking availability/semantics.

Earlier reports therefore compare historical research configurations. Their “current” label does not mean an exact replay of the entire production pipeline. Frozen point-model results and settings remain reproducible; these limits must accompany any conclusion about replacing production.

## Confirmed production input problems

The hardcoded production team map assigns LIN to RBR and HAD to RB. Official cached round feeds assign LIN to Racing Bulls and HAD to Red Bull Racing, including rounds 1, 15 and 16. Correct constructor membership must come from authoritative round metadata rather than that static map.

`syncOfficialFantasyMarket` ignores `IsActive` while saving historical score rows. It also applies LAW's current-team preference to historical rows. Cached R12–14 show current-seat LAW player 114 and HAD player 11032 with IsActive=0 and GamedayPoints=0. The corresponding popup sessions all have IsPlayed=0 and empty StatsWise arrays. A finite zero is not evidence of a played race. The active LAW player 116 appears in those feeds for Red Bull Racing with nonzero official scores.

These placeholders can be persisted and later used by the route's unfiltered score histories. Skipping them on future imports alone would not repair already saved generated rows. Any reconciliation must be source-aware, preserve genuinely played zeros/negative scores and preserve user-entered data. Do not apply a blanket history reset merely because a reactivation constant exists.

## Required next work

Extract a pure forecast function shared by the API and benchmark, retaining tested default math while making all feature timing and simulation settings explicit. Resolve historical/current market rows and team membership from verified feed metadata. Distinguish played scores from inactive placeholders; reconcile generated bad rows safely and retain provenance. Add parity fixtures for the actual production settings before selecting another predictive model or consuming reserved 2025 R15–21 Fantasy errors.

No model is yet proven superior to the full production pipeline. The independent 2025 reference remains explicitly a price-free adaptation, with its own documented settings.
