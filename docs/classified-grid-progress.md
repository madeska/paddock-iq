# Classified grid-relative progress and R18 capture

The experiment compares finishing-rank pace with historical progress among classified finishers. Starting positions are reconstructed from finish plus awarded position change, then ranked only among finishers. Promotions from another driver's retirement are removed from the historical progress signal. Gapped or ambiguous classifications are rejected; undetected missing tail finishers remain a retrospective-source limitation. Prior strength is the existing fixed 5, with default race noise and the preceding fixed qualifying pace/practice policy. No parameter search was performed.

Normal-weekend results on previously consumed 2025 R6–14 and 2026 R6–16:

| Driver MAE | Incumbent | Classified progress |
|---|---:|---:|
| 2025, 139 observations | 10.584 | 10.456 |
| 2026, 198 observations | 10.880 | 10.860 |

Constructor MAE improves slightly in 2025 but worsens 17.983→18.217 in 2026. A driver-only composition therefore retains incumbent constructor forecasts exactly. This composition was considered after observing constructor deterioration and is exploratory, not independent confirmation. Its overall MAE is 13.207→13.122 in 2025 and 13.247→13.234 in 2026. The 2026 driver paired race-block interval crosses zero [-0.117, +0.081]; no production activation is supported. Archived start reconstruction assumes the scored position-change field represents positions, as in the audited 2025/2026 adapter. This is not an authoritative final-grid reconstruction.

Replay: `npx tsx scripts/backtest-session-pace.ts --grid-relative`. Results are in classified-grid-progress-results.json. Practice, prices, active cohorts and scoring stay identical within comparisons. Both historical windows have already been consumed; earlier 2025 R15–21 and R22–24 errors were also consumed by half-blend research, not fresh holdouts.

## Prospective R18 checkpoint

Saved on 2026-10-12 at 10:34:08 UTC, before the verified normal-weekend lock on 2026-10-24. There is no completed R18 practice signal at this checkpoint. It contains 33 paired asset forecasts, normalized public historical asset/price/score inputs, completed component observations through R17, and source/code hashes. Live R17 component extensions must match this installation's separately verified official totals. Control forecasts matched the application's saved market for all 33 assets. Constructor forecasts are identical in control and candidate.

| Driver | Incumbent xPts | Candidate xPts |
|---|---:|---:|
| ANT | 31.0 | 28.5 |
| VER | 32.2 | 29.8 |
| LEC | 23.5 | 22.1 |
| RUS | 20.3 | 19.2 |

Checkpoint: `forecast-captures/R18-2026-10-12T10-34-08.584Z.json`.

SHA-256: `3c7f748c1d7404a55cb12930dbfe36a030c63007fff63c2e3c82c2202f2d6c85`.

The saved generation-source hash was checked against its unchanged source file before publication. This local capture and Git publication are evidence of a fixed pre-outcome checkpoint, not a trusted external timestamp service or immutable storage guarantee. Keep this initial checkpoint as its own evaluation; any later FP3 checkpoint is a separately reported comparison, not a replacement selected by its realized error.

Capture another normal-weekend checkpoint from the configured project checkout:

```
npx tsx scripts/capture-candidate.ts 18
```

The command reads public asset, price, score and season-state tables using the project's normal configuration; it does not query account/team tables or mutate the database. Only public forecast inputs are saved. It verifies normal-weekend lock, waits for complete input coverage, refuses captures at/after lock, and creates a unique file with exclusive-write semantics. No new dependencies or migrations are needed. `PADDOCK_ENV_DIR` can select the configured checkout when running the research code from another checkout; it is not written to the capture.

Evaluate this checkpoint after official R18 points appear, with the local app running:

```
npx tsx scripts/evaluate-candidate-capture.ts docs/forecast-captures/R18-2026-10-12T10-34-08.584Z.json 3c7f748c1d7404a55cb12930dbfe36a030c63007fff63c2e3c82c2202f2d6c85
```

Evaluation uses the saved paired values without recalculation, verifies identity/hash when supplied, waits for every captured official result, and treats genuine zero/negative totals as results. It reports driver/constructor/all MAE, RMSE and bias. The live pre-race check correctly returned WAITING with 33 missing actuals and no metrics. Later official corrections can change evaluation results; their available update timestamps are included. No background monitoring or automatic model switch is installed.
