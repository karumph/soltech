# Solventir production service

This service hosts the original app's API adapters and scanner on one persistent
Node.js 24 process. It does not serve the development preview, key setup page,
test fixtures, or static files. The static release remains on Amplify.

Run `node deploy/production-server.mjs` from the packaged service directory.
No npm dependencies are needed. Use a dedicated unprivileged OS user and a
process supervisor that restarts the service. Keep the data directory on durable
storage, outside every static web root, and back it up before updating the service.

## Environment

| Name | Value |
| --- | --- |
| `PORT` | Listener port, default `8080` |
| `SOLVENTIR_ALLOWED_ORIGINS` | Comma-separated exact HTTPS app origins; no paths or trailing slash |
| `SOLVENTIR_ORIGIN_SECRET` | Random secret of at least 32 characters, injected by the trusted API front door |
| `SOLVENTIR_SESSION_SECRET` | A different random secret of at least 32 characters; retain it across releases |
| `SOLVENTIR_DATA_DIR` | Absolute path to a writable durable private directory |
| `SOLVENTIR_MAX_SESSIONS` | Saved active browser-session slots, default `64` |
| `SOLVENTIR_MAX_ACTIVE_SCANS` | Simultaneously running scanners, default `4` |
| `SOLVENTIR_MAX_STREAMS` | Open event streams, default `32`, at most four per session |
| `SOLVENTIR_MAX_CONCURRENT` | Concurrent non-stream requests, default `24` |

X is explicitly disconnected in this release, even if inherited X environment
variables exist. Optional bundler data remains disconnected unless a server-side
provider key is deliberately configured. No key configuration route is exposed.
Never put these environment values or saved scanner files in the frontend ZIP.

## Routing and browser sessions

The service accepts `/api/*` and `/sjay-api/*` for the known wallet, transaction,
Signals, bundler and scanner endpoints. `/health` and `/api/health` return a minimal
status. Every endpoint requires `X-Solventir-Origin-Secret`; the public front door
must overwrite that header with its secret. Prevent direct untrusted access to
the origin where possible. Forward the browser's `Origin`, `Cookie`, `Accept`, and
`Content-Type`. Do not cache API responses or strip `Set-Cookie`. Preserve streaming
responses for `/scanner/events`. Verify real streaming through the complete public
route before declaring deployment complete.

Only `GET /scanner` establishes an anonymous browser session. The deployment copy
of the client finishes that request before opening its event stream. The session
cookie is signed, Secure, HttpOnly, SameSite=Strict and scoped to `/sjay-api`.
POST actions require an allowlisted browser origin. Sessions have separate settings,
findings, Start/Pause controls and files; they are not sign-in accounts. Clearing
cookies or changing browsers starts a separate session.

A session lasts 30 days from its creation. An active scan continues after closing
the page while this service is running. At session expiry, the scan pauses and its
files move to a private archive; no saved findings are deleted by the service.
Archived findings are retained for operator recovery, not automatically shown to
a new browser session. Restarting the server always leaves saved scans paused;
the user must press Start to resume. Changing the signing secret invalidates
existing browser cookies and should be avoided during normal releases.

The initial pilot supports 64 unexpired browser sessions and four active scans.
At capacity, the service returns an explicit busy/capacity message; saved findings
and coin/wallet checks remain available as applicable. These are infrastructure
limits, not paid-plan or two-hour account entitlements. Archived storage needs
normal operational monitoring and an explicitly chosen retention policy before
wider public rollout; this service never silently deletes archives.

One shared provider queue spaces calls across scanners and wallet transactions,
bounds pending provider work and honors provider rate limits. Existing upstream
wallet holdings and Signals remain dependent on the co-developer's services.
Provider outages remain unavailable/error states; no synthetic findings are used.

## Verification

`node --test deploy/production-server.test.mjs` checks secret/origin enforcement,
allowed endpoints, malformed and oversized JSON, signed cookie isolation, retained
findings across restart, scanner/session/stream capacity, concurrent action locks,
non-destructive session expiry, provider spacing and cooldowns, and health routing.

For public verification, check wallet holdings, transaction details and Signals;
open two separate browser sessions and verify one cannot stop the other's scan;
confirm new results update before optional checks finish. Pause test scans after
verification. A successful static-page load alone does not verify the service.
