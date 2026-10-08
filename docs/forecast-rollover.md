# Post-race forecast rollover

ForecastSeasonState persists the active round for the supported 2026 deployment, starting at R17. Market, My Team and default prediction generation share it. Historical requests may still name an explicit round.

The completed-score sync advances only the current cursor and only after a finished race has agreeing official totals for every active asset, no pending/error/protected rows, and the complete verified set is stored. Compare-and-set prevents concurrent calls from skipping rounds. R23 completes the supported season without inventing R24. Official sources can issue later corrections; publication is not a guarantee of irrevocable finality.

The visible market polls every five minutes. On rollover it clears old news and generated teams, loads the next market and generates missing predictions. Reopening the page resumes missing forecast generation. A missing next feed or failed forecast is reported and can be retried with Refresh projections; old forecasts are not relabelled as the next round. This is browser-driven, not an always-on scheduler. Existing completed scores are preserved by historical market refreshes. No private team lineup is changed.

Upgrade: stop the server, pull changes, run npx prisma migrate deploy, npm run db:generate, then npm run dev. The migration only adds ForecastSeasonState; it does not reset user data. Tests use fake adapters; the user's database migration is not executed by this development task.
