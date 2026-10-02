# Automatic network lookup — October 1, 2026

The active refined checker now keeps the network selector hidden on initial entry and on remembered results. Solana addresses use Solana directly. EVM addresses query each of the seven supported EVM networks through DEX Screener's token-pairs endpoint. One exact base-token match opens automatically; multiple network matches require a choice. Multiple pools on one network do not create ambiguity. No network is chosen based on liquidity across chains.

If any network request fails or times out, or no indexed match is returned, the form offers manual selection across the supported networks. Manual fallback stays available so the user can correct the selection. Provider indexing is not proof that an address cannot exist on an unreported network.

Changing the address, clearing, or leaving the checker cancels discovery. Late responses cannot start a stale lookup. Repeated submission during discovery shares the in-flight lookup. Existing risk, listing, market, and chart handling remains in use.

The heavy black focus rings on the token field, Clear and Check coin are removed. The field uses the exact original SVG border geometry with a restrained blue-gray stroke and pale fill; its inset underline was removed after it created an uneven lower-left corner. Buttons use a subtle underline. The mobile field was verified by typing and pressing Clear, and button states were checked with keyboard navigation.

Verification: 55 existing checker/render/history tests, 12 new discovery tests, and 15 browser DOM tests passed. The browser tests live in `tests/coin-network-ui.html`; to run them, temporarily serve a copy from the dist root as `network-ui-test.html` using the existing preview server, open it, and remove that temporary copy after testing. They use deterministic dependencies and make no live data requests.

Live mobile verification: Wrapped Ether's Ethereum address resolved automatically without a network selector. The shared Base/Optimism wrapped-ether address prompted with those two choices. The focused mobile field was visually verified without the outer ring; screenshot: `automatic-network-mobile.jpg`.

API reference consulted: https://docs.dexscreener.com/api/reference (token-pairs endpoint).

Changed runtime files: `dist/coin-network-discovery.js`, `dist/coin-checker.js`, `dist/coin-checker.css`, and `dist/soltech-identity.css`. Applied to the existing refined mobile/web preview on port 4183. No hosted deployment was performed.
