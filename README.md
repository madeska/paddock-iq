# Paddock IQ — F1 Fantasy Strategy Assistant (MVP v0.1)

## Run locally
1. Install Node.js 20+ and PostgreSQL (or create a Neon database).
2. `npm install`
3. `cp .env.example .env` and set DATABASE_URL.
4. `npx prisma migrate dev --name init`
5. `npm run dev` and open http://localhost:3000.

The dashboard is a client-side prototype; the Prisma schema is prepared but UI persistence and authentication are **not yet wired**. Inputs reset on refresh. No unofficial API scraping or live Fantasy sync is included. Historical team details are transcribed from user screenshots. The visible `SUBS 2/2` is not assumed to equal current free transfers. `BANK $130.3M` is preserved as displayed, not assumed to equal squad value + cash.

### Market JSON example (illustrative, not actual F1 data)
`[{"code":"EXAMPLE","type":"DRIVER","price":8.2,"expectedPoints":20,"expectedDelta":0.3}]`

Prices are in millions. Enter prices and model forecasts for all 7 current assets and candidate assets. The initial optimizer handles **one** transfer only, enforces asset type and affordability, and applies a default 10-point penalty if free transfers are zero. The next iteration should add multi-transfer combinatorial optimization, actual season-specific rule validation, database-backed history, and predictive models. Do not treat its output as a live forecast.

## v0.2 data connection and optimization
- `GET /api/openf1?resource=meetings&year=2026` retrieves actual OpenF1 data on the server, cached for 5 minutes. Allowed resources: meetings, sessions, drivers, session_result, laps, pit, weather. Pass meeting_key/session_key for targeted queries. This is **race data, not Fantasy prices or points**. Upstream failures return 502; no fabricated fallback.
- `POST /api/optimize` accepts `{current,market,cash,freeTransfers,mode,weight?,penaltyPerExtra?,maxChanges?,locked?}` and returns up to 50 ranked 0–3 transfer scenarios. The no-transfer scenario is included. `current` must contain five drivers and two constructors; market prices and forecasts must be user supplied. A configurable penalty is applied to transfers beyond the available free allocation.
- Official Fantasy personal-team import and live prices are **not connected**: the unofficial API endpoints found online are historical and cannot be assumed to support 2026. No account credentials are requested or stored. The site is not deployed and has no database credentials.


## v0.3 screenshot import and data provenance
- `/api/team` returns the Panass screenshot snapshot, including 2 free transfers and the locked Final Fix. No authentication token or Fantasy team ID is needed for this read-only local snapshot.
- Asset prices are screenshot values; `expectedPoints=0` and `expectedDelta=0` are **unpopulated placeholders**, not predictions. Enter forecasts before interpreting recommendations.
- `/api/optimize` evaluates 0–3 simultaneous net replacements, allowing temporary deficits in the search while checking final affordability.
- OpenF1 is racing data only; there is no verified automatic Fantasy account connection, no live Fantasy price feed, and no deployment in this version.
- Before a production integration, validate the unofficial Fantasy endpoint's permission, response schema and authentication flow. Never paste session tokens in chat or expose them to the client.

## v0.4 forecast safety and transfer accounting
- Forecast fields are genuinely blank until manually entered; explicit `0` is allowed and is not confused with missing data. Recommendations remain disabled until all seven owned assets have both forecast fields filled and candidates have been imported.
- Reject duplicate asset codes and invalid optimization settings.
- Transfer accounting now reports paid transfers, penalties and *illustrative* next-round free-transfer carry. Carry cap is configurable (default 3) and must be verified against official season rules before production use.
- No verified official Fantasy price feed or account sync has been added. This is still a local prototype.

## v0.5 workspace persistence
- Browser-local workspace auto-save and reload: owned prices/forecasts, candidate market, selected strategy, free transfers, cash, locked assets. No credentials are stored.
- Export/import a JSON backup for moving between devices. Import validates the top-level format; treat imported data as untrusted, do not upload secrets.
- Lock selected assets to exclude them from sell recommendations. Prisma chip status now includes LOCKED.
- This is not database-backed user synchronization: Neon credentials and a deployment are still needed for that. No verified live Fantasy API integration or price forecast is claimed.


## v0.6 database foundation
- Added a shared Prisma client in `src/lib/prisma.ts`.
- Added `GET /api/db/health` to verify the configured PostgreSQL/Neon connection and report row counts.
- Added `prisma/seed.ts` to seed the Panass 2026 snapshot, seven owned assets, screenshot prices, free transfers, chip states and initial price history.
- Added `npm run db:seed` and `npm run db:studio`.
- This branch still does not fetch live F1 Fantasy prices automatically. Database setup is the next required environment step.


## v0.7 market and prediction layer
- Added `GET /api/market?season=2026&round=18` to expose database-backed asset prices and latest predictions.
- Added `GET/POST /api/predictions` for generating and reading price-change predictions.
- Added a transparent heuristic price model in `src/lib/price-predictor.ts` using recent price momentum plus expected fantasy-points input.
- Prediction rows now persist rise/flat/fall probabilities, confidence, source and model version.
- The heuristic is intentionally labeled as non-official. F1 Fantasy Tools publicly describes Budget Builder as using required point ranges and simulated price-change odds, so Paddock IQ follows the same *product idea* without copying a proprietary formula or dataset.
- Current database still contains only the seven screenshot-seeded owned assets. Full market ingestion is the next step.


## v0.8 full-market ingestion foundation
- Added `POST /api/market/import` for validated bulk import of drivers and constructors with current prices.
- The endpoint upserts assets by `season + code + type` and appends a `PriceHistory` row only when the price differs from the latest stored value for that Grand Prix.
- Import provenance is persisted through the `source` field.
- Example payload: `examples/market-import.example.json`.
- No live Fantasy price feed is assumed. Use only verified current market data; do not invent missing prices.


## v0.9 multi-user team import
- Added `POST /api/team/import` for creating/updating a Paddock IQ user/team and recording a new GP snapshot.
- Validates exactly five drivers and two constructors and rejects duplicates.
- Team imports reference the shared market by asset code; unknown assets are rejected so user imports cannot silently create fake market data.
- Chip state, cash, free transfers and total points can be stored with each user's team context.
- Example payload: `examples/team-import.example.json`.
- This is the data layer for multi-user support; production authentication/authorization is still required before exposing personal team data publicly.
