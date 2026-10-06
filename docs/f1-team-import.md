# F1 Fantasy team import

## User flow

1. Open `/team/import`. Drag **Export F1 team** to the bookmarks bar (or copy its URL into a bookmark).
2. Sign in on https://fantasy.formula1.com/en/ and open My Team until the lineup loads.
3. Run the bookmark from that tab. It downloads `paddock-iq-f1-team.json`.
4. Select that file in Paddock IQ, preview the exported teams, choose which one to open initially, enter the Paddock IQ profile email once, and click Save all teams. Every exported team is saved under that email.

The browser helper chooses the current season/round/phase from the official schedule. It uses the official client's priority: live, points processing, provisional points, current, upcoming. It refreshes the observed getteam request for that round and reads the matching public driver/constructor feed. There is no password form, token input, or background sync. Repeat the export after changing the lineup. Exports expire after 30 minutes. Manual setup remains available below the import flow. A successful save remembers the profile email, selected team and season in this browser. Subsequent imports reuse that profile; Change profile allows a different email. My Team automatically loads the remembered selection. Its Your teams selector lists all teams associated with that email for the selected season; switching updates the lineup, balances, chips and points and remembers the new selection. Team-specific optimizer results and locks are cleared when switching, and late responses from the previous team are ignored. This is a browser preference, not account authentication.

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

The frontend unwraps `Data.Value`, checks `Meta.Success`, and receives `mdid` and `userTeam`. Team rows use `playerid[].id`, `capplayerid`, `teamname`, `team_info.teamBal`, `team_info.userSubsleft`, and `ovpoints`. The current My Team UI uses nested `team_info.userSubsleft`; the top-level `usersubsleft` may describe a completed-round balance and is only a legacy fallback when the nested field is absent. Public player rows map `PlayerId` to `DriverTLA` and `PositionName`. Constructor rows can have empty `TeamName`; use their `DriverTLA`, including `HAA` → `HAS` and `RBS` → `RB`, with name-based fallback for older feeds. Positive numeric chip markers (including 4/5/6) mean used; zero means available. The old `fantasy-api.formula1.com/partner_games/f1` Bearer flow is not used. A public third-party OAuth registration/redirect flow has not been established by this inspection.

The helper reuses the user's browser session only on the F1 origin. It does not inspect cookies, local storage, passwords, or authorization headers. Request URLs and GUIDs are not exported. All requests remain on F1; only a whitelist of lineup/status fields is downloaded. No private F1 credentials reach Paddock IQ. No F1 team changes are made.

After updating from an older helper, replace the saved bookmark URL using the freshly loaded import page and export again. Old files cannot contain the newly included current transfer field; saving the new export replaces the previous snapshot balance.

## API and persistence

`GET /api/team/f1/helper` returns the standalone bookmarklet.

`POST /api/team/f1/import` takes `action: preview | save`, `export`, `season`, and `round`. Save also takes `email` and an optional `teamNo` to select which saved team opens initially. It always saves every exported team. The route rejects cross-origin submissions, exports above 100 KB, expired data, season/round mismatches, missing market mappings, duplicate picks, wrong 5+2 counts and invalid x2 selection. Responses use `Cache-Control: no-store`.

Preview returns normalized teams without writes. Save revalidates the original export and delegates to the existing `/api/team/import` handler's atomic TeamSnapshot transaction. It never trusts a client-provided normalized lineup. Optional fields remain unknown when not supplied. Negative remaining transfer balances (paid transfers already used) maps to zero remaining free transfers. Chip flags map to existing codes `WC`, `LL`, `AP`, `NN`, `DRS`, `FF`; absent flags do not overwrite existing chip state.

## Edit and delete on My Team

Edit team pre-fills the name, 5 drivers, 2 constructors, x2, cash, free transfers, points and chips. Changes apply to the Paddock IQ team; they do not submit lineup changes to F1. A later F1 import replaces local values with the source data on the same linked team ID. Editing creates a new snapshot and retains prior history.

`PATCH /api/team/manage` takes the profile email, teamId, name, round, complete assets, nullable cashBalance/freeTransfers/totalPoints and optional chips. It validates 5+2 unique picks and one driver x2, checks team ownership inside the transaction, updates the same team ID and writes a new snapshot. Duplicate names return a conflict. Source identifiers are internal and cannot be supplied through this request.

Delete team requires confirmation showing its name and saved history. `DELETE /api/team/manage` takes email and teamId, checks ownership and atomically removes only that team's transfers, slots, snapshots, chips, scenarios and team record. Shared market assets, Grand Prix records and the email profile remain. The UI selects a remaining team or shows the empty state after the last deletion. Deleted F1 source teams can be recreated by a later import.

Both management endpoints require same-origin submissions and retain the prototype's existing email-based identification. Opening the editor invalidates pending team requests so completed predictions cannot close the editor and discard unsaved input.

## Limits and validation

- F1's private interface is undocumented and may change. Public bundles/feed structure were inspected. A live authenticated export supplied by the user then confirmed private team retrieval and revealed the constructor TLA and numeric chip-marker formats covered by regression tests. Live saving to PostgreSQL remains to be verified.
- The underlying Paddock IQ profile is still identified by email, as in manual setup. This change does not supply application account authentication/authorization. The existing prototype should remain private until that is implemented.
- More than seven picks (Final Fix or swap history) are rejected rather than guessing the current seven. Use manual setup for those lineups.
- Exported team numbers/names are offered as returned by F1. All exported teams are saved under the same email. Duplicate exported names are rejected because existing team identity is name-based. F1 source identity is the exported team number scoped to profile email and season. Linked records retain their ID across local renames and F1 name swaps. Older unlinked rows are adopted by name only when they are not linked to another F1 number. This assumes one F1 account per Paddock profile/season.
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
