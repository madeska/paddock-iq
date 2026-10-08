# Pre-lock practice, Sprint Qualifying and grid penalty news

After Refresh projections, the market page shows completed practice coverage, Sprint Qualifying coverage, sourced penalty headlines and any news failures. No migration or F1 credentials are needed.

## Inputs and behavior

- Normal weekend: latest completed practice, normally FP3; fallback FP2/FP1 if a later result is absent or invalid.
- Sprint weekend: completed FP1 affects driver baseline and x2 forecast with the existing 0.5*(11.5-position) modifier. Complete, unique SQ classification supplies the provisional sprint grid. Missing drivers or invalid ranks cause sampled-grid fallback.
- A complete observed SQ grid also supplies a 50% standardized position / 50% historical strength sprint pace signal. SQ receives no Fantasy qualifying points. Main qualifying is still simulated separately.
- Constructor component scores inherit the changed driver sprint/race outcomes; their historical baseline is unchanged.
- Only sessions ending strictly before both forecast time and lock are eligible. Source session IDs and driver/rank ambiguity are checked.
- Missing database deadlines can resolve through Fantasy Tools calendar round/name/race-time identity and the matching OpenF1 meeting. Lock is earliest stored/calendar/provider time; sprint start or main qualifying start respectively. Failure to establish identity leaves new inputs unavailable. This does not certify an official Fantasy countdown if a special deadline differs from the session start.

## News

The scanner reads the latest official Formula1.com article links and up to six penalty/grid related articles, parsing NewsArticle publication/edit metadata. The UI explicitly says this is limited headline coverage, not a complete FIA decision feed. Publisher failures are visible and never mean there are no penalties.

A numeric grid penalty is applied only when an official headline identifies exactly one active driver, explicitly confirms the drop, says it is for/at the current GP or Sprint, identifies the target session and provides valid publication/edit times before forecast and lock. Only same-season reports within 14 days qualify. Reports with uncertainty, appeal/reversal, competing stories, pit-lane/back-of-grid wording without a numeric drop, or missing details stay pending. A live scan crossing lock is not applied. News is not replayed retrospectively as pre-lock evidence.

Numeric drops use a provisional classified-grid procedure: temporary places, unpenalised drivers filling free slots, compression and >15-place back group. Main qualifying scores remain based on qualifying classification. Grid changes alter position gains/overtakes and a fixed 0.1 standardized-strength adjustment per changed grid position conditions finish sampling. Numeric penalties are not reapplied to an already supplied race starting grid. No-time classification and special steward decisions require final-grid verification; this is not a certified FIA final grid.

## Accuracy and limitations

These are newly enabled, fixed heuristics, not a demonstrated accuracy improvement. Practice rank can be distorted by fuel/tyres/weather; the existing modifier is not a long-run lap-time model. SQ pace weight and grid-to-finish coefficient still require leakage-free calibration. The prior 2026 eight-model and driver-only comparisons do NOT evaluate this new combination and must not be presented as its results. A complete FIA decision ingestion, team news ingestion and authoritative pit-lane/final-grid reconciliation remain outside this first implementation.

## Checks

Focused tests cover normal/sprint cutoff, incomplete/ongoing SQ, missing database lock, confirmed/uncertain/other-event/late news, source retrieval, grid-drop ordering, component totals and unchanged no-context forecasts. Run the weekend signal, grid news, grid simulation, practice cutoff, production forecast and replay check scripts with tsx --test. Run application tsc and standalone strict tsc for the new scripts.

Frozen tree exports and the existing prospective tree protocol deliberately retain the pre-weekend-v3 normal-practice-only reference. They compare that historical policy, not the newly updated live incumbent. This is explicit in scripts/tree-forecast-frames.ts; new weekend-v3 accuracy experiments require a separately versioned artifact. Historical model fixtures are not regenerated to hide a changed reference.

Article parsing now reads official rich-text blocks (or structured articleBody). Exact driver/event/session decisions may supply numeric drops or explicit back-of-grid starts. Minimum penalties remain unapplied and display their known lower bound; a race-only statement keeps them separate from Sprint. Generic rules and ambiguous multiple statements are excluded. Back-of-grid uses the existing >15-place back group internally, not an asserted 100-place official penalty.
