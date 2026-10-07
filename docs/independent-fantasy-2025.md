# Independent Fantasy totals, 2025

This archive provides factual Fantasy point totals for independent-season experiments. It does not fabricate historical prices or incomplete scoring breakdowns.

Source: [JoshCBruce/fantasy-data](https://github.com/JoshCBruce/fantasy-data), pinned commit `1bb0e02d06e1567e01cda53532e031a4086eac2f`. The author describes scraping official Fantasy statistics. The resulting data is a third-party archive, not independently verified official raw feeds. The Git tree blob hashes for all 62 source files are pinned in `src/data/fantasy-source-manifest-2025.json`; importer rejects any mismatching cache body.

The older snapshot was captured 2025-08-10, after Hungary and before Netherlands. Its R15 entries are unplayed placeholders and are excluded. Normalized R1–14 includes 280 active driver and 140 constructor labels. Historical active driver/team identities come from the separate OpenF1 roster archive; current team/value fields in the source do not become historical predictors. Zero and negative played totals are preserved. COL/DOO snapshot season totals differ from summed race totals and are recorded explicitly in provenance.

The latest snapshot was captured 2025-11-19, after Brazil and before Las Vegas. The source scraper maps country name to round, causing collisions for Italy and United States. Its per-asset numeric sort is stable and retains chronological occurrence order. For unmerged assets, those occurrences recover Italy R7/R16 and United States R6/R19/R22. Recovery is checked against every available older R1–14 total/name anchor: 428 anchors match. All normalized active R1–14 rows exactly equal the earlier dataset.

The source's team-swap merger collapses round/country keys and discards conflicting rows for LAW/TSU. Earlier anchors recover their R6/R7 labels; R16/R19 remain unknown. Four unknown labels are omitted with explicit IDs, never represented as zeros. Normalized R1–21 contains 626 known labels; complete coverage would be 630. Constructor coverage is complete. Empty R22 rows are excluded by extraction chronology.

Files:

- `src/data/fantasy-totals-2025.json`: 420 known totals, R1–14.
- `src/data/fantasy-totals-2025-extended.json`: 626 known totals, R1–21, four audited missing driver labels.
- `src/data/fantasy-source-manifest-2025.json`: immutable source identity and blob hashes.

R15–21 is reserved for a final Fantasy-score-error evaluation until a new model protocol is frozen. Physical race ranks from those events were previously inspected in rank-only research, so the events themselves are not wholly unseen. The Fantasy-error partition has not been used for selection. Source-quality inspection alone is not a model-error benchmark.

Historical 2025 pre-lock prices have not been established. An exact recreation of the current price-feature production comparator is therefore unavailable for that season; comparisons must explicitly identify a price-free adaptation or other reference. OpenF1 physical DNF flags are not inferred into Fantasy classification labels.

Reproduce with `npm run fantasy:sync-totals-2025` and `npm run fantasy:check-total-archive`. The sync validates source content, chronological cutoffs, country occurrences, anchor equality, actual rosters, totals, missing-label allowlist and exact expected coverage. No production API consumes these snapshots.
