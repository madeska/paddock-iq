# Does classified progress select better Fantasy teams?

Decision: **do not activate the driver-only classified-progress candidate** on this evidence. Its small asset MAE improvement did not improve team selection on the tested historical rounds. Production and the immutable prospective R18 capture remain unchanged.

| Season | Normal rounds | Budget comparisons | Changed lineups | Wins / losses | Mean actual points delta |
|---|---:|---:|---:|---:|---:|
| 2025 | 7 | 28 | 3 | 0 / 3 | -3.321 |
| 2026 | 9 | 36 | 3 | 0 / 3 | -0.139 |

The other 58 comparisons chose identical lineups and boosts. Four budgets per race are correlated observations, not 64 independent races. Round-block bootstrap intervals for the mean delta are [-9.321, 0] and [-0.333, 0]; these results do not establish universal inferiority or superiority.

Changed selections were:

| Season / round | Budget, $M | Incumbent driver → candidate driver | Actual team delta |
|---|---:|---|---:|
| 2025 / 9 | 125 | LAW → BEA | -9 |
| 2025 / 10 | 120 | ALO → LAW | -42 |
| 2025 / 10 | 125 | ALO → LAW | -42 |
| 2026 / 7 | 130 | COL → OCO | -1 |
| 2026 / 7 | 135 | COL → OCO | -1 |
| 2026 / 8 | 120 | COL → OCO | -3 |

## Fixed comparison

The candidate uses the preceding [classified progress experiment](classified-grid-progress.md): earlier classified start/finish progress with prior strength5, historical qualifying pace and fixed25% complete practice contribution. Constructor forecasts stay incumbent. There is no parameter search in this experiment.

Both policies exhaustively select five distinct drivers, two distinct constructors and a boost driver at fixed budgets120/125/130/135. The points objective and separately rounded ridge boost forecast follow the app; when ridge is unavailable, each policy falls back to its main forecast. Actual team score sums seven official asset totals plus the boosted driver's total, including zero and negative scores. There are no chips or transfer costs.

The benchmark resolves exact forecast ties lexically. The UI also uses projected price change to break ties; this experiment isolates points selection and does not replay that secondary ranking, filters, diversity, or other builder modes. Costs use integer hundredths of $M.

Roster eligibility uses current pre-event quotes and historical forecast coverage only. Actual-score availability never selects the roster; missing actuals for an eligible asset fail the experiment. COL in 2025R7 lacks prior score coverage and is excluded from both policies. All other tested rosters have full forecast coverage. The retrospective oracle chooses from this same eligible roster and measures regret only; its outcomes never enter forecasts or selection.

2025 uses tracked R6–14 normal weekends (7 races); 2026 uses tracked R6–16 normal weekends (9 races), with completed pre-lock practice supplied equally to both policies. These windows were already consumed by earlier research and are exploratory. This is not fresh validation. The pre-outcome R18 capture stays available for a separate prospective check after official results.

## Reproduce

```
npx tsx --test scripts/check-lineup-utility.ts
npx tsx scripts/backtest-lineup-utility.ts
```

Full paired selections, actual totals, bootstrap summaries and excluded assets are saved in [lineup-utility-results.json](lineup-utility-results.json). The helper and benchmark read local public archives, do not access accounts, and do not write the application database.

Future candidate reports should include both asset errors and paired realized team utility. A small MAE gain alone is insufficient evidence to replace production.
