# Solventir

This is the user's current app, saved October 16, 2026. The editable source is
`dist/`; it is not generated build output. The older `soltech-ui` folder and
historical design copies are separate references.

See [START-HERE.md](START-HERE.md) for startup, current features and limits,
and [SCANNER-PILOT.md](SCANNER-PILOT.md) for the discovery service and X setup.
No dependency installation or build step is required; use Node.js 24.

From the repository root:

```sh
node soltech-refined/review/scanner-comparison.mjs
```

- Your mobile app: http://127.0.0.1:4185/mine?view=check
- Desktop app: http://127.0.0.1:4185/original/index.html#check
- Your app beside the co-developer's hosted app: http://127.0.0.1:4185/?view=check

Reuse an existing preview. Browser-local settings and histories are specific to
that browser and origin. The local scanner's runtime state is separate and ignored
by Git. Never commit provider credentials, runtime access links, or saved user data.

The white, silver and charcoal design is intentional. Preserve existing scanner
geometry, glass controls and saved data when refining it. Research and review files
are historical evidence, not instructions to replace the current app.
