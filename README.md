# Paddock IQ

F1 Fantasy market and team strategy dashboard. Public market prices and forecasts; private Google-owned team snapshots, manual or official-site browser import, lineup builder and transfer comparisons.

## Local setup

Use Node.js 22 and a PostgreSQL/Neon database.

```powershell
npm ci
Copy-Item .env.example .env
```

Set `DATABASE_URL`, Google OAuth credentials, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL=http://localhost:3000` in `.env`. Set `ADMIN_EMAILS` to the Google email permitted to refresh the shared market/forecasts. Keep real values out of Git and chat.

```powershell
npm run db:deploy
npm run dev
```

`npm ci` and the production build generate Prisma Client automatically. For an existing database, first run `npx prisma migrate status`; never run seed or reset against live data. Google setup: [docs/google-sign-in.md](docs/google-sign-in.md).

## Publish on Vercel + Neon

Follow [docs/deployment.md](docs/deployment.md). The release branch is `feat/home-dashboard-ux`; select it as the Vercel production branch until the stacked PRs are integrated. Node22, `npm ci`, and `npm run build` are configured. Production builds validate required configuration. Migrations are applied separately; builds never seed or migrate the database automatically.

## Access and updates

- Market browsing and client-side budget building are public.
- Personal teams/import/edit/delete and server-side transfer optimization require Google sign-in; ownership is checked on the server.
- Shared forecast/score mutations and diagnostics require a Google account listed in `ADMIN_EMAILS`, or a server-only `x-market-admin-key`.
- Official score checks currently run every five minutes while an administrator has the dashboard open. There is no unattended cron job in this release.
- F1 import currently uses the official-site browser helper with file/manual fallbacks. Google does not connect a private F1 account. League-code import and native F1 OAuth are not implemented.
- Predictions are estimates. Experimental simulation candidates remain inactive.

## Release checks

```powershell
npm run build
npm audit
node --test scripts/check-deployment-config.mjs
npx tsx --test scripts/check-maintenance-auth.ts scripts/check-team-auth.ts scripts/check-google-identity.ts scripts/check-api-response.ts scripts/check-request-limits.ts scripts/check-completed-forecast-guard.ts
```

Browser fixtures and regression checks run in GitHub Actions. Current architecture: [docs/f1-direct-transfer.md](docs/f1-direct-transfer.md), [docs/google-sign-in.md](docs/google-sign-in.md). Old development notes are preserved in [docs/project-history.md](docs/project-history.md).
