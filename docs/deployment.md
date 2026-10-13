# Publish Paddock IQ on Vercel + existing Neon

This release is on `feat/home-dashboard-ux`. It contains the current Google ownership, import/scoring/rollover features and approved UI. PR #155 is stacked on PR #154; importing the repository's older default branch will not publish this release. Select the release branch under Vercel Git settings, or integrate the reviewed PRs before changing back to main.

## Vercel project

Import `madeska/paddock-iq`, framework Next.js, repository root directory. Use Node 22, install `npm ci`, build `npm run build`, normal Next.js output. `vercel.json` sets Frankfurt (`fra1`) near the existing Neon EU database. Enable Fluid Compute; shared forecast/score update handlers declare `maxDuration=300`. Prisma is generated during installation and build.

Choose the final HTTPS address first: either the project's stable `*.vercel.app` domain or your own domain. Use this exact origin consistently for Google and `NEXTAUTH_URL`. Do not use per-commit preview URLs for production authentication.

## Production environment variables

Set these in Vercel's Production environment; never paste secrets in chat or commit `.env`.

| Variable | Value |
|---|---|
| DATABASE_URL | Existing Neon's pooled PostgreSQL connection with `sslmode=require`; retain the existing database |
| NEXTAUTH_URL | The final public HTTPS origin, with no path |
| NEXTAUTH_SECRET | A random value of at least 32 characters; retain it across deployments to keep sessions valid |
| GOOGLE_CLIENT_ID | Your Google Web application OAuth client ID |
| GOOGLE_CLIENT_SECRET | Its secret |
| ADMIN_EMAILS | Comma-separated verified Google emails allowed to maintain shared data |
| MARKET_ADMIN_KEY | Optional random server-only key of at least 32 characters for maintenance requests; leave empty if using only Google-admin operations |

Generate independent secrets locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Do not reuse the session secret as the admin key. Nothing here is a `NEXT_PUBLIC_` value.

Production builds fail with variable names (not values) if configuration is incomplete. Run `npm run deploy:check` with the deployment environment to check it separately. A local `.env` using HTTP localhost correctly fails this production-only check.

For Preview, use a separate Neon branch/database and separate auth configuration. Do not attach an arbitrary preview to the live database: signed-in admins can write shared predictions, and private account callbacks may create/link users. Preview builds do not run migrations or seed automatically.

## Google sign-in

In Google Cloud's Web OAuth client, add the final origin as an authorized JavaScript origin and `https://YOUR-DOMAIN/api/auth/callback/google` as an authorized redirect URI. Keep localhost entries for local development if needed. In Google Auth Platform configure the application name, support email, homepage and the `/privacy` URL. Publish the OAuth audience for general users; an app still in Testing permits only listed test users. This uses only `openid email profile`.

Existing owners should sign in with the same verified Google account used locally. The stable Google subject identifies ownership; typed email does not authorize team reads or writes. `ADMIN_EMAILS` controls shared-data updates independently of personal team ownership.

## Existing Neon database

The local database's migration status was checked on13 October2026: all six tracked migrations were applied. Repeat against the exact deployment database before launch:

```
npx prisma migrate status
npm run db:deploy
```

`db:deploy` applies pending migrations; it does not seed/reset. Take a Neon branch/backup before applying any future schema changes. This preparation does not apply migrations or change existing records. **Never run `db:seed`, `migrate reset` or `db push --accept-data-loss` against the live database.** The historical seed can replace scores and active assets.

Builds do not require a database write. A successful build/configuration check does not prove remote connectivity; verify sign-in and a market read on Vercel after deployment.

## Launch verification

1. Open `/`: market loads anonymously, `Official pts` is absent, builder appears above the market, mobile driver/constructor switching works.
2. Sign in with an ordinary Google account: no other user's teams are visible. Import or create a team, switch teams, edit/save, cancel an edit, and confirm deletion only for a disposable test team. Use `/privacy` for data handling information.
3. Sign in with the listed administrator: Refresh projections and official-score updates become available. Verify one successful refresh, source/session information, and readable error/retry behavior. Public/ordinary accounts cannot invoke shared-data writes or detailed diagnostics.
4. In Vercel logs check source timeouts and database reachability. Private API responses must not be cached; secrets must not appear in client bundles or error messages.

The import helper destination is derived from `NEXTAUTH_URL`; replace any localhost bookmark with the helper from the deployed import page. Imports remain snapshots. No extensionless native F1 account connection has been established.

## Operational limits and rollback

Public users consume saved forecasts. Scores are checked every five minutes only while an administrator keeps the dashboard open; this release has no background cron. An authenticated admin refresh guard prevents overlap within one function instance, not across separate Vercel instances. Use one update at a time; distributed scheduling/locking needs a separate implementation before high-volume maintenance.

On an application regression, use Vercel's previous deployment rollback. This does not roll back database writes or migrations. Keep the same production secrets/origin. If a future migration changes schema, assess backward compatibility or restore the prepared Neon branch separately.

## Dependencies and verification

Next.js stays on 15.5.27. PostCSS 8.5.30 and deepmerge-ts 8.0.0 are pinned transitive overrides to resolve audit findings without a framework/Prisma major migration. Verify Prisma generation/configuration/migration status and production build after changing these overrides. The preparation's `npm audit` reported zero vulnerabilities; repeat before launch.

Deployment platform references: [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration), [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy).
