# Soltech

Soltech is a web app for coin checks and a customizable scanner preview. The active
app is **`soltech-refined`**. Its editable HTML, CSS, JavaScript, and assets are in
**`soltech-refined/dist`**; keep that directory in Git.

## Run locally

Install Node.js (tested with Node 24). There is no npm install or build step for
the current app. After you have repository access:

```powershell
git clone https://github.com/karumph/soltech.git
cd soltech
node soltech-refined/mobile-preview.mjs 4183
```

Open [mobile preview](http://127.0.0.1:4183/mobile-preview.html) or
[desktop preview](http://127.0.0.1:4183/index.html). If your existing preview is
already running on port 4183, reuse it.

From the repository root, run the active app's tests with:

```powershell
node --test soltech-refined/tests/*.test.mjs
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
| `CONTRIBUTING.md` | Shared Git workflow and review steps |

Use the current handoff at the top of `SOLTECH-RESUME.txt` when older documentation
describes a different design or feature state.

## Local data and services

Coin lookups use external services and need network access. Live scanner monitoring
and notification delivery are not connected; the scanner is a visual demo.
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
