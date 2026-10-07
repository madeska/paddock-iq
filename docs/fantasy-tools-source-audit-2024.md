# 2024 source suitability audit

Public retrospective source: https://f1fantasytools.com/api/statistics/2024. Pinned SHA256 6d88165bfcc63b676cec593cced2e4613cf3a125388e5679116bdabefb8d15e2. No forecast errors computed. This season remains available for a predeclared independent model comparison after scoring/price validation.

719 active asset-weekends and 1618 component sessions conserve every session and weekend total. Source has 19 active drivers in R3; preserve the missing field explicitly. 678 consecutive same-identity active price transitions agree. R13 Red Bull constructor price29 plus change0.1 does not equal R14 price29. Do not infer or silently repair that quote. Original pre-event official anchors are still required.

Historical source awards differ from current rules: driver qualifying DSQ -15, race DSQ -25; constructor qualifying DSQ can be -30. Race pit awards contain 3/5/8/10/13/15/18, with separate overall-fastest and world-record fields zero. These are observed source values, not a complete validated rules specification. Replaying with current 2025/26 scoring would not be a valid independent benchmark. Next work must reconstruct and corroborate year-specific scoring before calculating model errors, and resolve or explicitly exclude disputed prices/coverage.

Reproduce with scripts/audit-fantasy-tools-source-2024.ts; discrepancy details and observed award sets in fantasy-tools-source-audit-2024.json. This is a source audit, not evidence of improved predictive accuracy.

## Driver and constructor scoring replay

1078 driver sessions reproduce exactly with source-supported historical position tables, Q NC -5/DSQ -15, race NC -20/DSQ -25 and Sprint NC -20. This is source replay, not independent official rules corroboration.

The constructor audit checks 538 sessions where two active source drivers exist. Three Q discrepancies remain: Aston Martin R8 expected3/reported1, Haas R8 expected-31/reported-30, Williams R15 expected-21/reported-20. Final promoted qualifying positions may not encode original Q2/Q3 progression; blanket -1 teamwork after no classified drivers may also be inappropriate in DSQ cases. Do not patch totals or infer missing progression until source/FIA session evidence resolves these differences. Williams R3 has only one active source driver and is explicitly uncheckable. All other checked constructor sessions match.

Audit script intentionally exits nonzero while these constructor discrepancies remain. Its report preserves exact cases for investigation. No 2024 forecast errors have been computed.

## Resolution of the three Q discrepancies

FIA original Monaco classification lists Alonso16 with no Q2 lap, while the final F1 result promotes him14 after the Haas DSQs. Thus final position alone falsely credits Q2. Primary evidence: https://api.fia.com/events/fia-formula-one-world-championship/season-2024/monaco-grand-prix/qualifying-classification and https://www.formula1.com/en/results/2024/races/1236/monaco/qualifying. The audit records the explicit historical progression correction; this is past scoring replay only, never a pre-event forecast feature.

The HAA R8 and WIL R15 archived teamwork fields are zero with no classified driver, rather than -1. Applying this observed historical-source behavior resolves the other two cases. This does not prove the same behavior for other seasons or replace primary historical rules corroboration. All 1078 driver and 538 checkable constructor sessions now replay. Williams R3 remains uncheckable from the active-only cohort. The initial discrepancy report is retained as fantasy-tools-driver-rule-replay-2024-initial.json.

Production scoring remains unchanged. Price timing anchors, historical pit-rank simulation and explicit one-car coverage policy remain necessary before model comparison on 2024. No forecast errors have been evaluated.

## Pit award identity audit

All 240 constructor pit awards match their archived rank descriptions. Every race assigns each of ranks1/2/3 exactly once and conserves 18 points: 10+5+3. Multiple stops by the same constructor can occupy multiple ranks (maximum18), so a single-best-stop-per-team simulation is insufficient to reproduce the allocation mechanism. Separate overall-fastest/world-record fields are zero throughout this source season. No seconds or physical stop counts are inferred. Reproduce with scripts/audit-fantasy-tools-pit-rules-2024.ts.

Price timing remains pending: search of official articles did not find reliable midseason2024 anchors. The 678 matching price transitions and independent secondary launch list support source consistency but do not resolve Red Bull R13/R14 or prove publication timing for every quote. Do not silently change29 to29.1. The next benchmark must retain this limitation or obtain contemporaneous source evidence.

## Implemented historical pit scoring helper

Research module src/lib/pit-podium-2024.ts allocates10/5/3 to distinct individual stops and permits repeated constructors. Source-ranked input requires all three ranks; observed/simulated time input validates identities, finite positive times and rejects unresolved ties affecting podium selection. No historical stop durations are inferred from awards. Six tests pass, including replay of all24 source-ranked podium allocations and repeated-team, incomplete-input and tie cases. Type checks pass.

No production caller enables this helper. It implements scoring, not the stop-count/pace distribution needed for forecasting; fitting that distribution must remain past-only and separately validated. Current2026 pit scoring is unchanged.

## Normalized component archive

The importer now accepts an explicitly requested2024 season while keeping default2025 behavior and rejecting mismatched/unsupported seasons. The pinned2024 source produces719 normalized observations in src/data/component-history-2024.json. Session and weekend conservation/identity guards are shared with2025;13 importer tests pass. Missing Williams R3 and disputed Red Bull R14 quote remain explicit metadata; prices are retained as retrospective source quotes, not certified pre-event inputs. No production path consumes this archive and no2024 forecast errors have yet been computed. Reproduce with scripts/sync-fantasy-components-2024.ts using the pinned cache.

## Further price/source checks and pre-lock collection

An exact Internet Archive CDX query for2024 JSON captures of fantasy.formula1.com/feeds/drivers/*_en.json returnedHTTP200 with zero rows. The logged query is in official-price-archive-search-2024.json. This establishes only no matches for that pattern/filter, not absence of all official archives. No disputed price is repaired.

A separate2024 OpenF1 collector uses the same completed-session cutoff and identity parser as2025, with its own pinned calendar hash/cache/output. It collects context only, not forecast errors. A19-driver Australian practice field is retained honestly rather than filling a missing car; this agrees with the active-source coverage issue already recorded. Retrospective provider publication timestamps remain unknown.
