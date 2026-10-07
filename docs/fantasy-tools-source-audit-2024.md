# 2024 source suitability audit

Public retrospective source: https://f1fantasytools.com/api/statistics/2024. Pinned SHA256 6d88165bfcc63b676cec593cced2e4613cf3a125388e5679116bdabefb8d15e2. No forecast errors computed. This season remains available for a predeclared independent model comparison after scoring/price validation.

719 active asset-weekends and 1618 component sessions conserve every session and weekend total. Source has 19 active drivers in R3; preserve the missing field explicitly. 678 consecutive same-identity active price transitions agree. R13 Red Bull constructor price29 plus change0.1 does not equal R14 price29. Do not infer or silently repair that quote. Original pre-event official anchors are still required.

Historical source awards differ from current rules: driver qualifying DSQ -15, race DSQ -25; constructor qualifying DSQ can be -30. Race pit awards contain 3/5/8/10/13/15/18, with separate overall-fastest and world-record fields zero. These are observed source values, not a complete validated rules specification. Replaying with current 2025/26 scoring would not be a valid independent benchmark. Next work must reconstruct and corroborate year-specific scoring before calculating model errors, and resolve or explicitly exclude disputed prices/coverage.

Reproduce with scripts/audit-fantasy-tools-source-2024.ts; discrepancy details and observed award sets in fantasy-tools-source-audit-2024.json. This is a source audit, not evidence of improved predictive accuracy.
