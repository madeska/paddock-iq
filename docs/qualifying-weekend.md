# Qualifying changes through the full weekend forecast

Research only; production forecasts are unchanged. This experiment tests whether the archive qualifying-noise result translates into better Fantasy xPts. It uses the existing 2026 forecast harness: 75% historical Fantasy baseline plus 25% component simulation, three seeds and 1,200 simulations per seed. Historical qualifying pace comes from earlier sessions only.

Five noise settings (0.15, 0.3, 0.5, 0.75, 1.05) were selected on R6–11 using driver MAE + 0.5 constructor MAE. The winner was 1.05. R12–16 was already inspected in previous experiments; these are exploratory comparisons, not a fresh holdout. The fixed archive setting 0.3 is a secondary probe. The current comparator retains its baseline-derived qualifying strengths; both experimental options replace them with historical qualifying pace. This is not a pure noise-only intervention against production.

| Later-round MAE | Current | Development-selected 1.05 | Archive probe 0.3 |
|---|---:|---:|---:|
| Driver xPts | 11.2749 | 11.3503 | 11.4121 |
| Constructor xPts | 19.8985 | 19.9430 | 20.1145 |
| Driver qualifying component | 1.8194 | 2.0329 | 1.2683 |
| Driver overtakes component | 3.8544 | 3.9748 | 3.9690 |

The 0.3 probe improves qualifying-component accuracy but worsens aggregate driver and constructor xPts and overtakes. The development-selected option also fails to improve the later aggregate forecasts. Qualification accuracy alone does not justify replacing the current weekend ranking. No rollout.

Reproduce: `npx tsx scripts/backtest-qualifying-weekend.ts`. Raw results are in `qualifying-weekend-results.json`. Next research should address joint qualifying/race behavior rather than selecting a qualifying-only winner.
