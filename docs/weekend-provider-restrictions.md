# Live-session provider restrictions

On 30 October 2026 at 22:37 UTC, OpenF1 `/sessions?year=2026` returned HTTP 401 with an explicit global unauthenticated-access restriction during a live session. Previously the reader treated this as missing session data, and generation combined `lock passed` and `lock unavailable` into one misleading 409 response.

401/403 from OpenF1 now produce a specific retryable `WEEKEND_SOURCE_UNAVAILABLE` failure, including when fetching practice results after a schedule read succeeds. Forecasts and their original calculation timestamp are retained. No unobserved practice positions or fresh forecast timestamps are fabricated.

A schedule previously verified against both providers can be read from the same-season, same-round forecast context. It is marked as unavailable/cached if live verification fails, and cannot authorize forecast replacement during the outage. If the current calendar is available, the cached lock must agree within the existing window and the earlier cutoff is retained. Wrong-round contexts and manually typed deadlines are ineligible. A genuinely passed lock still returns its distinct 409 code.

The dashboard distinguishes waiting for the data source from a passed lock after a failed refresh. A subsequent newer saved calculation clears that waiting state. Background errors preserve the safe source-unavailability code.

Vercel Hobby's daily schedule is separate from source access: a forecast calculated in the morning cannot ingest later practices until another update is triggered. Configure the protected endpoint every 15 minutes using the existing [background update instructions](background-updates.md). During the provider's restricted live window these calls fail safely; later calls can ingest completed sessions when access returns. No external scheduler account or paid OpenF1 subscription is configured by this code.

References: [OpenF1 live/historical access window](https://openf1.org/), [authentication](https://openf1.org/auth.html).
