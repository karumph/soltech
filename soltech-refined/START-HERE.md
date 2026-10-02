# Resume the current Soltech app

**Current version: October 2, 2026.** This is the active app, including the animated scanner, simplified customization, persistent Pause, and automatic network lookup. Read the current section of `../SOLTECH-RESUME.txt` first. Run `node mobile-preview.mjs 4183` from this folder and use `http://127.0.0.1:4183/mobile-preview.html`; reuse the server if it is already running. App source is in `dist` and requires no build step. The older comparison notes below are historical.

Current checkpoint: September 30, 2026. Read `../SOLTECH-RESUME.txt` first for the latest user decisions and fresh-chat handoff. Current metric tiles are M1 with SOFT rounded corners; the latest finished feature is the chart slider's glass-style handle. The user asked to pause after it. The older overview below remains as historical context; no automatic redesign or deployment is requested.

## Open the two versions

The original remains in `../soltech-ui` on port 4175. This separate version is `soltech-refined` on port 4183. Do not replace the original folder with this copy.

Run from this comparison folder:

```sh
node mobile-preview.mjs 4183
```

Then open:

- Mobile comparison: http://127.0.0.1:4183/mobile-preview.html
- Web comparison: http://127.0.0.1:4183/index.html

For the original, run `node mobile-preview.mjs 4175` from `../soltech-ui`, then open http://127.0.0.1:4175/mobile-preview.html or http://127.0.0.1:4175/index.html. If a preview already opens, leave its server running.

## Where we stopped

The separate redesign is complete for review. The latest request favors a silver theme and removes the blue line beneath the selected glass control. Silver navigation, charcoal actions, quiet paired edge details, open data sections and consistent typography now extend through Check, coin reports, Finds, Scanner, setup, Profile and settings. The supplied logo remains unchanged.

The original's 162 baseline files were checked against `original-baseline.json` without a mismatch. The redesigned copy has its own file manifest and ZIP checkpoint. `../OPEN-SOLTECH.md` points to both versions and their backups.

Next: compare the silver version with the original before adopting a direction. No further feature work or replacement of the original is implied. The main product gap remains live scanner monitoring, which is not connected; the checker already uses live data.

## Keep saved work safe

Project ZIPs contain source files, research and screenshots. Profile photos, scanner settings, drafts and preferences live separately in browser storage. Keep the same browser and port and do not clear site data. Ports 4175 and 4183 have separate local settings. A last coin lookup is tab-local and can be rerun after refresh.

No provider key was copied. The optional bundle service remains unconnected here until a key is entered privately; it is held only in the running server and clears on restart. Public lookup sources may have their own availability and coverage gaps. No native iPhone build, account sync, live X monitoring or notification delivery is provided by this preview.

Read `DESIGN-NOTES.md` for the design rules and QA record. Earlier dated documents in `research/` and `review/` are history and may describe superseded flows. The hosted website has not been updated. Local hash verification does not confirm OneDrive cloud sync.
