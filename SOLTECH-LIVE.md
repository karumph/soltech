# Soltech: the hosted site

This branch turns the `soltech-refined` design into a live website. Your Scanner, Feed, Check and Profile designs are kept. The work adds a real backend, accounts, and a few new pages.

Live: https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/

## What runs where

- **Site:** `soltech-refined/dist`, static files on AWS Amplify (app `d3ilz6ab0hx4y4`, branch `soltech`). There's still no build step.
- **API and scanner:** `soltech-api/`, one AWS Lambda behind the Amplify rewrite `/api/<*>`. See `soltech-api/README.md` for routes, costs and deploying.
- **Data:** DynamoDB tables `soltech-scans` (the shared scan), `soltech-accounts` (saved profile, scanner, signals) and `soltech-watchlists`. Accounts use Cognito.

## The scanner

One scan runs on the server every minute, for everyone:

1. **New coins:** from Dexscreener profiles and boosts, and GeckoTerminal new pools, on Solana and Base.
2. **Pricing:** from all of a coin's pools.
3. **Solana contract checks:** read straight from the blockchain for every coin: mint and freeze authority, Token-2022 extensions, and pump.fun launchpad progress.
4. **Third-party checks:** Rugcheck adds creator history and liquidity locks for the most promising coins. GoPlus checks Base contracts.
5. **Assessment:** `soltech-api/assess.mjs` turns all of it into flags, a risk level, four checks and a momentum score.

Each person's filters run in their browser (`dist/scanner-match.js`), so Feed, Scanner, Signals and the Finds count always agree.

The full explanation is on the site at `#how`, linked from the Scanner page.

## Pages

| Page | What it does |
| --- | --- |
| Check | One coin: the Soltech verdict on top, the full report below. A **Wallet** tab checks every coin in a Solana wallet. |
| Feed | Live coins from the scan: your finds, all new coins, and coins you watch. |
| Scanner | The designed animation, replaying real coins through the real checks. Also *Scan a coin* and a live activity list. |
| Signals | Optional modules people switch on: about to graduate, momentum surges, fresh and clean, contract alerts, copycat radar. Modules still waiting on a connection show what they need. |
| Profile | Accounts: create, sign in, reset password, change password, delete. Saved data syncs across devices. |

## Running it locally

```sh
cd soltech-refined
node dev-live.mjs 4190            # http://127.0.0.1:4190, runs the scan locally every minute
node --test "tests/*.test.mjs"    # all tests
```

`mobile-preview.mjs` still serves the original local demo.

## Not connected yet

- **X posts:** needs an X API token.
- **Telegram and email alerts:** need a Telegram bot and a sending domain.
- **Holder concentration:** needs a Solana RPC provider key, set as `SOLANA_RPC_URL`.
- **Creator history and bundle detection:** planned.
