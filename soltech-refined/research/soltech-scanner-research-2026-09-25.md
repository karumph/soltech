# Soltech scanner research

Research checked September 25, 2026. This report covers the research findings. The subsequently requested UI controls are implemented separately; no live data integrations were connected.

**My recommendation is to learn from GMGN and Axiom’s social workflows, Axiom and Photon’s launch filters, and evaluate Birdeye as the first market-data provider.** Combine that with licensed X access and explicit risk evidence. Soltech’s opportunity is to explain why a coin appeared and what deserves attention, while making the controls understandable to a beginner.

There is no defensible “absolute best” from documentation alone. These recommendations assess documented suitability. I did not use paid accounts, benchmark feeds, audit security services, or verify vendors’ performance claims. Solana is a working assumption for the first version, not a confirmed restriction on the product.

**The strongest candidates serve different jobs.**

| Product or service | Where I would use it as a reference | Main limitation |
|---|---|---|
| GMGN | Public-account monitoring connected to token research | Theme-to-token accuracy and private detection algorithms are not established |
| Axiom | Connecting social evidence, launch stages, and token previews | Public documentation is uneven; private infrastructure is not disclosed |
| Photon | Launch feeds, useful filters, controls that keep a moving feed readable | Primarily a product reference here; no supported public data feed was verified |
| DEX Screener | Market context, pair lookup, external verification links | Inspected public feeds do not establish comprehensive earliest-launch coverage |
| Birdeye Data | First candidate for launch discovery and market enrichment | Coverage, commercial rights, and workload cost need a real trial |
| GeckoTerminal / CoinGecko | Cross-chain discovery prototype and secondary market source | Free REST limits; some checks do not support Solana |
| RugCheck / GoPlus | Risk reasons and structured token-security fields | A report is evidence, not a guarantee or calibrated probability of loss |
| Helius | Direct Solana events when an indexed market feed is insufficient | Requires event handling, coverage checks, and recovery logic |
| LunarCrush / Kaito / Santiment | Broader social context and narrative research | Social attention is different from token identity and technical risk |

The evidence and specific qualifications for these judgments follow.

**The most useful customization choices are a small subset of what competitors expose.** Axiom, Photon, and GMGN repeatedly document age, liquidity, valuation, activity, and ownership controls. That establishes common availability, not which filters users actually select most. No usage telemetry was available in this research. [Axiom Pulse](https://docs.axiom.trade/axiom/finding-tokens/pulse), [Photon Memescope](https://pies-organization.gitbook.io/photon-trading/photon-on-sol/memescope), [GMGN new pairs](https://docs.gmgn.ai/index/new-pair)

I would design the following controls for Soltech. Priority is my product recommendation, not a claim about profitable settings.

| Priority | Control | What the user changes | Design decision |
|---|---|---|---|
| Basic | Age | Minimum and maximum time since a specified event | Use a clear label such as Token age; keep Pool age separate |
| Basic, where applicable | Liquidity | Minimum available liquidity in USD | Define which pool or market it describes; use separate launchpad metrics before a DEX pool exists |
| Basic | Market cap | Valuation range | Show FDV separately when circulating-supply market cap cannot be established |
| Basic | Recent activity | Volume or trades over a chosen period | Pair every threshold with its window; do not present several nearly identical controls initially |
| Basic | Risk shown | Which assessed risk categories appear | Risk checks continue regardless; unknown remains its own category |
| Scanner-specific | Launch stage | On launchpad, nearing graduation, or trading on a DEX | Explain graduation as movement from a launchpad curve into a DEX pool |
| Scanner-specific | People to follow | Selected public accounts | Show identity and handle clearly; do not depend on display name alone |
| Scanner-specific | Match type | Direct mentions and/or related themes | Keep the broader matches visibly uncertain |
| Advanced | Holder concentration | Largest-owner or top-ten share | Explain exclusions and ownership aggregation |
| Advanced | Creator holdings | Maximum attributed creator share | Distinguish a known creator address from suspected related wallets |
| Advanced | Holders and active wallets | Counts or growth over a period | Wallets are not necessarily different people |
| Advanced | Price and activity change | Change over a selected window | Require enough history; missing history is not zero change |
| Advanced | Launchpad or exchange | Included venues | Show actual supported coverage |
| Advanced | Technical checks | Permitted token controls and liquidity conditions | Explain the underlying control instead of using opaque acronyms |
| Later | Bundles, snipers, related-wallet signals | Provider-specific exposure limits | Add only with documented definitions, evidence, and uncertainty |

For early projects, **Launch stage should come before the market fields**. Liquidity in a conventional pool and reserves on a bonding curve need different treatment. Applying a DEX-liquidity minimum to every launch could accidentally eliminate the earliest projects the scanner exists to find. Pump’s documentation describes trading on the curve before migration into PumpSwap. [Pump program documentation](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md)

For the Public figure scanner, the first controls should be **People** and **Matches**. Optional controls can cover post age, inclusion of replies/reposts/quotes, and words to include or exclude. GMGN already documents account selection, post-type selection, and a contract-address-only view. Soltech’s broader related-theme mode would need additional matching work. [GMGN X Tracker](https://docs.gmgn.ai/index/x-tracker)

I would initially include direct mentions and clearly labeled related-theme candidates to reflect your concept. Users should be able to narrow to direct mentions. This is a proposed default to test, not a verified best practice. A post about an animal may inspire several unrelated coins; it does not establish that the author launched, owns, or endorses any of them.

**The filter interface should explain the effect of a choice.** Start with sensible editable presets, simple ranges with units, and an Advanced section. Show a plain-language summary before applying changes. Once real data exists, preview the matching results and explain which rule excludes a candidate. Never invent a live result count for the UI prototype.

Combine different filter groups with “all conditions,” and selections within a group with “any selected option.” Let users restore defaults, duplicate a scanner before experimenting, and recover a draft. A selected numeric filter should not silently accept an unknown value: put that candidate in an explicit insufficient-data state or exclude it with a visible reason.

Exact numerical defaults need a real sample of launches. A liquidity floor or top-holder percentage copied from another tool is not an established safety boundary. An age selector such as “past hour / past day / custom” is a usability example, not a trading recommendation.

**Several familiar metrics need careful wording.**

- Market cap and FDV are valuations, not the amount of cash available to trade. CoinGecko explicitly returns null for unverified market cap; its inspected Megafilter uses FDV ranges. Do not quietly replace one with the other. [CoinGecko Megafilter](https://docs.coingecko.com/reference/pools-megafilter)
- A new pool is not necessarily a new token. Keep token creation, first observed trading, pool creation, and migration timestamps separately.
- Volume and transaction counts measure activity, which can include wash trading. Axiom’s own documentation recognizes this limitation. [Axiom Explore](https://docs.axiom.trade/axiom/finding-tokens/explore-tokens)
- Holder accounts are not people. Solana’s largest-accounts method returns token accounts; meaningful owner concentration needs aggregation and treatment of pool vaults, custodians, and other known accounts. [Solana largest token accounts](https://solana.com/docs/rpc/http/gettokenlargestaccounts)
- A social link, paid listing, or boost does not establish legitimacy. DEX Screener says purchased boosts can influence trending. [DEX Screener boosting](https://docs.dexscreener.com/boosting)

**DEX Screener is particularly useful for understanding a real market-data system.** Its FAQ says it parses blockchain logs with a custom indexer rather than sourcing market data from other APIs. Its private language, databases, deployment structure, and ranking weights are not disclosed. [DEX Screener FAQ](https://docs.dexscreener.com/)

Automatic listing follows the addition of liquidity and at least one transaction. Its public REST interface exposes pair and token lookups, liquidity, transaction counts, volume, price changes, valuations, and pool timestamps. Documented pair/token limits are 300 requests per minute; promotion-related endpoints are generally 60. [Listing rules](https://docs.dexscreener.com/token-listing), [API reference](https://docs.dexscreener.com/api/reference)

It now documents WebSockets, so “DEX Screener has no WebSocket API” would be outdated. However, the inspected streams concern profiles, profile updates, community takeovers, advertisements, and boosts. They do not establish an exhaustive new-pool feed. I would use it for enrichment and independent links, rather than assume those feeds discover every earliest launch. [WebSocket documentation](https://docs.dexscreener.com/api/websockets)

**Birdeye is the strongest documented first candidate for the early-project data layer.** Its engineering guide combines new-listing and new-pair streams with REST recovery and market/security/holder enrichment. Server-side filters help limit unnecessary follow-up requests. That is a documented integration pattern, not a disclosure of Birdeye’s complete internal stack. [Birdeye data-layer guide](https://birdeye.so/data-api/blog/detail/solana-trading-bot-api-data-layer-birdeye)

Its discovery guide makes two useful distinctions: pair events do not include a risk assessment, and the documented new-pair subscription excludes OpenBook. Token-listing coverage and chain support must be checked per endpoint. Several direct API-reference links returned 404 through the research tool, although these official engineering guides were accessible. Validate schemas in a trial before committing. [Birdeye new-token guide](https://birdeye.so/data-api/blog/detail/solana-new-token-sniper-api-birdeye-data)

**GeckoTerminal is a practical broader-market prototype source.** Its public REST API is available without authentication, with a documented free limit of 30 calls per minute. CoinGecko’s new-pools endpoint covers a recent 48-hour window and paginates results. This supports discovery, but does not establish subsecond delivery or unlimited backfill. [GeckoTerminal authentication](https://apiguide.geckoterminal.com/authentication), [rate limits](https://apiguide.geckoterminal.com/faq), [CoinGecko new pools](https://docs.coingecko.com/reference/latest-pools-network)

CoinGecko’s Megafilter also exposes age, liquidity, FDV, holder concentration, and activity criteria. Crucially, it states that its honeypot data is not supported for Solana. An unavailable check must never be shown as passed. [Megafilter documentation](https://docs.coingecko.com/reference/pools-megafilter)

**Axiom and Photon offer useful interaction lessons, without needing to copy their dense trading screens.** Axiom Pulse separates creation, approaching curve completion, and migration. Photon documents comparable filtering and hover-to-pause behavior. For a mobile Soltech feed, I would translate that into stable results and an explicit “new results” control so the list does not shift under someone’s finger. Some Axiom documentation still describes migration to Raydium; that wording should not be generalized to current Pump launches. [Axiom Pulse](https://docs.axiom.trade/axiom/finding-tokens/pulse), [Photon Memescope](https://pies-organization.gitbook.io/photon-trading/photon-on-sol/memescope)

Axiom’s Tweet Monitor, embedded tweet previews, and Similar Tokens are close references for the social journey. Their existence does not reveal how its similarity algorithm works. Its account-customization documentation contains inconsistent wording, so current entitlements need product verification. [Tweet Monitor](https://docs.axiom.trade/tweet-monitor), [tweet previews](https://docs.axiom.trade/twitter-preview-popup), [Similar Tokens](https://docs.axiom.trade/axiom/finding-tokens/similar-tokens)

**GMGN connects social, market, and wallet research.** Its new-pair documentation includes liquidity, age, valuation, holder data, and ownership/security signals. Labels such as insider or sniper are provider classifications, not independently proven identities. [GMGN new pairs](https://docs.gmgn.ai/index/new-pair)

Its developer access has changed: the official announcement now says OpenAPI is available to all users at a default one request per second, without enterprise-grade availability or throughput. The Agent API currently lists Solana, BSC, and Base, with Ethereum integration in progress. Those statements concern the interface, not necessarily every consumer-product capability. [OpenAPI announcement](https://docs.gmgn.ai/index/cooperation-api-data-crawling-ip-whitelist), [Agent API](https://docs.gmgn.ai/index/gmgn-agent-api)

**Social-intelligence services add context, but they solve a different part of the problem.** LunarCrush exposes topics, creators, posts, sentiment, engagement, and market information through documented APIs. It is worth evaluating if Soltech later needs broader social context beyond selected accounts. Its market/social rankings should not become a token-security grade. [LunarCrush developer documentation](https://lunarcrush.com/en/developers), [API reference](https://github.com/lunarcrush/api)

Kaito describes indexing Web3 information and using language models for search and summaries, alongside sentiment and narrative attention metrics. It is a useful research-product reference. Public material did not establish proprietary model details, immediate new-contract coverage, or validated matching accuracy. [Kaito product documentation](https://kaito-ai.gitbook.io/product-docs), [API overview](https://pro.kaito.ai/kaito-api)

Santiment describes collectors, searchable social documents, text matching, and AI entity linking. Its documentation is valuable for the distinction between matching a word and identifying the asset being discussed. Its coverage is curated, not equivalent to every public X post. [Social-data architecture](https://academy.santiment.net/metrics/details/social-data/), [social volume](https://academy.santiment.net/metrics/social-volume/), [AI entity linking](https://academy.santiment.net/metrics/social-volume-ai/)

**Soltech’s Public figure scanner would need two connected systems.** The following is a proposed architecture, not a claim about any competitor’s private implementation:

1. Receive posts from selected public accounts through permitted X access. Keep source identity, post time, detection time, and edit/deletion status.
2. Extract explicit token addresses, links, names, and tickers. Broader text or image interpretation can suggest themes, with uncertainty retained.
3. Search a separate token and launch index. Use chain plus mint address as identity; a name or ticker alone is insufficient.
4. Keep the evidence for each candidate: direct address, corroborated project source, or possible theme connection. Permit multiple candidates instead of silently choosing one.
5. Apply market filters and independent security checks. Social attention does not improve a token’s technical risk classification.
6. Explain why the coin appeared, link its source evidence, and state what is known or missing.

For a hypothetical public post about a blue dog, Soltech might identify several similarly themed coins. The useful message is “Possible connection to this post,” not “This person’s coin.” Search both existing coins and a bounded period of subsequent launches. Keep a post with no supported match as “No related coin found yet,” rather than inventing a result.

**The Early project scanner should follow a launch lifecycle.** A prelaunch announcement may have no token address yet. A created token may already trade on a bonding curve before a DEX pool exists. A later pool may represent migration or another market for an old token. Pump’s current public program documentation describes curve completion followed by migration into PumpSwap. [Pump lifecycle](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md)

Recommended flow: launch/listing/pool event → normalize the token identity → keep distinct milestone times → apply stage-appropriate filters → enrich risk and market data → explain and display the result. Deduplicate multiple pools for the same token while preserving pool-specific liquidity. Treat upcoming announcements separately until on-chain facts exist.

Raydium’s own SDK examples warn that newly created pools can take minutes to appear in its API. That illustrates why a convenient REST response is not necessarily the earliest event source. [Raydium SDK examples](https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/README.md)

**Helius is an alternative or supplement when direct event coverage matters.** Current Parsed Streams documentation describes confirmed transactions decoded and filtered by program, account, and instruction. Unsupported instructions remain available as raw data. This could support launchpad and pool discovery, but coverage must be tested against actual launch events. [Helius Parsed Streams](https://www.helius.dev/docs/parsed-streams)

Its webhook FAQ documents incomplete coverage for the generic mint event, duplicate delivery, and possible loss after retries. A reliable scanner needs durable processing, deduplication, reconnect recovery, backfill, and freshness monitoring. LaserStream offers lower-level streaming and replay, with more client responsibility. Its public pages disagree on replay-window length, so that capability needs confirmation before relying on it. [Webhook limitations](https://www.helius.dev/docs/faqs/webhooks), [LaserStream FAQ](https://www.helius.dev/docs/faqs/laserstream), [delivery guarantees](https://www.helius.dev/docs/laserstream/delivery-guarantees)

**Risk should remain separate from popularity and matching confidence.** RugCheck’s published API exposes reports, risk reasons, scores, LP-lock information, and insider-network endpoints. The full weighting formula and classification accuracy are not established by its schema. Use the underlying reasons and timestamps; do not present its number as a proven probability. [RugCheck API specification](https://api.rugcheck.xyz/swagger/doc.json)

GoPlus has a distinct Solana security endpoint marked Beta. Its response includes mint/freeze controls, transfer fees, transfer hooks, holder information, and liquidity-related fields. The Solana and EVM schemas should not be treated as interchangeable. [GoPlus Solana endpoint](https://docs.gopluslabs.io/reference/solanatokensecurityusingget), [Solana response fields](https://docs.gopluslabs.io/reference/response-detail-1)

Solana’s own documentation establishes why permissions matter: mint authority can create additional supply; freeze authority controls freezing of accounts. Token-2022 can add permanent delegates, fees, and transfer hooks. Removing one authority does not remove every possible control. These are observable mechanics; interpreting them as risk depends on context. [Mint accounts](https://solana.com/docs/tokens/basics/create-mint), [authorities](https://solana.com/docs/tokens/basics/set-authority), [permanent delegate](https://solana.com/docs/tokens/extensions/permanent-delegate), [transfer fees](https://solana.com/docs/tokens/extensions/transfer-fees), [transfer hooks](https://solana.com/docs/tokens/extensions/transfer-hook)

I would retain your green–yellow–red system, with a short reason and a separate gray state:

| Appearance | Meaning to communicate |
|---|---|
| Green | Fewer detected concerns in the checks completed; never a safety guarantee |
| Yellow | One or more concerns need review |
| Red | A serious detected concern; explain the specific mechanism |
| Gray | Not enough information, unsupported checks, or stale/unavailable data |

These are proposed display semantics. The actual rules and thresholds need evaluation. A provider outage must not turn a coin green. Neither should a verified social account, high engagement, a burned LP token, or a successful sale simulation overrule unrelated concerns. Color needs a text label for accessibility.

**Current access costs matter, especially for X.** These are published prices checked on the research date, not a quotation for Soltech.

| Service | Published access or price | Planning implication |
|---|---|---|
| X | Pay-per-use post reads at $0.005; three-million monthly post-read cap before enterprise | 10,000 billable post reads = $50; 100,000 = $500, before other resources and infrastructure |
| Birdeye | Lite $39/month; Starter $99; Premium $199; Business $499 | Premium advertises WebSockets and 20 million monthly compute units; overages and endpoint access affect total cost |
| GeckoTerminal | Public API without authentication; 30 calls/minute documented | Useful for experiments; not a production freshness guarantee |
| Helius Parsed Streams | Available on all plans, including Free; one credit per delivered event | Cost depends on event volume and the chosen plan’s credit allowance |
| LunarCrush | Individual $90/month; Builder $300; Scale $900 on the inspected page | Optional later enrichment; validate endpoint access and rights |

Sources: [X pricing](https://docs.x.com/x-api/getting-started/pricing), [Birdeye pricing](https://birdeye.so/data-api/pricing), [GeckoTerminal limits](https://apiguide.geckoterminal.com/faq), [Helius access](https://www.helius.dev/docs/parsed-streams), [LunarCrush pricing](https://lunarcrush.com/pricing).

X’s Filtered Stream currently documents 1,000 rules, one connection, and approximately four-to-five-second P99 delivery latency for pay-per-use. That is X’s published delivery figure, not a measured Soltech response time. Author-based rules fit the initial public-figure scope better than an unrestricted keyword feed. [X Filtered Stream](https://docs.x.com/x-api/posts/filtered-stream/introduction)

Before launch, verify commercial display/redistribution rights for each provider. X also requires stored and displayed content to reflect removals and changes. Its policy and summary guidelines contain different bulk-export limits, so this research does not establish a right to resell or export collected posts. [X Developer Policy](https://docs.x.com/developer-terms/policy), [Developer Guidelines](https://docs.x.com/developer-guidelines), [compliance events](https://docs.x.com/x-api/compliance/batch-compliance/introduction)

**I would test a small provider combination before building a custom indexer.** Start by evaluating licensed X access, Birdeye discovery/enrichment, and one primary security provider with the other used on an audit sample. Verify important controls directly against chain data. Add Helius event ingestion only where measured discovery or coverage needs justify it. Keep DEX Screener as a useful external reference and GeckoTerminal as a candidate secondary source. This avoids paying for every overlapping service before the product’s needs are known.

The trial should measure:

| Question | Evidence to collect |
|---|---|
| Are social matches believable? | Human-reviewed precision, false associations, and unclear cases, separated by direct versus theme matches |
| How early are launches found? | Canonical event time, provider observation time, Soltech receipt time, and displayed time; median and tail delays |
| What is missed? | Coverage against an explicitly defined launchpad/program sample, including outages |
| Are results trustworthy? | Stale and missing fields, conflicting security findings, explanation accuracy, and duplicate rate |
| Do filters help beginners? | Whether users can explain their choices, recover from zero results, and understand why a coin appeared |
| Is the service affordable? | Actual requests/events, billable resources, enrichment cost, and cost per useful result |

Evaluate with information available at the original detection time. Adding later social activity, supply corrections, or successful outcomes to an earlier snapshot makes a scanner look better in hindsight. Santiment documents point-in-time methods for this reason. [Point-in-time methodology](https://academy.santiment.net/metrics/details/point_in_time/)

**The main assumptions to test are narrow and concrete:** whether the first release is Solana-only; whether users value immediate launches or more established activity; how broad related-theme matches should be; whether the five basic market controls are understandable; and whether the proposed feed costs fit the business. There is no evidence here for a universally safe market-cap range, a guaranteed profitable preset, or a vendor that catches every related coin. Those claims should not appear in Soltech.
