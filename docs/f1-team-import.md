# F1 Fantasy team import

## User flow

1. Open `/team/import`. Drag **Export F1 team** to the bookmarks bar (or copy its URL into a bookmark).
2. Sign in on https://fantasy.formula1.com/en/ and open My Team until the lineup loads.
3. Run the bookmark from that tab. It downloads `paddock-iq-f1-team.json`.
4. Select that file in Paddock IQ, preview the team, choose the exported team number, enter the existing Paddock IQ profile email, and save.

The browser helper chooses the current season/round/phase from the official schedule. It uses the official client's priority: live, points processing, provisional points, current, upcoming. It refreshes the observed getteam request for that round and reads the matching public driver/constructor feed. There is no password form, token input, or background sync. Repeat the export after changing the lineup. Exports expire after 30 minutes. Manual setup remains available below the import flow.

## Verified public interface, 2026-10-06

Sources inspected:
- https://fantasy.formula1.com/static-assets/build/static/js/main.e05649f5.js
- https://fantasy.formula1.com/static-assets/build/static/js/app.6d872e52.chunk.js
- https://fantasy.formula1.com/static-assets/build/static/js/teams.9bb017d3.chunk.js
- https://fantasy.formula1.com/feeds/schedule/raceday_en.json

The current client uses same-origin services at:
- `GET /services/user/gameplay/{guid}/getteam/{optType}/{teamNo}/{gameDayId}/{phaseId}`
- `GET /feeds/schedule/raceday_en.json`
- `GET /feeds/drivers/{gameDayId}_en.json`

The frontend unwraps `Data.Value`, checks `Meta.Success`, and receives `mdid` and `userTeam`. Team rows use `playerid[].id`, `capplayerid`, `teamname`, `team_info.teamBal`, `usersubsleft`, and `ovpoints`. Public player rows map `PlayerId` to `DriverTLA` and `PositionName`. Constructor rows can have empty `TeamName`; use their `DriverTLA`, including `HAA` → `HAS` and `RBS` → `RB`, with name-based fallback for older feeds. Positive numeric chip markers (including 4/5/6) mean used; zero means available. The old `fantasy-api.formula1.com/partner_games/f1` Bearer flow is not used. A public third-party OAuth registration/redirect flow has not been established by this inspection.

The helper reuses the user's browser session only on the F1 origin. It does not inspect cookies, local storage, passwords, or authorization headers. Request URLs and GUIDs are not exported. All requests remain on F1; only a whitelist of lineup/status fields is downloaded. No private F1 credentials reach Paddock IQ. No F1 team changes are made.

## API and persistence

`GET /api/team/f1/helper` returns the standalone bookmarklet.

`POST /api/team/f1/import` takes `action: preview | save`, `export`, `season`, and `round`. Save also takes `teamNo` and `email`. The route rejects cross-origin submissions, exports above 100 KB, expired data, season/round mismatches, missing market mappings, duplicate picks, wrong 5+2 counts and invalid x2 selection. Responses use `Cache-Control: no-store`.

Preview returns normalized teams without writes. Save revalidates the original export and delegates to the existing `/api/team/import` handler's atomic TeamSnapshot transaction. It never trusts a client-provided normalized lineup. Optional fields remain unknown when not supplied. Negative `usersubsleft` (paid transfers already used) maps to zero remaining free transfers. Chip flags map to existing codes `WC`, `LL`, `AP`, `NN`, `DRS`, `FF`; absent flags do not overwrite existing chip state.

## Limits and validation

- F1's private interface is undocumented and may change. Public bundles/feed structure were inspected. A live authenticated export supplied by the user then confirmed private team retrieval and revealed the constructor TLA and numeric chip-marker formats covered by regression tests. Live saving to PostgreSQL remains to be verified.
- The underlying Paddock IQ profile is still identified by email, as in manual setup. This change does not supply application account authentication/authorization. The existing prototype should remain private until that is implemented.
- More than seven picks (Final Fix or swap history) are rejected rather than guessing the current seven. Use manual setup for those lineups.
- Exported team numbers/names are offered as returned by F1. Only the selected team is saved. Renaming a team follows existing name-based TeamSnapshot behavior.
- API persistence tests use a database test double. A real PostgreSQL write was not exercised locally.
- The browser flow is tested with controlled F1 and Paddock API responses, including actual bookmarklet navigation/download. The user has successfully exported a live team; complete the live preview/save before treating this integration as verified for deployment.

Checks:

```text
npm run db:generate
npm run fantasy:check-team-import
npx tsc -p tsconfig.ci.json --noEmit
npm run build
npm run fantasy:backtest-ci
```

Browser check (start Paddock IQ on port 3100 first, and install Playwright Chromium):

```text
npm run start -- --port 3100
npm run fantasy:check-team-import-ui
```

Set `PADDOCK_TEST_URL` to test another import page URL, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium binary.

The dependency lock now includes the already-declared Playwright dependency. Production TypeScript excludes standalone research scripts, matching the existing CI application check; these scripts previously caused global identifier conflicts during `next build` and continue to execute via their existing commands.
