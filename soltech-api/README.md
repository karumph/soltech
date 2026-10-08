# Soltech API

The server side of the hosted Soltech site: one AWS Lambda function (`soltech-api`, Node.js 20) behind the Amplify rewrite `/api/<*>`.

## What it does

- **Shared scan, every minute** (EventBridge rule `soltech-scan`). Each run collects new tokens from Dexscreener token profiles and boosts and from GeckoTerminal new pools on Solana and Base. It then prices every candidate, and every coin already in the feed, from its deepest Dexscreener pair, and stores the result in DynamoDB `soltech-scans` (`id: latest`, plus a small `id: meta` item).
- **Rolling feed.** Coins stay for up to 24 hours, newest first, capped at 150. When the cap is reached, older high-risk coins are dropped first.
- **Risk reading.** Liquidity, market cap and pair age, using the same thresholds as the first hosted scan. The browser applies each person's scanner filters (`soltech-refined/dist/scanner-match.js`), so the server never learns them.
- **Accounts** (Cognito pool `us-east-1_9z3I8k3dL`) and saved data (DynamoDB `soltech-accounts`).

## Routes

| Route | Purpose |
| --- | --- |
| `GET /finds?since=<updatedAt>` | Latest scan. With `since`, answers `{ unchanged: true }` cheaply when nothing is new. |
| `GET /proxy?u=` | Allowlisted market APIs for the coin checker. |
| `GET /bundlers` | `{ status: "not-connected" }` until a Solana Tracker key exists. |
| `POST /auth/signup`, `/auth/confirm`, `/auth/resend` | Create an account and confirm the email code. |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | Session. Logout signs out every device. |
| `POST /auth/forgot`, `/auth/reset` | Password reset by email code. |
| `POST /auth/password` | Change password (signed in). |
| `GET /account`, `PUT /account` | Saved profile, scanner and workspace. |
| `POST /account/delete` | Deletes saved data and the Cognito user. |

Errors from `/auth` and `/account` are `{ error, code }` with readable text.

Do not add `Access-Control-Allow-Origin` in `response()`. The function URL CORS config is the only CORS source; the site calls `/api` on its own origin anyway.

## Deploy

```powershell
.\deploy.ps1
```

This updates the role policy (`policy-accounts.json`), uploads the code, sets the schedule to one minute, runs one scan, runs the site tests, and deploys `soltech-refined/dist` to Amplify. Use `-ApiOnly` or `-SiteOnly` to deploy just one. Deploy the API before the site, because the new site expects the new account routes.

## Cost at this scale

One scan a minute writes about 100 KB to DynamoDB, roughly $5 a month on demand. Pollers read the small `meta` item unless a new scan has landed. Lambda stays inside the free tier at this traffic.

## Local preview

From `soltech-refined`:

```powershell
node dev-live.mjs 4190
```

This serves the site at http://127.0.0.1:4190/ and runs this scan in-process every minute. Account calls go to the deployed Lambda.
