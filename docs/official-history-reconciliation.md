# Official history reconciliation

Automatic prediction refresh reconciles previously generated driver zeros before reading training data. Only season 2026, rounds before the forecast cutoff, source exactly "Official F1 Fantasy round feed", and points exactly zero are eligible. Manual records and nonzero records are outside this repair.

A correction requires a unique active driver ID in the round feed, a matching player popup, a unique played/active round, and a unique Total equal to the round-feed points. A genuinely played zero receives verified provenance. An exclusion requires every matching ID to be explicitly inactive with zero feed points and explicitly unplayed/inactive popup data with empty statistics. Excluded records remain stored with provenance; the market, team, automatic and horizon readers omit them.

Popup fixture metadata must identify 2026 for every session in the matching round. Unversioned endpoints cannot justify a repair when season metadata is absent or belongs to another year. Missing, ambiguous or disagreeing evidence preserves the stored record. Network failures occur before any planned writes. Changes use one transaction and conditional id/source/zero updates to protect concurrent manual edits. Historical price rows are unchanged.

The cached-source replay in official-history-source-evidence.json checks hypothetical legacy generated zeros against the actual cached source snapshots and records SHA-256 hashes. It finds HAD R12–14 unplayed and LAW R12–14 played with 12, 25 and 16 points. This is evidence for repair decisions, not proof that a particular database contained these rows, and not a forecast accuracy measurement.

Run the source replay with the cached official directory as the argument to scripts/audit-official-history-evidence.ts. The ordinary refresh API returns historyReconciliation counts. Reconciliation tests cover source agreement, real zeros and negatives, manual data, concurrent changes, missing/other-season metadata and dry-run behavior.

Predictive model validation remains outstanding. Correct input history does not itself establish lower independent forecast error. The reserved 2025 R15–21 Fantasy error set remains unused.
