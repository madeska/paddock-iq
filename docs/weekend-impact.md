# Practice and Sprint Qualifying impact

After **Refresh projections**, open **Practice / Sprint Qualifying impact on xPts** in **Before team lock**. It lists all supported assets, including constructors, with xPts without the completed sessions, xPts with them, and the change.

This is a counterfactual comparison using the same current prices, historical scores, sprint flag, simulation seed, confirmed grid penalties and production blend. It removes only practice and Sprint Qualifying inputs. It is not a comparison to the previous saved forecast, which may have had different history or penalties, and is not evidence of improved predictive accuracy.

Sprint FP1 modifies driver baselines and boost estimates. A complete Sprint Qualifying classification supplies the observed sprint starting grid and sprint pace signal. Constructor effects pass through their driver components; the constructor historical baseline is unchanged. The displayed table concerns the main xPts forecast, not the separate boost selector.

The table appears for the current refresh response and must be recalculated after reloading the page. It does not require a database migration. Existing predictions are calculated and saved with the unchanged production model.

Checks: `npx tsx --test scripts/check-weekend-impact.ts scripts/check-production-forecast.ts scripts/check-weekend-grid-simulation.ts scripts/check-weekend-signals.ts`.
