# Coin report update · September 26, 2026

The Phanes message supplied by the user was a reference for information density, not a source of current prices. The checker now presents a compact live report in Soltech's existing white, silver-glass, blue and lilac system. The logo and scanner workspace remain unchanged.

## Implemented

- Price, market cap, liquidity and 24-hour volume, followed by a compact 1-hour / 24-hour change and buy/sell table.
- Pool age explicitly labeled as pool age. Exchange, quote asset and fully diluted value in expandable market details.
- Reported holder accounts, total supply, and top-ten reported account concentration. Known pools are excluded from the aggregate and identified in the expandable account list. Accounts are not unique people. Supply is calculated using raw amount and decimals without silently repairing unsafe JSON numbers; exact supply is available in details.
- Project-provided Website, X and Telegram links when supplied. Links use restricted protocols and social hosts, escaped output, and external-link isolation. No referral links or advertising were copied.
- An independent DEX paid-profile lookup. It is neutral project context, never a security pass. Failure cannot remove successful market or risk data.
- Green “No flags reported” with the visible “This is not proof of safety” caveat. Yellow caution, red high-risk findings, and gray pending/unavailable checks. The most serious reported finding is first.
- A 44px Clear address control. It cancels in-flight requests, removes prior results and errors, clears remembered lookup state, and returns focus to the input.

- Public GeckoTerminal hourly price history with a bounded, explicitly dated highest observed pool price. This is not a token-wide ATH. The chart uses hourly closes; gaps stay disconnected. A later optional chart mode estimates market cap from the current market-cap-to-price ratio; it is explicitly labeled and never presented as observed historical market cap.

## Source coverage

DEX Screener provides selected-pool market data, activity windows and project links. Orders may arrive as a legacy array or an object containing an orders array; both are supported. Only an approved token-profile order establishes the displayed paid-profile state. Absence is labeled as not reported, not “unpaid.” [DEX Screener API reference](https://docs.dexscreener.com/api/reference).

Rugcheck supplies token controls, risk findings, reported token-holding accounts, total supply and account balances. Known market vaults/AMM accounts are identified by account or owner; locker balances remain counted. The supplied coin's largest account was a pool, making that distinction material. Retrieval time is shown separately from unknown cached-report scan time. [Rugcheck full report documentation](https://fluxrpc.com/docs/rugcheck/gettokenreport/).

The public history addition does not establish token-wide ATH. These sources do not establish fresh-wallet percentages, social-account age, bot view counts or circulating supply. The interface states those gaps under Sources & coverage. No example values were substituted. Manual lookups are real; automated scanners remain previews.

## Verification

- 61 Node tests passed: existing scanner behavior plus data normalization, malformed/missing fields, precision, URL filtering, pool exclusion, four-source partial failures and stale responses, risk presentation and output escaping.
- Browser: supplied CopiumCat returned real market, account, supply, paid-profile data and six hourly price candles from GeckoTerminal. FLUX sample returned yellow caution while its market lookup was empty; risk results remained visible.
- Browser: invalid-address error, Clear after an error, Clear while loading, later response suppression, keyboard Tab/Enter on Clear, and focus return checked.
- Layout inspected at 320px, in the 390px fixed phone frame, and 1280px desktop. No horizontal page overflow at the tested narrow and desktop sizes. Expandable accounts and risk explanations checked. Global reduced-motion and glass fallbacks retained.
- Screenshots are saved beside this note. Browser state and prices represent the instant of capture.

Not performed: a full screen-reader or WCAG conformance audit, real-device testing, live red-risk token lookup, production load/security review, or deployment to the hosted site. Red/unknown mapping was covered by automated tests. Browser-saved scanners and drafts were not overwritten or independently exported by this change.


## Latest follow-up: networks, chart and concise copy

- Eight supported token networks; no Solana-only badge. Ambiguous 0x addresses require a network choice. Native coins without contracts and unindexed tokens are not claimed as universally supported.
- Actual coin image beside the name, from the exact matched token pair; secure URL filtering and plain initials on missing/failed images. Removed the decorative crystal from the checker.
- Centered Clear icon with a 44px-wide touch target. Clear cancels all pending lookups, removes results and returns input focus.
- Interactive chart supports pointer dragging, keyboard slider control and available day/week/all ranges. Metric switch selects Price or Market cap (est.). Current market cap remains a separate snapshot. Small prices use standard decimal notation.
- Green is suppressed when essential Solana controls are missing. Missing tracked GoPlus checks stay unknown, with reported concerns retaining priority. Added ownership-reclaim caution; proxy alone is not described as definitively upgradeable.
- Pool IDs allow valid Uniswap v4 and Curve identifiers. A missing chart cannot discard a valid market report.
- Reduced repeated copy across Check, Active, Find, Saved, scanner previews, dialogs, customization and sample coin summaries. Risk caveats, preview labels, units, privacy and recovery instructions remain. About Soltech and metadata now describe the broader checker.

Current verification: 70 Node tests passed. Real CopiumCat logo loaded. Live Solana and Base market/security/history reports rendered. Base history returned 1,000 candles; 1D selection and Home-key scrubbing updated the selected point while current market cap stayed fixed. Pointer dragging and Price/Market cap (est.) selection worked in the phone frame. Clear returned focus and removed results. At the tested phone size, body client and scroll widths both measured 388px. Ethereum market and GoPlus responses also normalized successfully in a direct live API check. Primary-source research verified GoPlus network support and anonymous responses for all seven EVM networks; each network was not walked through in the browser.

The final changes are local. Main preview remains on port 4175; QA used 4176 to avoid overwriting saved scanners. No new production deployment, account, payment, wallet or live scanner integration. This pass is not a full security, WCAG or screen-reader certification. The screenshot captures and prior desktop checks do not establish real-device or every-browser behavior.

## DEX paid and boosts

The Project section now says DEX paid: Yes when an approved tokenProfile order is reported; a complete response without one says Not reported. Missing, failed or pending information stays Unavailable. A separate lightning badge shows the selected exact-base-token pair's boosts.active count. It is never summed across pools, borrowed from a quote token, inferred from previous purchases, or presented as dollars spent. Optional missing counts stay Unavailable; an explicit zero stays zero. Promotional status does not change the risk label.

Verification: 72 tests pass, including boost identity, malformed/missing/zero counts, paid-status separation and no safety upgrade. Live Elon Coin response returned an approved profile but no active count. A separate live QUACC lookup returned 500 active boosts. These are observations at lookup time, not permanent facts about those coins.

Sources: https://docs.dexscreener.com/api/reference and https://docs.dexscreener.com/boosting .

Follow-up verification: the user-reported token had three exact-base pairs with no boost field and one cancelled tokenProfile order. Labels now distinguish Not reported (omitted count), Unavailable (failed/malformed check), and explicit cancelled/pending/not-approved profile orders. These labels do not infer zero boosts, payment refunds, or profile removal. Approved order takes precedence. Live mobile walkthrough and 74 automated tests passed.


## Current mobile interface

See app-experience-review.md for the latest pass. The checker now uses Overview / Chart / Details, keeps risk outside those sections, and uses a separate labeled Clear button. Profile replaces Saved in the bottom navigation; Saved scanners and drafts remain available within it. All 75 automated tests pass. The previous centered-icon description above is historical.
