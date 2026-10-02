# Live coin checker checkpoint

September 26, 2026. Local mobile preview; this checkpoint has not been published to the hosted Site.

## Implemented

Check coin is the opening screen, followed by Active scanners, Find scanners, and Saved scanners. The existing white, silver-glass and faceted visual system is preserved. A full Solana token mint address starts two independent, read-only requests: market data from DEX Screener, and a risk report from Rugcheck. No wallet or credentials are needed.

Available results include name, symbol, price, market cap, liquidity, 24-hour volume/change, transactions, FDV, pool creation, token authorities and metadata mutability. Holder counts are omitted: the tested provider returned zero for a widely traded token, so a reliable total was not established. Expandable details keep the initial view focused. Source links, full address, retrieval dates and coverage limitations remain visible. A provider's issuer description is attributed when present; otherwise the product says that a verified project description is unavailable. It does not fabricate an AI narrative.

The selected market is the returned Solana pair with the exact queried base-token address and the highest reported USD liquidity. It is not an aggregation across exchanges. Market cap is not replaced with FDV. A missing value remains unavailable. Quotes involving a different base token are not misrepresented as the queried token's price.

Risk findings use provider categories: danger, warning, unclassified, or no reported flags. The most severe known finding leads the summary. An empty flag list means no flags reported, never proof of safety. Unknown levels remain unknown. Mint and freeze authority fields distinguish explicit null from missing fields. Deprecated Rugcheck fields and provider scores are not used to invent risk probabilities. A manual lookup of a concerning coin still shows its concerns.

Lookup state is separate from scanner storage. Switching addresses or leaving the page cancels requests and invalidates late responses. Each provider can succeed independently. Timeouts, network errors, rate limits, no indexed market, malformed responses and invalid addresses have distinct handling. Repeated fully successful checks have a short cooldown using the actual completion time. Expanded details and focused result controls are restored across partial responses for the same address.

## Verification actually performed

- **43 Node tests passed.** Includes the preceding 32 scanner/state tests and 11 new checker tests: base58 byte length, exact token/pool selection, null and malformed values, risk completeness and severity, tiny-price display, HTTP/network/timeout handling, partial failure, late A/B responses, navigation disposal, and cancellation after invalid input.
- JavaScript syntax checks passed for the changed app and checker modules.
- Real public HTTP requests returned 200 for DEX Screener and Rugcheck. CORS responses were checked with a browser origin.
- Actual browser lookups returned market and risk data for wrapped SOL and USDC. USDC returned a market cap; wrapped SOL's missing market cap remained unavailable. The official Rugcheck FLUX example returned a caution report while its DEX market was unavailable. These are test observations, not recommendations or guarantees of future API availability.
- In the browser, invalid EVM input produced the Solana-specific correction, removed stale results, and focused the address field.
- The existing Find → Early project scanner → Use scanner flow still opened the saved scanner with sample findings. Returning to Check worked. No user workspace was reseeded; QA used a separate local origin.
- Responsive layout was inspected at 320 × 740, 390 × 844 and 1280 × 960. At 320, the document had no horizontal overflow and each tab measured approximately 64 × 52 CSS pixels. Browser scrollbars account for a 15-pixel difference between the outer override and document width.
- Keyboard Tab moved from the address field to Check coin with a visible outline. Tab/Enter operated the privacy disclosure. Native links, details and established app focus behavior remain available.

Automated failures and races were tested with controlled data loaders; they were not all induced against the real external providers in the browser. This is not a full WCAG conformance, screen-reader, real-device, production security or load test. Existing reduced-motion and solid-glass fallback CSS remains in place; preference emulation was not performed in this checkpoint.

## Boundaries

- Solana only. Format validation does not prove an address is a mint or a token has a market. Unsupported, wallet and unindexed addresses can produce no available data.
- Sources may lag, cache reports or omit fields. Retrieval time is not a latest trade or latest security scan. Rugcheck does not supply a report scan timestamp here; its `detectedAt` is not repurposed.
- Public endpoint availability, limits and terms can change. No paid access, automatic refresh, ingestion pipeline, ongoing monitoring, alerts or account sync was implemented.
- The checker submits the address to third-party services only when requested. The UI explains that requests include the user's IP address. No wallet, analytics or account was added.
- Scanner findings remain fictional. The About dialog and individual scanner views distinguish them from real manual checks.
- Saved project files are separate from browser local storage. Maintain the same browser and local origin to keep scanner work. OneDrive cloud synchronization was not verified.

## Sources and next decisions

- [DEX Screener API reference](https://docs.dexscreener.com/api/reference)
- [DEX Screener listing coverage](https://docs.dexscreener.com/token-listing)
- [Rugcheck official API specification](https://api.rugcheck.xyz/swagger/doc.json)
- [Rugcheck operator report documentation](https://fluxrpc.com/docs/rugcheck/gettokenreport/)

The new opportunity research is in `research/soltech-opportunities-research-2026-09-26.md`. Its recommendations are hypotheses: test exact-token comprehension and interpretation of missing risk data first, then a comparison with a previous check and a minimal research history. Public-post-to-token evidence is a longer-term differentiator that requires matching-quality validation. Engagement or success has not been demonstrated by this implementation.

Screenshots: `live-check-mobile.png`, `live-check-mobile-results.png`, `live-check-desktop.png` in this folder. They show point-in-time API responses, not sample trading recommendations.
