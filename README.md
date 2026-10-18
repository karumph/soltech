# Solventir

Solventir (formerly Raxer and Soltech) is a web app for coin and wallet checks,
local market discovery, and a progressive Feed. The active
app is **`soltech-refined`**. Its editable HTML, CSS, JavaScript, and assets are in
**`soltech-refined/dist`**; keep that directory in Git.

The previously supplied domain was `raxer.app`; a Solventir domain is not configured. Existing repository paths, asset filenames, and browser-storage keys retain their original names for compatibility. The branding update does not configure domain hosting.

## Run locally

Install Node.js (tested with Node 24). There is no npm install or build step for
the current app. After you have repository access:

```powershell
git clone https://github.com/karumph/soltech.git
cd soltech
node soltech-refined/review/scanner-comparison.mjs
```

Open [your mobile preview](http://127.0.0.1:4185/mine?view=check),
[desktop app](http://127.0.0.1:4185/original/index.html#check), or
[side-by-side comparison](http://127.0.0.1:4185/?view=check). If this preview is
already running, reuse it. The comparison displays the co-developer's hosted site
without changing it. An alternative standalone server is available with
`node soltech-refined/mobile-preview.mjs 4183`; each origin has separate local data.

From the repository root, run the active app's tests with:

```powershell
node --test soltech-refined/tests/*.test.mjs soltech-refined/review/phone-preview.test.mjs
```

## Project map

| Path | Purpose |
| --- | --- |
| `soltech-refined/` | Current app, local server, tests, research, and review screenshots |
| `soltech-ui/` | Preserved original version |
| `soltech-a3/` | Preserved A3 design alternative |
| `soltech-signature/` | Preserved earlier experiment |
| `design-concepts/`, `design-references/` | Design studies, prompts, brand assets, and references |
| `Checkpoints/` | Historical archives and verification records; some predate current work |
| `SOLTECH-RESUME.txt` | Current handoff followed by historical notes |
| `TOMORROW-SOLVENTIR.txt` | Deferred product and UI requests; not implemented |
| `CONTRIBUTING.md` | Shared Git workflow and review steps |

Read [the current app guide](soltech-refined/START-HERE.md) and the current handoff
at the top of `SOLTECH-RESUME.txt` when older documentation describes a different
design or feature state.

## Local data and services

Coin lookups use external services and need network access. Wallet holdings and
Signals still depend on the co-developer's hosted service; local transaction,
metadata, and valuation helpers supplement those responses. The local scanner now
discovers recently indexed Solana markets and progressively updates Feed. X access
has not been configured; alerts and account/payment services remain unconnected.
See `soltech-refined/SCANNER-PILOT.md` for coverage, setup, and current limitations.
Saved profiles, preferences, and scanner drafts live in browser storage, separately
from Git. Keep your existing browser and preview port to retain that local state.

Optional Solana Tracker credentials can be supplied through the local preview's
`http://127.0.0.1:4183/setup/bundlers` form; they stay in server memory until restart.
Never put API keys, passwords, private keys, or wallet recovery phrases in source,
screenshots, commits, or ZIP archives. Environment files are ignored; the current
server does not automatically load `.env` files.

Local `.openai/` hosting configuration is excluded from new checkouts. Publishing
the website is a separate task from pushing source to GitHub. Historical archives
and earlier commits may still contain old hosting identifiers; those are not
credentials and should not be reused to publish another copy of the app.

## Working together

Each developer uses their own clone and a separate branch for each change. Open a
pull request and have the other developer review it before merging into `main`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the commands and access setup.
