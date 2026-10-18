# Start here: current Solventir app

Current source checkpoint: October 16, 2026. Work in `soltech-refined/dist`.
This is the original version the user approved in the comparison, not the later
Figma/redesign experiment. Visible branding remains Solventir. Legacy storage keys
and filenames remain unchanged for compatibility.

## Open the current app

From the repository root, with Node.js 24:

```sh
node soltech-refined/review/scanner-comparison.mjs
```

Open http://127.0.0.1:4185/mine?view=check for the mobile frame, or
http://127.0.0.1:4185/original/index.html#check for the responsive app directly.
The comparison at http://127.0.0.1:4185/?view=check loads your version on the left
and the co-developer's separately hosted app on the right. Reuse the running server
and original browser/origin to retain local settings and histories.

Alternatively, `node soltech-refined/mobile-preview.mjs 4183` serves the same app
at http://127.0.0.1:4183/index.html and its mobile wrapper at
http://127.0.0.1:4183/mobile-preview.html. This server also offers the private,
memory-only optional bundle-provider setup at `/setup/bundlers`.

For a physical phone on a trusted local network, start the comparison server first,
then run `node soltech-refined/review/phone-preview.mjs <private-IPv4> 4187`.
Its generated access link is saved under ignored `.runtime/phone-preview.json`.
Do not commit or publicly share that access link. Keep the computer awake;
phone browser data is separate. This HTTP LAN preview is not a production host.

## Working features

- Coin checks, network selection, market figures and evidence-based risk details.
  Missing data stays unavailable. Ownership signals are prominent on mobile;
  secondary details remain expandable.
- Historical chart snapshots with 1H, 6H, 1D and All ranges. The slider selects
  recorded values; chart pinch, pan and Reset view are removed. No live streaming.
  All means available returned history, not guaranteed lifetime coverage.
- Solana wallet holdings, token logos, estimated value including priced SOL,
  and recent transactions with amounts, time and in-app details where available.
  Unpriced or incomplete data is identified instead of treated as zero.
- Recent coins and wallets stay local and appear when their search is cleared.
  Coin history keeps the five most recent entries. Clearing history is synchronized
  across tabs and protected against delayed results restoring cleared entries.
- Real bounded Solana market discovery, Start/Pause, saved findings and progressive
  Feed updates. See [SCANNER-PILOT.md](SCANNER-PILOT.md) for coverage and limits.
- Shared Signals, saved profile preferences, and a circular top-right Profile
  shortcut. Profile contains identity editing, scanner settings, Notifications,
  Privacy, Terms and About; old Settings routes remain compatible. Main navigation
  contains Check, Feed, Scanner and Signals.

## Limits and deferred requests

Wallet holdings and Signals still rely on the co-developer's hosted services.
Provider availability varies. X access is not configured or live-verified; the
prepared adapter and original-post/media display are tested with fixtures.
Post summaries are source excerpts and matching is basic evidence matching;
advanced interpretation remains future work. No account sync, billing, daily
allowance enforcement, alert delivery, or native phone app is implemented.

[The next-session list](../TOMORROW-SOLVENTIR.txt) is notes only: improve logo
consistency, launch with one non-customizable scanner, refine the grouped coin
signals, and change Profile entry to a compact dropdown. These are not implemented
by this checkpoint; the current app still has scanner customization and a full
Profile page.

## Verify and preserve

```sh
node --test soltech-refined/tests/*.test.mjs soltech-refined/review/phone-preview.test.mjs
node --check soltech-refined/dist/app.js
```

The phone-preview test opens temporary local HTTP servers and needs loopback
network access. Browser fixtures under `tests/` are explicitly separate from real
scanner results. See the scanner pilot guide for their purpose.

Do not reset or replace local changes, clear browser storage, commit credentials,
or publish the hosted app as a side effect of pushing code. Git stores source,
not personal browser data or live scanner findings. The vendored chart library's
license and attribution files remain in `dist/vendor`.
