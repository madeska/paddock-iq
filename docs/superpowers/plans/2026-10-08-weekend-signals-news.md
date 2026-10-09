# Pre-lock weekend signals and news plan

Approved scope: normal latest completed FP3 (fallback FP2/1); sprint FP1 plus completed Sprint Qualifying; pre-lock confirmed grid penalties with source and session identity. No accuracy claim without paired evaluation.

1. Test live sprint session collection using injected OpenF1 responses: FP1 and SQ are separate, unfinished/future/cancelled sessions excluded. Keep normal snapshots compatible.
2. Extend shared baseline to accept sprint FP1. Extend component simulation to use complete SQ standings as sprint starting grid and a fixed pace signal, preserving historical fallback when incomplete. Keep qualifying scoring separate from penalties.
3. Implement source-aware penalty eligibility and provisional grid application; refuse unsupported back-of-grid/pit-lane complexity rather than silently guess. Test event/year/session/time/rumor/duplicate boundaries and component totals.
4. Fetch official F1 news, identify current-event grid-penalty mentions, retain source publication time and uncertainty. Automatic extraction must fail closed; only unambiguous confirmed numeric penalties enter the model. Surface pending mentions and source-fetch failures.
5. Connect auto-prediction API context and display current-session/news explanations. Run focused tests, strict scripts type checking and app type checking; document fixed heuristic limits, commit and update PR.
