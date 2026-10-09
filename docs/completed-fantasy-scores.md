# Official points after the race

The market automatically checks official results when opened and every five minutes while the tab is visible. Update official points triggers the same operation manually. This is browser-driven polling, not an always-on background scheduler.

POST /api/fantasy-scores/sync accepts season 2026 and a round. The public unversioned feeds currently serve 2026; other seasons are refused. It reads the official drivers round feed and player/constructor popup breakdowns. Writes require matching player identity, round and season, an explicitly finished main Race (MatchStatus 4), played/active status and exact agreement between GamedayPoints and the popup Total. For the observed official zero-score omission of Total, a nonempty set of unique finite scoring components must sum exactly to zero instead. A completed race may still have pending points; missing values never become zeros. Genuine zero and negative scores are retained. An unfinished race short-circuits after the first matching breakdown.

Verified results use the existing FantasyRoundScore unique asset/round row. Repeat sync skips identical values; later official corrections update points and recordedAt. Existing manual imports and concurrent edits are preserved. Source failures are surfaced and do not erase stored scores. No schema migration or user database reset is required.

The former market sync deletion of all target-round scores is removed. Market returns actualPoints and actualPointsUpdatedAt separately from expectedPoints; Official pts appears alongside xPts. Refresh projections continues to train only on earlier rounds, so observed target results do not leak into its forecast.

A cached official R16 feed and popup collection is used as a read-only source sanity check; tests use injected evidence and fake database adapters. Current-round points are not fabricated to demonstrate the feature. Imported private F1 team total points and chip-adjusted team results are not recalculated by this asset score sync.
