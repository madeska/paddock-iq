# Shared weekend form and historical race pace

The simulator has optional driver-specific shared weekend form, race-specific pace and race noise inputs. These remain disabled in production. All existing seeded forecasts are identical when correlation is omitted or zero and no pace overrides are provided.

## Shared form

For each simulated weekend, draw one independent standard-normal latent form per driver. Each session combines that form with independent normal noise using sqrt(rho) and sqrt(1-rho). Map the normal CDF through the inverse Gumbel CDF before applying the existing session ranking noise scale. This changes dependence across qualifying, sprint grid, sprint finish and race finish while preserving each session's original Gumbel noise marginal within numerical approximation. Rho is latent Gaussian correlation, not a claimed empirical rank correlation.

No-time flags and retirements remain separate events. At rho=1, equal-strength classified drivers retain their grid order in the race; rho=0 takes the original code path without additional random draws. Tests also check qualifying-point marginals for both equal and unequal strengths.

Shared form alone did not improve the development objective. The lowest objective across those candidates was the current rho=0 model. This experiment does not establish that weekend sessions are independent in reality; it says this shared-form mechanism does not improve this forecast pipeline on the examined sample.

## Historical race pace

Race pace is estimated from the driver's prior classified race finishing positions, shrunk by five sessions toward position 11.5 on a 22-driver grid, then converted to ranking strength. Non-classified sessions are excluded from this conditional pace estimate, rather than assigned fabricated finishing positions. Existing non-classification probabilities remain separate and unchanged.

The development search compares the current model, shared-form variants, qualifying-history variants, conditional-overtake variants, and historical race pace. Race noise candidates are 0.15/0.3/0.5/0.75/1; all choices use rounds 6–11 only and three seeded 1,200-simulation runs. The objective is driver MAE plus half constructor MAE, an aggregate research criterion rather than direct team recommendation accuracy.

The selected candidate uses historical race pace, race noise 0.15, rho=0, existing qualifying and existing overtake estimates. In other words, selection favored race pace rather than shared randomness. No target or future race data enters its pace history.

## Results and limits

On development rounds:

| MAE | Current | Candidate |
|---|---:|---:|
| Driver weekend | 10.6524 | 10.5172 |
| Constructor weekend | 16.3028 | 15.4627 |

On previously inspected rounds 12–16:

| MAE | Current | Candidate |
|---|---:|---:|
| Driver weekend | 11.2749 | 11.2206 |
| Constructor weekend | 19.9005 | 19.5853 |
| Driver position-change points | 2.5042 | 3.5167 |
| Driver overtakes | 3.8544 | 4.0469 |

Driver and constructor weekend RMSE also decrease. However, driver bias worsens slightly and position-change/overtake errors increase. The aggregate improvement may involve compensating component errors and is not sufficient to promote this simulator as a physically better model.

A paired round-block bootstrap on just five later rounds estimates candidate-minus-current MAE difference:

- Drivers: -0.0543, interval [-0.2603, +0.1291]; no clear driver benefit.
- Constructors: -0.3152, interval [-0.5977, -0.0328].

These intervals are exploratory. The later rounds had already been inspected during previous model experiments; they are not a fresh holdout. Candidate search and a small number of rounds limit any inference. Do not equate these results with improved whole-team decisions or generalization to future circuits.

Before production activation, collect independent forward results and assess finish ranks, position-change awards, DNF handling and on-track overtakes jointly. Current production behavior remains unchanged by these optional settings.

## Reproduce

- `npm run fantasy:check-joint` — six tests for default-path identity, dependence, marginals, validation and race-specific ordering.
- `npm run fantasy:check-overtakes` — six tests including prior-only pace and retirement handling.
- `npm run fantasy:backtest-joint` — development selection, later comparisons and paired block bootstrap.

The numeric report is `joint-weekend-results.json`. The previous calibration/overtake/qualifying experiments remain available through their existing commands.
