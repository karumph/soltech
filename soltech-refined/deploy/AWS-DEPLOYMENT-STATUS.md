# Current app AWS deployment

Updated October 17, 2026. Publishes the user's original Solventir app.

## Live release

- Website: https://sjay.d3ilz6ab0hx4y4.amplifyapp.com
- AWS account `942852434225`, region `us-east-1`, CLI identity `sjay-dev`.
- Existing Amplify app `soltech`, ID `d3ilz6ab0hx4y4`.
- New branch `sjay`, manual deployment job `1`: **SUCCEED**.
- Existing `soltech` and `main` branches and backend remain in place.
- Source checkpoint `3bc098b8d1b5358e43e1298905956283677bc0c8` on
  `codex/scanner-feed-refresh-2026-10-04`. Deployment work did not edit `dist`.

The user explicitly approved the AWS-issued temporary SSH key and public HTTP
origin protected by a private gateway secret. The earlier approval hold is resolved.

## Hosting

Amplify serves the frontend. Its `/sjay-api` requests pass through a Regional
API Gateway REST API to a persistent Node service. A static-only deployment would
not provide the scanner, wallet augmentation or transactions.

| Resource | Current value |
| --- | --- |
| Lightsail instance | `solventir-sjay-api`, Amazon Linux 2023, `us-east-1a` |
| Plan | `micro_3_0`, 1 GB, 2 vCPU, 40 GB; bundle price $7/month before other usage |
| Static IP resource | `solventir-sjay-api-ip` |
| Origin IPv4 | `100.63.217.136` |
| API Gateway | `k0zj4cee7j`, stage `live`, deployment `4zmw0v` |
| Gateway endpoint | `https://k0zj4cee7j.execute-api.us-east-1.amazonaws.com/live` |
| Service | `solventir-api.service`, Node 24, unprivileged `solventir` user |
| Release symlink | `/opt/solventir/current` |
| Durable findings | `/var/lib/solventir/scanner` |
| Private environment | `/etc/solventir/service.env`, root-owned and group-readable only |

The gateway allows required methods/routes only, injects the private origin
header, and uses `responseTransferMode: STREAM`. Direct origin requests without
that secret return 403. Nginx port 80 proxies to loopback 8080 without buffering.
SSH is restricted to this deployment computer's public IPv4 /32. No public IPv6
or direct port 8080 access was opened. Temporary credentials stay in the ignored
local deployment folder with restricted permissions.

Amplify rules, in order:

1. `/sjay-api/<*>` -> `https://k0zj4cee7j.execute-api.us-east-1.amazonaws.com/live/api/<*>` (200).
2. Original `/api/<*>` -> `https://leqqde6fwsmo7iqf7w5ihiwzea0sohtb.lambda-url.us-east-1.on.aws/<*>` (200), preserved.

Cache configuration is `AMPLIFY_MANAGED` to forward scanner cookies; previously
`AMPLIFY_MANAGED_NO_COOKIES`. APIs use `no-store`. Static cache policy is unchanged.
Prior app configuration is saved privately in `amplify-before.json`.

## Artifacts and verification

Ignored staging: `soltech-refined/.runtime/aws-deploy-2026-10-17`.
Authoritative package: `release-final-v2`.
Release ID: `f30e0d751e745a55760a6228ba8838947e840e45a0af6ab0c2c48fc2414a17c1`.

The package contains 81 frontend files and 19 service files, with 111 frontend
references validated. All source-backed hashes match current source. Only the
frontend ZIP goes to Amplify; the service archive goes to the server. Credentials,
tests, local previews, design copies and personal history are excluded. API-path
and hosted-copy wording transformations occur in release copies only. Older
`release-final` and `release-packaging-check` artifacts must not be deployed.

Local verification: **588 checks passed** (568 app, one phone-preview, seven
packaging, 12 production service).

Live checks passed:

- HTTPS frontend and health endpoint.
- Real coin market/risk data and chart from the browser; 6H selection and slider.
- Wallet balances and SOL price; 20 transactions and matching transaction details.
- Signals and existing co-developer Feed return real results.
- Secure, HttpOnly, SameSite=Strict cookies persist and isolate visitors.
- One session cannot pause another; POST without the required Origin is rejected.
- SSE first snapshot in 125 ms, followed by incremental coins, checks and heartbeats.
- Browser Start discovers real markets; Pause preserves the Feed (39 coins observed).
- Co-developer homepage hash, Lambda code and original branch deployments unchanged.

All test scans are paused. Service restart recovery passed: a new runtime instance
returned the same saved session, every group/coin ID and all counts (39 discovered,
30 checked, two filtered finds), with no data loss. The browser's separate Feed
also restored its 39 coins after reload. Evidence is in `live-review-results.json`,
`public-api-smoke-results.json`, and `restart-review-results.json` in the ignored
staging folder.

## Operation and recovery

For later releases, run `package-release.mjs` into a new directory after tests.
Preserve the session and gateway secrets and back up the durable findings first.
Install a versioned service directory, update `/opt/solventir/current`, and restart
`solventir-api`. Restart deliberately leaves saved scans paused. Keep earlier
releases for rollback. `install-release.sh` records this first release's path;
update it explicitly before using it for a later version.

Temporary SSH access comes from Lightsail `get-instance-access-details`. Verify
AWS-returned host keys. Windows OpenSSH needed SEC1 conversion of the temporary EC
private key plus the matching `.pub` file to use its certificate. Do not print
credential responses. No permanent administrator key was installed by this release.

Rollback the website by redeploying a previous verified frontend package. Do not
remove the original `/api` rule or replace `soltech-api`. If retiring this pilot,
handle the Amplify branch, gateway, Lightsail instance/static IP, and saved findings
separately; preserve data before deleting resources. There is no automatic teardown.

## Limits and existing dependencies

This is a bounded hosted pilot: 64 unexpired anonymous browser sessions, four
active scans, 32 event streams and 24 concurrent ordinary API requests. These are
infrastructure limits, not subscription allowances. Closing the page does not
pause an active scan. Restart and 30-day session expiry pause it. Expired findings
are archived, not deleted. See `PRODUCTION-SERVICE.md` for details.

X remains explicitly disconnected. Optional bundler data needs its own provider
connection. This release does not add accounts, payments, daily allowances,
alert delivery or advanced X interpretation. Browser-local settings and recent
history do not migrate automatically from localhost or between devices.

Wallet holdings and Signals still depend on the co-developer's existing service.
Keep its Lambda `soltech-api` and original routing intact; routing those requests
back into the new adapter would create recursion. The app's approved original
UI, chart controls and profile flow remain unchanged.
