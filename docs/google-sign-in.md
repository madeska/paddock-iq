# Google sign-in for Paddock IQ

My Team and setup require Google sign-in. The API obtains the owner from the signed server session and checks team ownership by user ID. Client email and remembered browser profile are not authorization. Import previews are private too. Writes require the configured application origin. Logout clears the remembered selection and signs out. Google tokens are not exposed to the client session or used to access F1.

## One-time setup

1. In Google Cloud Console, create or select your own project. Open Google Auth Platform and configure Branding, Audience and Clients. For an External app in Testing, add your Google email as a test user.
2. Create an OAuth client of type Web application. Use authorized origin http://localhost:3000 and redirect URI http://localhost:3000/api/auth/callback/google. For deployment use your HTTPS domain and the same callback path instead.
3. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your local .env. Never send the secret in chat or commit it. Set NEXTAUTH_URL=http://localhost:3000. Generate a random secret locally with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" and set NEXTAUTH_SECRET to that output.
4. Stop the dev server; git pull --ff-only; npm ci; npx prisma migrate deploy; npm run db:generate; npm run dev. The migration adds a nullable unique Google subject to User without deleting existing teams.
5. Open /my-team, choose Continue with Google, then select the Google account whose email matches your previous Paddock IQ profile. Existing Gmail or Google Workspace profiles can be linked after Google verifies ownership. A matching legacy email hosted outside Google is deliberately not claimed automatically; use a new verified profile and re-import, or arrange a separately verified migration.

The stable Google subject identifies subsequent logins, even if the provider email changes. Existing stored email is retained as profile metadata; team ownership uses user ID. Changing accounts means signing out and signing in again. No manual profile switching by typing another email remains.

F1 imports still use the existing official-site browser export. Google sign-in does not grant access to a private F1 Fantasy account. Direct F1 OAuth/sync is not implemented.

## Validation

Unit/integration tests cover verified identity linking, rejected unverified/conflicting claims, anonymous API rejection, ignored client identity, foreign-team denial, cross-origin writes and the existing import/edit/delete lifecycle. No real Google OAuth round trip or user database migration was run without owner credentials.

The browser smoke suite requires PADDOCK_TEST_STORAGE_STATE from a signed-in test-account browser against a test database; it does not bypass server authentication. Do not commit that storage state (it contains session cookies).
