# Shared production calculations with audited 2025 prices

Source: https://f1fantasytools.com/api/statistics/2025 (anonymous public request, HTTP 200). Raw snapshot SHA-256: 8f1603e517c0506e255ca1f274ce83297288fc24e870cd1e2dc56e37a73ff162. Normalized prices are in src/data/fantasy-prices-2025.json. This is a retrospective third-party source, not a contemporaneously captured official quote feed.

There are 720 active quotes: 20 drivers and 10 constructors across 24 rounds. Every one of the 687 comparable consecutive active identities obeys price[r] + priceChange[r] = price[r+1]. Nine quotes match official pre-event article prices: Spain R9 NOR31.0, SAI8.7, BEA7.5, HAD5.5, ALO4.5, MCL32.4, RBR27.2; Britain R12 HAD6.9 and SAU7.5. Together the transition identities and primary pre-event anchors support interpreting price as the quote before the corresponding weekend. Initial full-field contemporaneous captures remain unavailable. The 420 audited R1–14 totals also agree with this source after constructor aliases are normalized.

Primary anchors:
- Spain: https://www.formula1.com/en/latest/article/f1-fantasy-strategist-selection-whats-the-best-line-up-for-the-2025-spanish.1iibj0MhfA8U76gyDWAmwq
- Britain: https://www.formula1.com/en/latest/article/f1-fantasy-strategist-selection-whats-the-best-line-up-for-the-british-grand.alBKMPSXk54fQyiKdv6tt

The price normalizer returns only round, code, type, team and priceBefore. Target scores and subsequent price changes never become forecast inputs. The importer pins the snapshot hash, checks all transitions and article anchors, and verifies earlier audited totals. Historical inactive alternate driver IDs do not enter the active quote roster.

## Replay scope

The shared API baseline and component calculations run before practice, using the current active historical quote roster, historical quotes and only earlier scores. Settings preserve training start6, sample SD, overtake1.2, simulations3000, production seed202600+round, unsupported-constructor baseline fallback and 0.1-point rounding. This is an algorithm replay, not a reconstruction of a particular persisted database or an after-practice forecast. The2026 official archive field audit now identifies Value as same-round quote and OldPlayerValue as preceding snapshot quote; this2025 replay uses its separate historical price archive. Exact historical publication and persisted database timing remain separate audit questions.

R6–14 has already been used in prior research, so this comparison is exploratory. Reserved R15–21 forecast errors remain unused. No new model or parameters are selected here. Frozen direct-v1 and ensemble-v2 use their previously committed protocols. All models are evaluated on the same 179 driver and 90 constructor observations. COL R7 has no prior score history and is missing from production coverage; it is explicitly reported instead of replaced with a zero.

| Model | Driver MAE | Constructor MAE |
| --- | ---: | ---: |
| Shared production, before practice | 10.6844 | 17.4589 |
| Baseline only | 10.8095 | 18.0944 |
| Frozen direct v1 | 10.9531 | 17.6689 |
| Frozen ensemble v2 | 10.6844 | 17.3578 |

The ensemble constructor delta is -0.1011 points, race-block bootstrap interval [-1.0400,+0.6933]; it does not establish a robust improvement. Removing components worsens constructor MAE by0.6356, interval [+0.1933,+1.0911]. These results supersede neither the earlier frozen price-free report nor its scope; they add a better-aligned comparator. No production model activation follows.

Next: incorporate timestamp-validated pre-lock practice information and resolve cold-start coverage, freeze the resulting policy, then use the reserved error evaluation once. Reusing the exploratory segment to select changes must not be presented as independent validation.

## Later scoring-profile correction

The initial results above preserve the original 2026 Sprint scoring assumption. A full archived-session audit found that 2025 requires Sprint NC -20, and historical constructor race DSQ differs too. See components-2025-rules-aware.md and the separate rules-aware reports for corrected values and parameter selection. Initial snapshots are retained for provenance, not presented as the final 2025 scoring replay.
