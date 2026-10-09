# Frozen shallow tree correction across seasons

849405a fixes the tree configuration and half residual correction before other-season tree errors. No tuning. Each type refits only on earlier forecast frames within that same season; no future target labels and no cross-year label leakage. Other-year full correction was not evaluated/selected.2024/2023 had been consumed by previous model families, so these are supplementary cross-season comparisons, not wholly blind seasons.

| Season | Driver MAE ref→tree | Constructor MAE ref→tree |
| --- | ---: | ---: |
|2025|10.5894→10.4137|18.3568→18.0311|
|2024|8.8653→8.6268|14.0705→14.3179|
|2023|10.8074→10.7669|16.1084→16.1749|

2024 driver paired race-block interval[-0.3973,-0.0805], constructor[-0.2105,+0.6863].2023 driver[-0.2607,+0.1950], constructor[-0.2220,+0.3292]. Driver RMSE improves2024(12.7304→12.5437) but slightly worsens2023(14.2964→14.3130). Constructor RMSE worsens both supplementary years. Bias also generally worsens, except2023 constructor bias improves despite accuracy deterioration.

This supports further research on driver-only correction, not deployment of a shared correction policy to both types. No production activation. Historical quotes/publication timing, fixed historical pit adapter and no explicit DSQ simulation remain material limits.2023 excludes three disputed labels from all history/outcomes; missing labels are not fabricated. Frame exports assert incumbent replay parity and future-score baseline invariance.2025 CLI remains default; use --season2024/2023 (with a separating space) for other files. Environment versions and frame hashes are saved per report. Read-only review found no blockers.
