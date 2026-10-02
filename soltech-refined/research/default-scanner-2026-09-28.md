# One default Soltech scanner

Research addendum, September 28, 2026. This supersedes the preset-first setup recommendation in [single-scanner-direction-2026-09-28.md](single-scanner-direction-2026-09-28.md). The earlier report remains a historical record; its source-specific matching, evidence, preservation and backend cautions still apply.

## Agreed product direction

Provide **one default Soltech scanner immediately**, with optional **Customize**. A new user should not have to select a preset, supply X accounts or complete a builder before the scanner's purpose and settings are visible. Keep the approved **Check, Finds, Scanner, Profile** navigation, with **Check first**. A feed supplied with defaults does not require making Finds the opening destination.

The starter product choice is **direct contract-address mentions from a future Soltech-managed X list plus new launches**. Either source may produce a find; each applies its own relevant filters. This is an authored product decision, not a research-proven optimal strategy. The sources below do not validate profitable, safe or universally effective thresholds.

The default is a prepared configuration, not an assertion that monitoring has started. **The managed X list has not been authored or populated, and the scanner sources are not connected.** The existing coin checker is live. Saving or customizing scanner settings must not imply that background monitoring or alerts are active.

## What the primary sources establish

| Source | Documented behavior | Evidence limit |
| --- | --- | --- |
| [J7: Manage Accounts](https://docs.j7tracker.io/docs/accounts) | J7 supplies a main feed of accounts tracked for everyone. Users already receive those accounts and can hide or restore them. Optional custom accounts consume slots; an available pool lets users add accounts that others fund. | Supports supplied sources plus optional personalization. Does not establish a particular numeric filter preset, the identities of today's full main list, or the exact first-login UI. Pool membership can disappear when nobody continues to fund tracking. |
| [J7: Connect](https://docs.j7tracker.io/docs/feed) | The feed includes main-feed accounts, personal additions and social posts, with an initial backlog followed by live events. Main-feed accounts hidden by a user are excluded. | API behavior supports a combined feed. This research did not log in, connect to the stream or measure delivery performance. |
| [J7: Events](https://docs.j7tracker.io/docs/feed-events) | The initial backlog mixes X posts, social posts and webhook cards. Later updates enrich existing posts; clients deduplicate by post ID. Non-X social posts are global and can be filtered by author by the client. | A supplied social feed is not evidence that every item identifies a token or passes market/risk filters. Post deduplication is separate from deduplicating a token across sources. |
| [GMGN: X Tracker](https://docs.gmgn.ai/index/x-tracker) | Documents a curated account catalog, personal account selection, custom accounts and selectable event types. Its CA/Token option limits displayed posts to those containing contract addresses. | Establishes supplied sources and customization, but does not specify the exact selections enabled for a newly created account. A contract mention does not establish endorsement or token quality. |
| [Axiom: Explore Tokens](https://docs.axiom.trade/axiom/finding-tokens/explore-tokens) | Provides New Pairs and Trending discovery views, optional filtering and a Watchlist populated by starring tokens. | Establishes prepared discovery views and optional narrowing. It does not publish validated default thresholds or prove the complete onboarding sequence. |
| [Axiom: Pulse](https://docs.axiom.trade/axiom/finding-tokens/pulse) | Separates launch lifecycle stages and documents age, liquidity, volume, market cap, transaction and ownership filters. | Describes available controls. It does not establish that a new launch is suitable for a beginner or that any configuration predicts returns. |

The strongest evidence for defaults is J7's explicitly supplied main feed. The inference for Soltech is to provide a useful starting configuration and let customization follow. These sources do **not** justify requiring a preset choice, copying a competitor's account list or promising equivalent coverage.

### J7 identity and research scope

[j7tracker.io](https://j7tracker.io/) resolves as the J7Tracker application, and the coherent product/API documentation is under [docs.j7tracker.io](https://docs.j7tracker.io/docs). These are the best-supported product sources found. The research tool could not access or corroborate `j7tracker.co` as canonical. The unrelated `0zgunner/j7tracker` repository and browser-extension listings were excluded as product evidence.

This was a read-only review of public documentation, not an authenticated usability study or provider trial. No extension, bookmarklet, account, paid service or stream connection was used. Provider latency claims were not independently validated.

## How the default should be presented

- **Scanner:** show the default's source summary immediately, with optional Customize. Advanced source and filter controls can remain available without becoming prerequisites.
- **X sources:** identify the future list as managed by Soltech, and show its actual members and scope once authored. Until then, describe it as pending; do not present an empty list as an active curated service. Users may later add or hide accounts without having to do so to start with defaults.
- **Matching:** start with direct address references, clearly distinguished from ticker guesses or thematic connections. New launches are an independent source. An X mention need not also be a new launch to qualify.
- **Finds:** keep one combined feed with source labels, original evidence, timestamps and match reasons. Deduplicate by network plus contract address while retaining each supporting event.
- **Customization and recovery:** preserve existing personal settings and earlier configurations. A restore-defaults action should preserve the prior version. Do not silently overwrite custom rules when a managed list or default changes; make the applicable version and update policy explicit.
- **Connection state:** distinguish prepared settings, monitoring, paused/unavailable sources and a connected source with no matches. The current state is prepared settings with unconnected monitoring.

The list's membership, maintenance criteria, coverage and update policy still need authorship. A label such as Soltech defaults is not evidence that these choices have been validated. Avoid inventing trusted accounts, enabled connections, result counts or safety scores to make the screen feel complete.

## Bounded backend next steps

1. **Author the first managed list and contract.** Choose a small, explicit set of X accounts; document why they are included, supported networks, event types, maintenance ownership and how user exclusions persist. Select a provider only after reviewing access, permitted use, cost and coverage. No provider is selected or purchased by this addendum.
2. **Prove direct mentions on that bounded scope.** Ingest permitted posts, extract and validate contract addresses, resolve network/token identity, retain source evidence and emit explainable finds. Handle edits, deletions, duplicate deliveries, stale data and connection failure. Do not silently treat missing market/risk data as a passing value.
3. **Add one launch provider and one defined lifecycle event.** Specify the chain, venue coverage and meaning of new. Apply explicit per-source rules and merge matching tokens into the same Finds feed. Additional social platforms, thematic inference and broader market scanning remain later work.
4. **Validate quality before calling the defaults effective.** Review a labeled sample for correct address extraction, network resolution, irrelevant mentions and duplicate merging. Compare observed coverage with a documented reference sample, recording its limitations. Measure delivery delay, outage recovery and provider usage under the actual configuration. Evaluate launch filters by resulting coverage and noise; do not infer investment performance from filter compliance.
5. **Validate the beginner experience.** Confirm that users can explain what the default watches, inspect why a find appeared, customize one source, restore prior settings and distinguish saved settings from live monitoring. Keep Check first during this evaluation.

A production monitor requires server-side persistence and a documented freshness/availability model; a saved browser configuration alone is insufficient. Default thresholds and list membership should be versioned so quality checks can be repeated against the configuration that actually produced each find.
