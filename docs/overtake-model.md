# Grid-dependent overtakes and qualifying research

> Historical2026 price-dependent results below require recomputation after the 2026-10-08 quote-field correction. Original numbers are retained for audit history, not current accuracy evidence. See [quote field audit](official-price-field-2026.md). Frozen protocols are not silently rewritten.

These candidates are optional simulator inputs. Production does not pass `overtakeModel`, `qualifyingPace` or `qualifyingNoise`, so its forecasts remain unchanged.

## Conditional overtakes

A ridge-regularized Poisson count regression learns race overtakes from actual starting position and previous qualifying pace, including their interaction. Pace is the driver's average qualifying position shrunk by five sessions toward the midpoint of a 22-driver grid. Each training observation's pace uses only earlier rounds. Race starting position is reconstructed from recorded finish plus awarded position-change points; finish position is not itself a predictor. Failed-race overtakes use a separately pooled estimate because a retirement does not erase earned overtakes. Unknown drivers use neutral pace and pooled rates.

The fit uses completed prior driver sessions, excludes the target round and other seasons, has fixed ridge=8, and bounds count expectations to 0–25. Sprint overtakes remain unchanged. No track adjustment is claimed: circuit metadata has not been incorporated.

On previously inspected rounds 12–16, pre-weekend overtake MAE increases from 3.8544 to 4.0374. Driver total MAE is effectively unchanged (11.2749 to 11.2774); constructor MAE improves slightly (19.9005 to 19.7999), but its RMSE and bias worsen. This is insufficient to promote the model.

The known-grid diagnostic has MAE 3.7313, but uses actual start position AND classification. It is a diagnostic with additional information, not proof that the conditional model beats the current pre-weekend forecast. All later-round results are exploratory because these rounds were already inspected in earlier research.

## Separate qualifying pace

The simulator can rank qualifying using previous qualifying pace while keeping the race pace input unchanged. Qualifying noise candidates 0.15/0.3/0.5/0.75/1.05 were selected using qualifying-point MAE on rounds 6–11 only; 0.15 was selected. Final comparisons average three seeded 1,200-simulation forecasts.

On rounds 12–16, qualifying-point MAE improves from 1.8194 to 1.2441 (about 32%). However, driver weekend MAE worsens from 11.2749 to 11.4390 and constructor MAE from 19.9005 to 20.1512. Combining historical qualifying and conditional overtakes yields driver MAE 11.3419 and constructor MAE 19.8917. A component improvement is not sufficient to improve weekend predictions.

Qualifying-point MAE is only a proxy and does not validate the entire starting-grid ranking. A simple previous qualifying-point mean also improves this proxy (1.2595), with pooled fallback for newly active drivers. Further work should assess full ranking error and the interaction between qualifying, race pace, position-change awards and overtakes. The current independent ranking simulations may need a joint model; this experiment does not prove that correlation is the sole cause.

## Reproduce

- `npm run fantasy:check-overtakes` — five tests covering exposure, cutoff, fallback, optional integration and separate qualifying pace.
- `npm run fantasy:backtest-overtakes` — conditional count model comparison and diagnostics.
- `npm run fantasy:backtest-qualifying` — development-only noise selection and weekend/component comparisons.
- `npm run fantasy:backtest-calibration` — original comparison remains unchanged.

Numeric reports: `overtake-model-results.json` and `qualifying-model-results.json`. These are research models; do not enable them in production based on the diagnostic or a single favorable metric.
