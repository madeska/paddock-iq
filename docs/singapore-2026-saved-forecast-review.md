# Singapore R17 saved forecast review

Captured from the local public market API on 2026-10-12. All 33 official totals were available, and the active forecast had advanced to R18 United States GP with updated prices and complete projections.

| Cohort | Assets | MAE | RMSE | Mean forecast minus result |
|---|---:|---:|---:|---:|
| Drivers | 22 | 12.209 | 15.056 | +3.682 |
| Constructors | 11 | 17.255 | 22.461 | +7.236 |
| All | 33 | 13.891 | 17.868 | +4.867 |

Largest errors: FER 51.0 versus 91 (+40 actual minus forecast), ALP 17.4 versus -20, AUD 26.9 versus -9, BOR 6.2 versus -29, COL 4.6 versus -28. The aggregate bias is an overestimate despite underestimating Ferrari and the leading drivers. Component breakdowns are needed before attributing these errors to reliability, overtakes, sprint strength or constructor scoring. These totals alone do not identify which change would improve future predictions.

Direct official player-popup checks confirmed BOR, COL and STR failed to classify in both sprint and race. Their session totals were respectively -10/-19, -10/-18 and -9/-19, with zero qualifying points. Earned overtakes explain why these are not all exactly -30. VER's 53 comprised sprint 8, qualifying 10 and race 35 (including driver of the day); LEC's 43 comprised sprint 6, qualifying 9 and race 28 (including fastest lap). These identify realized component outcomes behind the residuals. They do not prove that those failures or awards were predictable before lock, or justify fitting a parameter to this single race.

Source endpoints inspected: `https://fantasy.formula1.com/feeds/popup/playerstats_{id}.json`, IDs BOR 11051, COL 11059, STR 129, VER 131 and LEC 115. Parsed completed/played R17 session components sum to the separately verified round totals.

The currently saved R17 values match the public API values inspected before the race in this development conversation. However, that API version did not expose creation timestamps or source text, and no immutable capture receipt is asserted. This report is a descriptive review, not a certified independent prospective evaluation. One race is insufficient to establish model superiority or tune replacement coefficients. The new API metadata helps subsequent reviews inspect provenance but is not an immutable capture mechanism.

Prediction generation now rejects an already passed forecast round, or a round with any verified completed-race score, before fetching sources or deleting predictions. Existing historical forecasts remain readable. This protects saved comparisons once completion is recorded; it does not freeze every pre-lock forecast version or provide a concurrency-safe archive of earlier edits.

Read-only reproduction while the local app is running:

```
npx tsx scripts/review-market-forecast.ts 2026 17
```

`PADDOCK_BASE_URL` can point to another installation. The JSON includes coverage, MAE/RMSE/bias, largest errors and available forecast/source timestamps. Missing forecasts or actuals are excluded and listed, never converted to zero. Raw captured values: `singapore-2026-saved-forecast-review.json`.
