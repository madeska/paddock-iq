# Joint official grid penalties

The 31 October 2026 Mexico City F1 article named Verstappen and Lawson together.
The previous parser required exactly one driver in a headline, did not recognise
`one-place`, and deduplicated all mentions by article URL. The publisher's JSON-LD
description also omitted the drop size; the named stewards decision was in the
article's rich text.

The scanner now retains separate driver/session mentions for a shared URL. Joint
confirmation requires an explicit equal drop for both named recipients. The race
session can be inferred only from a verified non-sprint weekend when the decision
does not specify one. Conditional, contradictory, overturned, other-event and
unknown-session statements remain pending; penalty points are not grid drops.

Verified against the fetched official HTML: VER +1 RACE and LAW +1 RACE. No
forecast mathematics or saved forecasts were changed by that read-only check.
Saved projections pick up the corrected news on the next successful pre-lock
forecast refresh. An update blocked by source access or team lock keeps saved
values under the existing rules.

Regression checks: `npx tsx --test scripts/check-grid-penalty-news.ts scripts/check-weekend-grid-simulation.ts`.
These checks also run in the Home UI CI workflow.
