# Separate 2025 race archive validation

The archive contains 24 Grands Prix and 480 registered driver records from public OpenF1 race results, official starting-grid records, qualifying results and driver identities. It preserves one missing race-result row and one missing qualifying-result row as unknown. Missing outcomes do not become DNS, DNF or successful observations. Qualifying-session identities provide an explicitly matched fallback when a race driver identity is absent.

Source: [OpenF1 documentation](https://openf1.org/docs/). Starting grids are queried using the qualifying session key; the provider's [parser](https://github.com/br-g/openf1/blob/main/src/openf1/services/f1_scraping/starting_grid.py) retrieves the official Formula 1 starting-grid page. Downloads are cached and spaced at least 2.2 seconds apart. Failed retries or incomplete fields are reported, not silently filled.

## Scope

This is a newly examined retrospective season with parameters frozen before its evaluation. It is not an as-if-live 2025 forecast: model settings came from the earlier 2026 research. Each forecast's driver history still uses only earlier 2025 races.

The comparator is an ordinal performance-history index, combining available qualifying and finishing ranks (physical race failures contribute zero to that index). Unknown components are omitted, with a neutral fallback if both are unavailable. It is not the production Fantasy baseline because archived Fantasy prices and all scoring components are unavailable.

The candidate uses historical classified finishing pace or historical grid-relative progress, with the same five-session priors and noise settings established before this archive was examined. A 20-car field uses midpoint 10.5. Physical failure rates use past provider DNF/DNS/DSQ flags with pooled priors; those flags must not automatically be interpreted as Fantasy non-classification.

## Timing and metrics

Evaluation covers rounds 6–24, with five seeds and 2,000 simulations per seed. All 20 registered drivers enter each prediction. Actual target failure flags and finishes are used only to evaluate predictions. Rank/progress evaluation uses 333 known finished-driver observations.

Pre-qualifying mode predicts its grid from prior qualifying ranks. Known-grid mode provides the actual grid available before the race. Missing grid entries are preserved; only explicit pit-lane markers can be mapped to the slot after the field. The simulator rejects incomplete or duplicate normal grid inputs.

Predicted finish ranks and progress are conditional on the driver finishing. These are rank diagnostics, not Fantasy xPts or whole-team recommendations.

| Finish-rank MAE | Pre-qualifying | Known grid |
|---|---:|---:|
| Ordinal index comparator | 2.9898 | 2.9898 |
| Historical race pace | 2.9472 | 2.9472 |
| Grid-relative progress | 3.0334 | 2.5507 |

Grid-relative progress improves the known-grid point estimate by about 15%, but does not improve pre-qualifying finish-rank error. Pre-qualifying position-change MAE improves from 3.3442 to 2.7865; that does not establish an overall win when finish-rank error worsens.

With a fixed actual grid, gain error is the negative of finish-rank error, so their MAEs are identical by construction. They are not two independent confirmations. The same physical failure model is used in all comparisons and yields Brier 0.11051.

A 10,000-sample paired race-block bootstrap gives candidate-minus-comparator rank-MAE differences:

- Pre-qualifying: +0.0435, interval [-0.0652, +0.1430].
- Known grid: -0.4392, interval [-0.8662, +0.0074].

Both intervals include zero. Known-grid results are promising but are not a statistically clear general improvement. Full Fantasy totals, legal on-track overtake awards, DOTD and pit scores are not validated by this archive.

No experimental settings are activated in production. Optional known-grid inputs and rank diagnostics leave the existing seeded path and normal response shape unchanged when omitted.

## Reproduce

- `npm run fantasy:sync-race-archive` downloads and validates 2025 data, using the public cache in `../simulation-research/openf1-2025`.
- `npm run fantasy:check-race-archive` verifies parsing, unknown outcomes, past-only fitting and known-grid simulation.
- `npm run fantasy:backtest-archive-pace` reproduces both timing comparisons and the paired bootstrap.

Dataset: `src/data/race-archive-2025.json`. Report: `archive-pace-results.json`.
