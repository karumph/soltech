# Solventir scanner pilot

Built locally October 12, 2026. This updates the user's `soltech-refined` app; the co-developer's hosted app is unchanged.

## What works

- **X post / New projects** remain the two scanner sources. Start and Pause control server work; changing pages or closing a tab does not stop an active scan. Closing the local server stops it. A server restart restores findings but starts paused.
- New projects discovers **newly indexed Solana trading pools** through GeckoTerminal's public API. It reads a bounded recent window; this is neither an exhaustive launch stream nor proof of a company/project launch.
- Exact-mint DEX Screener data enriches names, images, market cap, liquidity and volume. A missing market cap stays unavailable, rather than being replaced with FDV. Market timestamps are available in Details.
- Basic Solana mint checks inspect the reported mint account and its authorities. Unsupported Token-2022 coverage, unavailable requests and missing fields stay incomplete. These checks do not establish safety, ownership concentration, sellability, profitability, or an overall risk grade.
- Feed preserves source groups and adds coins as they are observed. Name/logo and check status occupy the top row, with contract-address copying and market cap beneath. Post groups show the source post and summary, with multiple candidates underneath. Mobile layouts stack the source and summary when necessary.
- The original-post card now supports the returned author's avatar, complete long-form text, up to four associated photos or manually controlled MP4 videos, and reply/quote/repost context. It renders actual API data in Solventir's layout; it is not an official X widget or a screenshot. Missing media/text is explicitly identified. Coin updates retain existing media controls and open details.
- **Post in brief** is a labeled, source-worded excerpt of up to 220 characters. It does not generate a paraphrase, interpret images, or infer the author's intent. Matching updates no longer replace it with a generic connection message. An AI-written topic summary remains future work.
- Saved **visible** market-cap, trading-age, liquidity and volume limits apply when Start is pressed. Missing required values are pending; known failed limits are marked outside filters. Hidden historical wizard options are preserved as data but do not silently restrict this pilot.
- Data flows over a reconnecting event stream. Browser navigation does not restart the scan. Provider errors, interrupted checks and local saving failures are explicit. No fake X posts or historical sample coins are inserted into the live Feed.

## X access later

The user has not set up X API access. Without it, the app deliberately shows X as disconnected and new-market discovery continues independently.

An official X API adapter is implemented and tested with controlled responses. It has **not** been verified against a paid X account. To test it later, supply `X_BEARER_TOKEN` only to the local server process, explicitly set `SCANNER_X_ENABLED=true`, and select up to five specific X usernames in Customize. The default curated account list is not configured. The server does not automatically load `.env` files. Never put credentials in browser code, source control, screenshots or chat.

Enabling X can incur provider usage charges. Confirm access and a budget before enabling it. No X account, subscription, billing arrangement, or paid provider has been created by this build.

This first adapter polls public account posts through official endpoints. Matching runs when posts, coins and later market details arrive. Exact address or verified trading-link evidence stays separate from possible name/cashtag matches. A reference is not endorsement. Replies, quotes and token metadata cannot supply evidence for another author's post.

Reposts keep their observed wording for display but supply no matching text or links under the reposting author's identity. Media is resolved only through that post's attached media keys. Images and avatars require the exact `pbs.twimg.com` HTTPS host; playable videos require actual returned MP4 variants on `video.twimg.com`, up to 2 Mbps. Unsupported variants keep a fallback and the original-post link.

X's current [data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary) and [timeline endpoint reference](https://docs.x.com/x-api/users/get-posts) use different names for long-form text and references. Normalization accepts either documented primary-post shape and rejects conflicting text. The timeline request tries one alternate documented field/expansion layout only after an HTTP 400; authentication errors and rate limits do not trigger that retry. This compatibility remains unverified against a real authorized X account.

For setup, sign in at the [X Developer Console](https://console.x.com/) and create a Solventir app following [X's access guide](https://docs.x.com/x-api/getting-started/getting-access). The user handles their login, agreement and any credit purchase directly. Reading public posts uses the app's Bearer Token, kept server-side. Check the console's current pricing and set a spending limit before enabling polling. No paid X calls have been made by this build.

This is an initial deterministic matcher, not the proposed full semantic post-prioritization system. Media interpretation, topic ranking, expanded launch coverage, benchmarked precision/recall and large-scale streaming remain future work.

## Local operation and data

From the repository root, the existing comparison runs with:

```sh
node soltech-refined/review/scanner-comparison.mjs
```

Open `http://127.0.0.1:4185/mine?view=scanner` or `http://127.0.0.1:4185/mine?view=finds` for the phone frame. The standalone preview also supports the scanner through `node soltech-refined/mobile-preview.mjs 4183`.

Each local preview port stores its own scanner results/configuration under ignored `soltech-refined/.runtime/`, separately from browser settings and recent-check history. Tabs on the same port share the running scan. The pilot retains a bounded recent feed (up to 120 distinct coins and 60 source groups, with a payload-size cap); it is not an unlimited archive or account-scoped service. Use one preview origin consistently.

Long posts can reach the size cap earlier. Oldest whole source groups are dropped before the group payload exceeds 2.4 MB, leaving room beneath the 3 MB save/stream limit; retained original post text is not silently shortened in storage.

The HTTP API is loopback-only and same-origin guarded. GET reads a snapshot or subscribes to events; POST starts or pauses. Do not expose this development server publicly. Production deployment, authentication, per-account isolation, daily allowances, billing and notifications have not been implemented or published.

## Verification

```sh
node --test soltech-refined/tests/*.test.mjs
node --check soltech-refined/dist/app.js
```

New tests cover identity validation, uncertain matches, missing filter data, cancellation races, saved-state recovery, provider limits, progressive updates, event-stream backpressure and UI state recovery. The isolated Feed test page uses labeled fictional posts only and never writes them to live scanner storage.
