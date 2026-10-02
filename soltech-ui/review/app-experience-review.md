# Mobile app experience review

Completed September 26, 2026 (local preview).

## Changes

- Replaced the mobile website header/navigation with a compact brand header and a persistent glass bottom bar: Check, Active, Find, Profile. Desktop retains a compact top navigation. About remains reachable.
- Profile contains Saved scanners, with a visible way back. Existing Saved URLs, drafts, scanner records and Add > Saved continue to work. This is a device-local profile area, not an account or cloud sync feature.
- Split coin reports into Overview, Chart and Details. Coin identity and risk summary remain outside the tabs. Risk shortcut opens Details. Arrow keys, Home and End move between report tabs. Chart metric, range and point survive navigation within the tab.
- Replaced the circular Clear overlay with a separate, labeled 44px-or-larger button. It clears input, report and pending lookup, then restores input focus.
- Refined system typography, spacing, silver glass, blue/lilac surfaces, scanner facets and touch controls. Discovery cards now explain each scanner in one short line. Mobile dialogs use bottom sheets. Original logo is unchanged.
- Kept numeric safeguards, unknown risk, source disclosures, cancelled DEX profile states and unreported boost counts. Tiny currency values use ordinary decimals. No trading, account or live scanning behavior was added.
- Corrected a stale scanner success message and narrow-screen horizontal overflow. Phone preview fits the available window.

## Verification run

75 automated tests passed. JavaScript syntax checks passed. Browser walkthrough covered Find > preview > Use > findings, opening a sample coin and unread count, edit validation, recoverable draft in Saved, review/save, and dialog Escape with focus return. Profile > Saved > Profile worked. Live supplied Solana coin returned market, logo, risk and history data. Chart metric and Home-key selection survived leaving for Profile and returning. Risk shortcut opened Details. Clear removed the old report and restored input focus; invalid-address validation worked. Loading and successful states were observed. Source error and missing-data normalization remain covered by automated tests; not all provider failures were recreated live during this pass.

Inspected narrow 320px layout (client and scroll widths both 320px), 390px mobile views, the fixed phone frame and 1280px desktop layout. Keyboard report tabs, slider and dialog dismissal were checked. Existing reduced-motion and solid-background fallbacks were retained and reviewed in source. No full WCAG, screen-reader, real-device, reduced-motion emulation, load or security certification was performed.

Screenshots: app-overview-mobile.png, app-chart-mobile.png, app-profile-mobile.png, app-find-mobile.png, app-clear-320.png, app-find-desktop.png. The add-sheet image predates Profile navigation but represents the current sheet controls. Coin data and counts reflect the time of capture and the isolated QA workspace; they are not defaults or endorsements.

## Still to test with people

Can a beginner distinguish real coin reports from sample scanner findings? Can they find their saved scanner inside Profile without expecting cloud sync? Do the three report sections reduce reading effort while preserving understanding of risk? These are hypotheses, not demonstrated engagement improvements.

The updated local mobile preview is on port 4175. The hosted Site was not published. App Store packaging, native-device behavior, account sync and live scanner monitoring are separate work. Project backups do not include browser-local scanner records or drafts.


## Joined Clear and direct Create follow-up

Clear now shares one border with the input, with fixed trailing space and a disabled empty state. Measured input width stayed 252px before typing, after typing and after keyboard clearing in the 390px test. Clear returned input focus. The 320px error state retained the joined border without horizontal overflow. Find has a top-right Create scanner action; it opened the existing editor and showed the existing-draft protection dialog on a second attempt. The existing 40 checker tests and app syntax check passed. Screenshots: joined-clear-mobile.png and find-create-mobile.png. The earlier separate-Clear screenshots are historical.

## Chart and Deactivate follow-up — September 27

Implemented a larger, bounded chart canvas, readable value axis, separate current-cap tile, subtle blue area fill, crosshair and selected-value readout. Corrected an SVG/grid sizing issue that let the graph overflow its panel. Gaps produce separate line/fill segments; isolated observations remain visible. Deactivate is a small secondary action with a 44px touch height, beside Edit. QA confirmed deactivation preserves the scanner in Saved, and Use scanner restores Active.

The source now requests exact-token USD minute and hourly candles from the same selected pool, with empty-interval filling explicitly disabled. Minute candles improve 1H/6H and fully covered recent histories. All retains older hourly coverage when minute data is truncated. A failed series preserves the other one. Recent ranges are anchored to retrieval time, rather than presenting an inactive pool's old hour as the latest hour. Invalid, duplicate, future and inconsistent candles are rejected. Highest observed values and retrieval time cover both successful series. Estimates remain clearly labeled.

Verification: 85 automated tests passed; app, checker-data and chart syntax checks passed. A live supplied-token lookup returned 348 minute points; 1H used 41, 6H used 270, and All used 348 at that check. The 1H and 6H dates and y-axis values changed as expected. Day/week disabled for the short available history. Market-cap selection and Home-key scrubbing worked. New 390px mobile and 1280px desktop chart screenshots were inspected after the overflow fix. Earlier narrower-layout verification predates minute integration. Mouse dragging was checked in the earlier chart pass; no real touch-device test was performed.

Current screenshots: refined-chart-price-mobile.png, refined-chart-cap-mobile.png, refined-chart-desktop.png. scanner-deactivate-mobile.png records the QA action but may reflect the viewport before its final reset. Previous app-chart screenshots are historical.

Source verification: https://api.geckoterminal.com/docs/v2/swagger.json and https://docs.coingecko.com/reference/pool-ohlcv-contract-address . The source may cache minute data; this is a lookup snapshot, not streaming. Public API limits and availability still apply. All-time-high, full lifetime history, and recorded historical circulating market cap are not claimed. No hosted publication was performed.

## Market-cap default
The chart now defaults to estimated market cap, with dynamic heading and a Price fallback when inputs are missing. Automatic fallback is separate from an explicit user choice, so a later lookup can use newly available cap data. Browser QA confirmed default cap and retained explicit Price across Overview/Chart navigation. Eleven chart tests passed. Screenshot: market-cap-default-mobile.png.

## Insider signal and simpler risk summary
The risk banner no longer has a Details arrow/button. The Details tab remains keyboard accessible and the risk label/reason remain outside report panels.

Solana reports show Suspected insiders under Details, using only Rugcheck's graphInsidersDetected count from the existing report request. Explicit zero is shown as 0 reported; missing or invalid fields stay Unavailable. This is a provider signal, not proof of insider knowledge, identities or common ownership. No new fetch or service is added, so this change adds no provider wait. Other networks do not claim this coverage. Existing provider risk flags are preserved.

The live XPad report returned 0 and null network detail; CopiumCat returned 6 with one transfer network. Do not infer percentages from network tokenAmount, whose meaning depends on network type, or from topHolders.insider, which is a separate signal. Bundler counts/percentages are not connected. Solana Tracker's documented endpoint requires an API key, which would need a server-side integration; no key was requested, exposed or provisioned.

Sources: Rugcheck's own website links its documentation to https://fluxrpc.com/docs/rugcheck/gettokenreport/ . Dedicated bundler API: https://docs.solanatracker.io/data-api/tokens/get-token-bundlers . Counts are time-sensitive source snapshots. The 44 checker/data-render tests and both changed JavaScript syntax checks passed; chart tests were already verified in the preceding change.
`nBrowser QA: the live XPad count displayed 0 reported, its explanation opened with the keyboard, and Details remained reachable after removing the risk-banner button. Screenshot: insider-signal-mobile.png. No latency benchmark was run; zero additional network requests is verified in the code.

## Bundler integration prepared, awaiting provider access
The local preview now has a same-origin /api/bundlers route backed by Solana Tracker. It reads SOLANATRACKER_API_KEY from the server process environment only. No key is configured. Do not put credentials in dist, browser storage, source files, screenshots or backups. Restart the preview server after securely configuring its environment. Hosted static deployment would require a separate server/Worker route with server-side secrets; this change has not been published.

Details has one expandable Bundled buys row: reported wallet total, reported share currently held, and up to ten returned wallet links. Provider totals are used directly, never summed from its capped wallet list. No inferred insider-held share, launch allocation, sold amount or identity claim. The source's initial-share field is retained internally but omitted from the simple UI because its observation window is not established.

Market, risk and history requests proceed independently of bundlers. The optional bundle lookup has an eight-second upstream deadline, coalesces duplicate requests, uses a one-minute bounded cache, and preserves the original retrieval time. Cache is process-only. Unknown, disconnected, unsupported, failed and explicit zero remain distinct. The local route requires an expected loopback Host, rejects cross-origin browser use and non-GET requests, validates Solana mint bytes, limits concurrent/upstream request frequency, and exposes only validated fields. The key is only sent to the fixed provider host, never follows redirects, and is never returned in errors.

Validation: 51 checker and integration tests passed with fake provider responses, including malformed data, missing key, explicit zero, timeout, source failure, cache/coalescing, cancellation, independent result arrival, and secret handling. Live local route returned not-connected as expected. Actual provider authentication, coverage, and live bundled data are NOT verified until a valid provider key is configured. Documentation: https://docs.solanatracker.io/data-api/tokens/get-token-bundlers . New integration file: bundler-api.mjs.
Browser check: the existing live coin report completed and Bundled buys displayed Not connected; the explanation opened by keyboard. Screenshot: bundler-connection-mobile.png. No live authenticated bundle count has been tested.
