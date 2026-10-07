# Weekend error attribution

Fixed comparison: current forecast versus historical qualifying pace with noise 0.3. R12–16 has been inspected before; this is post-hoc diagnosis, not independent validation. Three seeds and 1,200 simulations per seed, with the existing 75% baseline / 25% component blend. Production remains unchanged.

We swap one component expectation into the current forecast, then reverse that swap in the candidate. No observed component is substituted into a forecast. These arithmetic swaps identify sensitivity; they are not coherent alternative weekend simulations, additive causal effects, or a proposed production ensemble.

| Swap candidate component into current | Change in xPts MAE |
|---|---:|
| Driver qualifying | -0.0477 |
| Driver positions | +0.1000 |
| Driver overtakes | +0.0616 |
| Constructor qualifying | -0.2215 |
| Constructor race-driver points | +0.4490 |

Negative is better. Restoring current positions and overtakes within the candidate improves driver MAE by 0.1053 and 0.0711 respectively, while restoring qualifying worsens it by 0.0606. Those deltas must not be added: absolute-error interactions make them nonadditive.

The diagnostic supports focusing on the relationship between predicted grid, race positions and overtakes. Improving qualifying alone does not ensure a better full-weekend forecast. Other components shift slightly because changes in rankings alter the simulator's random stream consumption; their small differences are not clean causal effects of qualifying.

All driver and constructor component expectations are checked to sum to their simulated totals. Driver/round/type pairs are explicitly checked before swaps. This analysis does not select parameters or activate a model.

Reproduce: `npx tsx scripts/backtest-weekend-error-attribution.ts`. Raw results: `weekend-error-attribution-results.json`.
