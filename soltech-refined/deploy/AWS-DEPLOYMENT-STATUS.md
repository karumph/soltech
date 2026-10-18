# Current app AWS deployment

Updated October 18, 2026. Publishes the user's original Solventir app.

## October 18 release verification

- Amplify `sjay` manual deployment job `3`: **SUCCEED**.
- App source: `50573178cfed97082ee993a61226e1642f67cebd`, pushed to
  `codex/scanner-feed-refresh-2026-10-04`.
- Release: `7fcb196453d5c55be95134498ca793822854e926005b3390b25a9e5a06e53422`.
- Frontend and API updated together, including the revised coin reports,
  expanded network support, wallet account-type validation, wallet copy icon,
  and four-pixel wordmark offset.
- All 684 automated checks passed. After publication, all eight domain/HTTPS
  redirect checks and API health passed with normal DNS. Five key public assets
  matched the release package exactly. A coin address was rejected by Wallet;
  a genuine wallet returned its matching address and seven holdings.
- Service environment and saved scanner findings were hash-verified unchanged.
  Backup: `/opt/solventir/backups/scanner-20261018.tar.gz`. Restart leaves scans
  paused; saved findings remain available.
- Previous service release retained for rollback:
  `f30e0d751e745a55760a6228ba8838947e840e45a0af6ab0c2c48fc2414a17c1`.
- Local release artifacts are ignored under
  `soltech-refined/.runtime/aws-deploy-2026-10-18/`. No credentials are committed.

The October 17 baseline and hosting details below remain for reference.

## October 17 baseline

- Website: https://www.solventir.com
- Original AWS address: https://sjay.d3ilz6ab0hx4y4.amplifyapp.com
- AWS account `942852434225`, region `us-east-1`, CLI identity `sjay-dev`.
- Existing Amplify app `soltech`, ID `d3ilz6ab0hx4y4`.
- Branch `sjay`, manual deployment job `2`: **SUCCEED** (HTTPS response header).
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
Current frontend package: `release-https-v1`.
Release ID: `eb1268be8a89b4462e028f04a2c3a453417092b7cc6cc89af546382660fcc0c6`.
Frontend ZIP SHA256: `F25485D40F3B5BECE45D637035790B14C41A518535DFDD8F53E621D429A82F69`.
The running service remains from `release-final-v2`, release ID
`f30e0d751e745a55760a6228ba8838947e840e45a0af6ab0c2c48fc2414a17c1`.

The original package contained 81 frontend files and 19 service files, with 111
frontend references validated. The HTTPS update adds only `customHttp.yml` to the
frontend; all 100 existing frontend/service file hashes match the prior release.
The service was not restarted or redeployed for this change. Only the
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

## Custom domains and HTTPS

The user requested `solventir.com` with `www.solventir.com` as the served site and
the root forwarded to it through GoDaddy. GoDaddy DNS uses `ns09.domaincontrol.com`
and `ns10.domaincontrol.com`. The user signs into GoDaddy in a normal browser;
its sign-in rejected the in-app browser. Do not request passwords in chat.

The user saved this public certificate validation CNAME, and it resolves correctly:

- Name: `_462fadeaaf0c5be6a240de6d39d9593e`
- Target: `_7e9c4fedcc10a30980509ade2d795a90.wzccmgtwzk.acm-validations.aws`

An existing domain association was found with root and `www` both mapped to `main`.
After ownership verification it remained locked against updates until visitor DNS
was connected. Its settings were backed up in ignored `domain-before-remap.json`.
After verifying no hostname was live/verified and public `www` still pointed to
GoDaddy's root, only that pending association was canceled and recreated with
`prefix=www,branchName=sjay`. App, branches, deployments and DNS were not deleted.
The association is now `AVAILABLE`. Its current settings name `sjay` for the root
and `www`, but actual root traffic uses GoDaddy forwarding, not the AWS origin.
The authoritative visitor CNAME is `www` -> `d3h57exw4rh4x9.cloudfront.net`.
The certificate verification CNAME above is retained for renewal. Do not restore
the old CloudFront target or point `www` back to the root.

The user configured permanent, unmasked HTTPS forwarding. All HTTP/HTTPS root
and `www` variants of `solventir.com` and `soventir.com` reach the canonical
`https://www.solventir.com/` with zero or one redirect and a 200 response when
using current DNS. HTTPS certificate validation passed for all four hostnames.
The user confirmed access from their phone and their co-developer's computer.

During initial setup, an old `www` -> `solventir.com` DNS record caused a loop:
old DNS sent `www` to GoDaddy, which redirected it to itself. Old resolver caches
and browser-cached 301 responses can outlast the correction. At approximately
03:02 America/Chicago on October 17, this computer still received that stale
answer; flushing its local cache did not refresh the upstream resolver. This
does not require further DNS/forwarding edits. Diagnose normal DNS separately
from tests using a fresh resolver; never claim universal reachability based only
on a DNS override. Do not bypass browser certificate warnings.

The live server and ignored local service environment now permit both the original
Amplify origin and `https://www.solventir.com`. Existing secrets and data were
retained. Service restart succeeded; a scanner request carrying the new Origin
returned 200 with a secure session cookie. The canonical website and
`/sjay-api/health` have passed live HTTPS checks with current DNS.

`deploy/customHttp.yml` is now included in every frontend release. It sets
`Strict-Transport-Security: max-age=86400` on this branch only. This cautious
one-day, host-only policy is renewed on each successful HTTPS visit; it does not
include subdomains or preload. The live header was verified after job 2 succeeded.
App-wide custom headers remain empty, shared rewrites are unchanged, the
co-developer's HTML hash is unchanged, and `soltech`/`main` still have jobs 8/7.
Eight packaging tests pass. HSTS helps prevent HTTP use after a successful visit;
it cannot repair stale DNS or cached redirects, cover the parent/other domains,
or prevent every possible certificate/network failure. Preserve automatic
certificate renewal and the validation CNAME. A longer HSTS lifetime can be
considered after the complete domain configuration has settled.

Post-deployment verification passed at about 03:03 America/Chicago with both
system DNS and the explicitly labelled Cloudflare diagnostic resolver: all eight
entry routes, canonical HTTPS/HSTS, and API health. An ordinary curl request also
followed the root to the app with HTTP 200 and valid TLS, without a DNS override.
Some standalone DNS queries still reported older cached records, so this is not
a guarantee that every browser/provider cache has updated. Evidence:
`verify-domains-2026-10-17T08-03-07-483Z.json` in the ignored staging folder.
All 14 focused packaging and domain-verifier tests pass.

## Operation and recovery

For later releases, run `package-release.mjs` into a new directory after tests.
Run `node soltech-refined/deploy/verify-domains.mjs` before and after a deployment
from the repository root. It checks all eight domain/protocol entry points,
limits redirects, rejects HTTPS downgrades and unexpected hosts, validates normal
TLS, requires HSTS on the canonical page, and checks API health. It exits nonzero
on failure. `--resolver=1.1.1.1` is a separately labelled diagnostic for stale DNS;
it still validates certificates against the requested hostname. A diagnostic
pass does not override a failing normal-system-DNS result. The six verifier
unit tests use injected responses and make no external requests.

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
