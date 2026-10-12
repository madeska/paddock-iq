# Pre-lock sprint pace exploratory test

Research-only sprintPace option adjusts stochastic sprint grid and classified finishing rankings. Completed SQ rank is a pace signal, not an asserted final grid. Main qualifying and race rankings retain their original inputs. No caller in production enables this option. Absent option preserves golden seeded forecasts; non-sprint outputs are identical.

Fixed signal (11.5 - SQ position)/6, without tuning, evaluated on already-consumed R6–14. Only sprint rounds R6 and R13 change in this window; three earlier/target SQ archives exist. Each SQ session end precedes the documented lock. Retrospective result-publication timestamps remain unknown. No independent validation claim.

Driver MAE 10.6626 → 10.6682 and RMSE 14.0179 → 14.0269. Constructor MAE 17.4333 → 17.4478 and RMSE 21.4340 → 21.4495. This signal does not improve the full forecast; no activation. Nine-round bootstrap contains seven unaffected blocks, so its narrow interval is not evidence from nine sprint events.

15 targeted tests passed, including default full forecast parity and isolation of the sprint option. Type checks passed. OpenF1 documents final session results and starting grid as separate endpoints: https://openf1.org/docs/. Actual grid publication/corrections cannot be assumed from SQ completion alone.
