#2023 independent-source suitability audit

Public source https://f1fantasytools.com/api/statistics/2023, pinned SHA256 cbcd067a6134ce2439c9d883b7cee71b7c06ac21a0ef62cbeae396f42f9746eb.22 calendar events,660 active asset rows,1500 scored sessions. Calendar ID6 is absent; preserved as a source-calendar gap, not assigned zero. All active cohorts are complete.627 consecutive same-ID price transitions agree; original quote timing remains to corroborate.

Three constructor session sums disagree with reported totals: ALF R11Q sum-21/reported-16; FER R19R sum-12/reported-2; MER R19R sum-19/reported-9. Their weekend totals disagree by the same5/10/10. Historical source component DSQ fields are CTQ-20/CTR-35, while drivers areQ-15/R-25; do not silently apply2024 rules or overwrite totals. These cases need primary historical-score/rule evidence or explicit exclusion in a frozen validation cohort, including causal handling of their later training history.

All other session sums match. No2023 forecast errors have been computed. Script records discrepancies, not success of a complete scoring replay. See fantasy-tools-source-audit-2023.json for observed awards and exact cases.
