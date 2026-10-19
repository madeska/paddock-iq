# Background data updates

Manual forecast refresh, manual official-score sync and scheduled updates share a PostgreSQL lease in `MaintenanceState`. One worker owns updates across Vercel instances. A dead worker's lease expires after ten minutes; function duration is capped at 300 seconds. Forecast replacement uses one database transaction and verifies the current lease token before writing. A failed or incomplete forecast does not replace the previous forecasts. Calculation formulas are unchanged.

## Deploy safely

1. Apply the additive migration `20261019090000_maintenance_state` to the existing Neon before deploying this code: `npm run db:deploy`. This adds one coordination/metadata table; it does not reset or seed existing data.
2. Generate a new independent random secret with at least 32 characters. Add `CRON_SECRET` to Vercel **Production** only. Do not send it in chat, URLs or repository files. It is separate from `NEXTAUTH_SECRET` and `MARKET_ADMIN_KEY`.
3. Deploy the release. Verify ordinary market reads, Google ownership and `/api/cron/update` returning 401 without authorization.
4. Invoke an authenticated update with the scheduler and inspect its result and Vercel logs. A configured secret alone does not prove a scheduler has run.

## Schedule on Vercel Hobby

`vercel.json` registers one daily GET at `17 5 * * *` (UTC). Vercel Hobby can run it within that hour, rather than exactly at the minute. Vercel supplies `Authorization: Bearer <CRON_SECRET>` automatically. The job runs only on production deployments. Daily checking alone is insufficient to reliably ingest practices shortly before team lock.

For frequent checking, configure an external scheduler such as cron-job.org:

- URL: `https://paddock-iq-xi.vercel.app/api/cron/update`
- Method: GET; every 15 minutes
- Custom header: `Authorization` with value `Bearer YOUR_CRON_SECRET`
- Request timeout: as long as supported, ideally 300 seconds. A caller timeout does not prove the server stopped; allow the lease to expire before another manual retry. Never place credentials in query parameters.

Neither Vercel Hobby nor an external scheduler guarantees completion before the Fantasy deadline. Check the displayed forecast time and included sessions before choosing a lineup. For precise timing use a suitable scheduler/hosting plan and source monitoring.

## Behavior and visibility

The scheduled run checks official final points, advances exactly one round only after complete verification, and then refreshes the current unlocked forecast. It retains forecasts after team lock; the next race starts only after final official scores pass existing verification. A failed source check returns a retryable 503, and concurrent triggers return a successful `BUSY` response without another write.

Successful forecasts persist the exact practice/Sprint Qualifying summary, penalty/news decisions and xPts impact for all visitors. The market reports the oldest timestamp in the selected main forecast set; it never labels the time of a GET request as calculation time. Before lock, a complete forecast older than an hour needs an update. After lock it is labeled as the saved locked forecast. Failures retain the last successful context and display the failure status. No account data, lease tokens, secrets or raw exception messages appear in this public metadata.

`lastSucceededAt` is a completed data check, not proof that a new practice or an official result exists. `forecastAt` records the separate actual forecast calculation time. Missing sessions remain missing.

Platform references: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron secrets and concurrency](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
