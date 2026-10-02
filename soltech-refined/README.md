# Soltech — silver comparison

Checkpoint: September 29, 2026. This is the separate redesign in `soltech-refined`, not the original app. Start with `START-HERE.md` for reopening and `DESIGN-NOTES.md` for the visual system and verification record.

## Run locally

From this folder with Node.js installed:

```sh
node mobile-preview.mjs 4183
```

- Mobile: http://127.0.0.1:4183/mobile-preview.html
- Web: http://127.0.0.1:4183/index.html

No package installation or build step is required. If the URLs already work, keep the existing server running. Use the same browser and port to retain this comparison's local settings.

## Current product

Check / Finds / Scanner / Profile. The live checker accepts token addresses on Solana, Ethereum, Base, BNB Chain, Polygon, Arbitrum, Avalanche and Optimism. EVM addresses require a network choice. Reports have Overview, Chart and Details, plus persistent risk context. Charts use returned price history; market-cap history is an estimate using the current ratio and is labeled accordingly.

One prepared scanner appears immediately with optional Customize. Its settings, drafts, profile and preferences save locally. Live scanner monitoring and notification delivery remain unconnected; the new Finds feed does not invent live results. Previous scanner setups remain available when present in that browser's storage.

Market, price-history and risk sources have independent availability. Missing data does not become zero or a passed check. DEX paid status and active boosts are separate from risk. The optional Solana Tracker bundle connection uses a private local setup form and a memory-only server key; no key was copied into this comparison or its backup. Keys must never be placed in public source files.

## Design and source

`dist/soltech-identity.css` is the final visual layer. It supplies the silver/charcoal palette, restrained reflective controls, typography, varied content layouts and accessibility fallbacks. The supplied logo is unchanged. `dist/coin-checker.js` has small presentation-copy changes; lookup logic and storage models are carried over.

`research/` and `review/` contain earlier research and implementation records. Their dates matter: old screenshots and old workflow notes are historical, not the current visual specification. Current screenshots are in `design-review/`.

## Verification

```sh
node --test tests/*.test.mjs
node --check dist/app.js
```

152 automated checks passed. The current review also covers a live Solana lookup, chart controls, errors, Clear, profile cancellation, notification return paths, setup saving and draft recovery. See `DESIGN-NOTES.md` for limits.

This is local only. The inherited `.openai/hosting.json` points to the original Site and must not be used to publish this comparison without a deliberate separate hosting decision. The original folder `../soltech-ui` and its checkpoint are preserved.
