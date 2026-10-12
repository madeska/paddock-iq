#2023 independent-source suitability audit

Public source https://f1fantasytools.com/api/statistics/2023, pinned SHA256 cbcd067a6134ce2439c9d883b7cee71b7c06ac21a0ef62cbeae396f42f9746eb.22 calendar events,660 active asset rows,1500 scored sessions. Calendar ID6 is absent; preserved as a source-calendar gap, not assigned zero. All active cohorts are complete.627 consecutive same-ID price transitions agree; original quote timing remains to corroborate.

Three constructor session sums disagree with reported totals: ALF R11Q sum-21/reported-16; FER R19R sum-12/reported-2; MER R19R sum-19/reported-9. Their weekend totals disagree by the same5/10/10. Historical source component DSQ fields are CTQ-20/CTR-35, while drivers areQ-15/R-25; do not silently apply2024 rules or overwrite totals. These cases need primary historical-score/rule evidence or explicit exclusion in a frozen validation cohort, including causal handling of their later training history.

All other session sums match. No2023 forecast errors have been computed. Script records discrepancies, not success of a complete scoring replay. See fantasy-tools-source-audit-2023.json for observed awards and exact cases.

## Primary rules and component discrepancy investigation

Internet Archive recovered official HTML/client snapshots. The English rule defaults in rules.6de99bd2.chunk.js were captured2023-10-18 before AustinR19. They specify constructor inheritance of both driver totals, excluding DOTD in the race, and10/5/3 pit awards. The source reported R19FER(-2) andMER(-9) exactly match those inherited driver totals plus pit awards; their separate CTDSQ fields(-35) instead of driver penalties(-25) explain the ten-point component mismatch. Preserve reported totals and flag inconsistent fields rather than treating this as a bad race total.

ALF R11 similarly reconstructs-16 from driver-15 and teamwork-1. However its earlier rules chunk40383c50 could not be recovered, so October defaults alone do not establish the exact July rule. Runtime English translation overrides also remain a limitation. Hash manifest and exact cases: official-rules-2023-evidence.json. Raw source is unmodified; no forecast errors computed.

Official F1's2023-04-27 Baku mini-league article sets joining before Friday qualifying: https://www.formula1.com/en/latest/article/f1-fantasy-more-chances-to-win-amazing-prizes-as-latest-mini-leagues-launch.5M4zAwtUOQUNAk8AwnZPxJ. Therefore do not import Saturday SQ results into that Friday prediction context.

## Frozen conservative label cohort

Before computing any2023 forecast errors, normalizeFantasy2023 conservatively excludes all three disputed constructor asset-weekends from both evaluation labels and every later training history. This avoids using even the two timing-supported totals without complete runtime-translation evidence.657 scores remain; all660 roster quotes remain separately with uncertified timing. Calendar ID6 is preserved as missing source slot, never a zero observation.

The raw source stays pinned and unchanged. A factual repository fixture removes narratives while preserving original scoring discrepancies, making three unit tests reproducible without an external cache. Tests verify exclusions, rejection of new mismatches, and prefix invariance to malformed future labels. Type checks and read-only review passed. Source timing and historical scoring/simulation adaptation remain required; no forecast errors computed.

## Independent pre-lock context and explicit scoring profile

The2023 collector maps provider races to source calendar by UTC race date rather than sequential calendar IDs. Completed practice must precede the earlier provider/source Qualifying lock, including sprint weekends. All22 weekends collected:21 practices, no SaturdaySQ, zero parser exclusions. R18 missing practice is explicit fallback; R2 has19 positions. Differences between provider/calendar lock are recorded, not silently repaired. Maximum source calendar ID23 and missing ID6 are preserved.

An explicit2023 research profile uses SprintNC20, no extra constructor raceDSQ beyond inherited driver totals, fixed Q2cut15 and the same previously frozen individual-stop pit heuristic as2024. The2024-only all-no-time qualifying adjustment stays2024-only.18 tests passed including unchanged2026 golden forecasts; type checks passed. Read-only review found no blockers; collector dead branch and maximum-round metadata were cleaned up. No2023 forecast errors computed.
