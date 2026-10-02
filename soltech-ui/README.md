# Soltech — live coin checker and scanner preview

A dependency-free app with a live, read-only Solana coin checker and scanner interface previews. Current checkpoint: September 26, 2026. Check coin is the opening tab, followed by Active scanners, Find scanners, and Saved scanners. Read START-HERE.md to resume.

Check coin retrieves real public DEX Screener market data and Rugcheck reports when a Solana mint address is submitted. Automated scanners still use fictional findings. No live scanning, purchases, trading, wallet connection or product account integration is connected. Saved scanners and drafts use this browser’s local storage; they do not sync between devices or between localhost and the hosted site. Clearing browser data removes them.

## Run locally

From this folder, with Node.js installed:

```sh
node mobile-preview.mjs
```

Open http://127.0.0.1:4175/mobile-preview.html. Keep the server running. Serve the files over HTTP rather than opening index.html directly, because the app uses JavaScript modules.

## Check the state model

```sh
node --test tests/*.test.mjs
node --check dist/app.js
```

## Live data

No API keys are required for the currently verified public endpoints. Requests go directly from the browser to DEX Screener and Rugcheck; network access and their CORS availability are required. Each service sees the requested public address and network metadata. Results are snapshots, may be cached by the providers, and do not update automatically. Missing data never becomes zero or a passed check. API access/quotas and availability may change.

The checker supports Solana token mint addresses only, not names, wallets, pool addresses, or EVM addresses. Market selection uses the returned Solana base-token pair with highest reported USD liquidity. FDV is separate from market cap; pool age is separate from token launch age. Risk flags are provider reports, never a safety guarantee. Unclassified findings stay unknown. No AI project narrative is invented; issuer descriptions are attributed if available.

See `review/live-check-review.md` for validation and limitations.

## Structure

- `dist/index.html`: shared app shell, initial loading surface, no-JavaScript fallback.
- `dist/app.css`: shared tokens, layout and reusable component styles, responsive and reduced-motion rules.
- `dist/app.js`: reusable rendering helpers, routes, forms, dialogs and interactions.
- `dist/coin-checker.js`, `dist/coin-checker.css`: live lookup form, responsive report and source disclosures.
- `dist/coin-checker-data.js`: validated public API data, cancellation, timeout and error handling.
- `dist/data.js`: explicitly fictional scanner and coin examples.
- `dist/workspace.js`: validated local state, draft persistence, saved-scanner identity, removal/undo and storage failures.
- `dist/scanner-settings.js`: filter definitions, validation, and summaries.
- `dist/scanner-editor.js` and `dist/scanner-editor.css`: customization controls.
- `dist/scanner-findings.js` and `dist/scanner-findings.css`: per-scanner results and unread presentation.
- `research/`: sourced scanner and product-design reports.
- `review/`: redesign review and mobile/desktop screenshots.
- `backups/current-draft.json`: reference snapshot of the inspected draft form, not a complete browser-storage export.
- `mobile-preview.mjs` and `mobile-preview.html`: portable phone preview.
- `dist/assets/soltech-logo.png`: supplied logo, unchanged.

Scanner samples use text labels: Lower risk, Caution, High risk, and Not assessed. The live checker instead reports No flags reported, Caution reported, Major concern reported, or Not fully assessed/Not assessed, with source attribution. Missing information is never treated as a passed check. Example results do not change with scanner criteria and are not investment assessments.

The existing private Sites project and navigation WebMCP tool are retained. No build step or external package installation is required.
