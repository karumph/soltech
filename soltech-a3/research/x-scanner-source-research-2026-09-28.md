# Soltech: public-figure X scanner source research

Research date: September 28, 2026. Research only; no application changes, subscriptions, credentials, payments, authenticated API requests or user-browser interactions. Technical facts below come from X documentation or first-party product documentation. Publicly documented features are not independently tested behavior. Prices and entitlements require confirmation when purchasing.

## Decision

Build the concept around **a post with evidence, followed by possible coin matches**. Reading a selected public account is a conventional data-ingestion problem. Reliably deciding which new meme coins relate to an indirect joke, image or phrase is a separate interpretation problem. The latter needs its own evidence, uncertainty, evaluation and lifecycle.

The closest product references are GMGN for account/post-type selection and contract recognition, Axiom for presenting the original social post alongside token discovery, and TweetShift for simple account-to-feed setup. None of the inspected documentation establishes exhaustive or reliably predictive matching of arbitrary posts to future meme coins. No defensible “absolute best” ranking can be made from marketing and documentation alone.

Recommended first version: selected public accounts, original posts and quotes, exact contract extraction, clearly labeled related-idea candidates, ongoing matching against supported token feeds, and a separate risk assessment. Avoid automatic trading, popularity claims, and predictions of which idea will become a successful coin.

## Verified X capabilities and limits

### 1. Account events: X Activity is a credible ingestion candidate

**Documented:** X Activity supports public `post.create`, `post.delete` and profile-update events for a specified user ID. Public-account events do not need OAuth consent from that target account; protected-account posts are excluded. A creation event includes originals, replies, quotes and reposts by the selected account, so the payload must be classified. Delivery can use a persistent HTTP connection or webhooks. The published self-serve limit is 1,500 subscriptions, compared with 75,000 for Enterprise. These are subscription counts, not guaranteed unique-account counts. [X Activity introduction](https://docs.x.com/x-api/activity/introduction)

The quickstart requires an approved developer app and describes resolving a username to a user ID, creating event subscriptions and receiving events. It explicitly permits an app-only bearer token for public events; private event types require user-context authorization. [X Activity quickstart](https://docs.x.com/x-api/activity/quickstart)

**Unknown:** No live Soltech account entitlement was tested. X describes Activity delivery as sub-second, but that is a vendor claim, not a measured result or end-to-end Soltech SLA. Unlimited replay and reliable edit semantics were not established for this route. Test those before selecting it over Filtered Stream. Public API eligibility does not itself settle whether every proposed commercial use and redistribution pattern is licensed.

### 2. Filtered Stream: rule-based delivery with documented latency

**Documented:** Filtered Stream delivers matching posts over a persistent connection and permits rules to change without reconnecting. X publishes approximately 4–5 seconds P99 delivery latency. Pay-per-use documentation lists 1,000 rules, 1,024 characters per rule and one connection; semantic embedding operators require Enterprise plus an additional tier. Edited posts arrive with edit-history IDs. [Filtered Stream introduction](https://docs.x.com/x-api/posts/filtered-stream/introduction)

**Interpretation:** That latency is X's stated delivery metric, not an independently verified Soltech result or a maximum. Token indexing, enrichment, model processing, queues and client delivery add time. A thousand rules do not equal a thousand Soltech users: shared account watches can serve multiple user configurations, and a rule can combine authors subject to its character limit.

Author, cashtag, hashtag, phrase, URL and conversation operators are documented. Use authors to identify source accounts rather than searching merely for their display names. [Stream operator reference](https://docs.x.com/x-api/posts/filtered-stream/integrate/operators)

An important difference: Filtered Stream can match both a quote's text and the quoted original; Search matches the quoting text, not the quoted original. Rule construction also has accent/case and Boolean semantics that need tests. [Build a rule](https://docs.x.com/x-api/posts/filtered-stream/integrate/build-a-rule)

**Recommendation:** For the “ideas that might inspire coins” requirement, ingest selected accounts' eligible posts before applying semantic filtering. A crypto-keyword-only rule would miss a non-crypto joke or image that later becomes a meme-coin theme.

### 3. Polling, search and recovery

**Documented:** The user-post timeline returns authored content, supports pagination and filtering out replies/reposts, and exposes up to 3,200 recent posts. The request reference supports `since_id` and time ranges. [Timelines](https://docs.x.com/x-api/posts/timelines/introduction), [User posts endpoint](https://docs.x.com/x-api/users/get-posts)

Recent Search covers seven days, up to 100 results/request with a standard 512-character query. Full Archive covers historical posts back to 2006, with paid access, up to 500 results/request and a standard 1,024-character query. [Search introduction](https://docs.x.com/x-api/posts/search/introduction)

Published request limits include 450 recent-search requests per app per 15 minutes and 10,000 user-timeline requests per app per 15 minutes; user-context limits differ. Filtered Stream's table lists 50 connection requests/15 minutes and 250 posts/second. These are request/throughput limits, separate from monthly usage, billing and approved access. [API rate-limit table](https://docs.x.com/x-api/fundamentals/rate-limits)

**Recommendation:** Polling can support an early prototype or reconciliation job, but a chosen polling interval adds delay and is not a delivery guarantee. Persist an acknowledged cursor only after durable processing, paginate gaps, overlap recovery windows and deduplicate. Respect returned rate-limit headers and retry backoff. X itself recommends streaming for real-time use. [Rate-limit guidance](https://docs.x.com/fundamentals/rate-limits)

Stream backfill and replay are Enterprise features in the recovery guide. Search is its proposed alternative where those features are unavailable, but matching differences mean search cannot guarantee reconstruction of the exact stream. [Recovery and redundancy](https://docs.x.com/x-api/fundamentals/recovery-and-redundancy)

### 4. Pricing verified from the public page

The public pricing page currently describes prepaid pay-per-use, with post reads at **$0.005/resource**, user reads at **$0.010/resource**, and a **three-million-post-read monthly cap** before Enterprise. Its webhook table lists `post.create` at $0.005/event and `post.delete` as not billed. Daily resource deduplication is described as a soft guarantee. Spending caps can stop API access. These published rates do not replace a live console quote or account approval. [X pricing](https://docs.x.com/x-api/getting-started/pricing)

**Documentation conflict:** The Activity introduction says every delivered post event, explicitly including `post.delete`, is billed as a Post. That conflicts with the pricing page's deletion row. Confirm actual event billing in the Developer Console or with X before promising deletion-event costs. [Activity billing statement](https://docs.x.com/x-api/activity/introduction)

Illustrative arithmetic only: 10,000 billable post reads at that unit rate cost $50; 100,000 cost $500. This excludes users, profile events, any differently billed resources, chain data, infrastructure and model inference. It is not a Soltech operating-cost estimate. Do not apply the cheaper “owned reads” rate to other people's public accounts.

Powerstream is a lower-latency option on select Enterprise plans. Its inspected page does not establish a concrete latency guarantee or public price. It is not necessary to assume it for a first credible product. [Powerstream](https://docs.x.com/x-api/powerstream/introduction)

## Identity, attribution and post lifecycle

X has separate user IDs and mutable usernames/display names. The API resolves handles to IDs and can retrieve profiles by ID. Store IDs as strings to avoid JavaScript precision loss. Keep handles as display metadata, refresh them, and avoid silently switching the watched identity if a handle resolves differently. That last behavior is a Soltech design recommendation. [User lookup](https://docs.x.com/x-api/users/lookup/introduction), [X IDs](https://docs.x.com/fundamentals/x-ids), [Changing a handle](https://help.x.com/en/managing-your-account/change-x-handle)

The data dictionary documents author IDs, publication time, referenced-post relationships, entities, media metadata and full long-form text. The long-form text field matters: analyzing only a truncated body could lose a contract address or important qualification. A quote/reply/repost is a relationship between posts and authors, not a flat text string. [Data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary)

**Proposed attribution rules:**

| Situation | What Soltech should say | What it should avoid |
|---|---|---|
| Selected account posts an address in its own text | “Address included in the post” | “Official coin” or “safe” |
| Selected account quotes another user's coin post | “Quoted a post mentioning this coin” | Assigning the quoted author's words to the selected account |
| Selected account replies to a coin post | “Replied in this conversation” plus its actual reply | Treating a reply as endorsement |
| Selected account reposts a coin post | “Reposted this” | A duplicate original mention |
| Post and token share an image/phrase | “Possible theme match” with the specific evidence | Claiming ownership, affiliation or causation |
| Only the coin's own metadata links the public figure | “Project links to this post” | Implying the figure linked to the coin |

An exact address establishes a precise token reference, not trustworthy intent. The post may be a warning, a denial, a quotation or a compromised-account post. Candidate ranking should reflect these distinctions and be allowed to abstain.

X's edit model gives each revision a new post ID and connects revisions through edit-history metadata. Group revisions and re-evaluate changed meaning; do not create a fresh “discovery” alert for every cosmetic edit. [Edit posts](https://docs.x.com/x-api/fundamentals/edit-posts)

Batch Compliance can identify deleted/protected/deactivated/suspended content and changes requiring a fresh fetch. [Batch Compliance](https://docs.x.com/x-api/compliance/batch-compliance/introduction)

## What existing products demonstrate

| Product | First-party evidence inspected | Useful lesson; limits of evidence |
|---|---|---|
| GMGN X Tracker | Selected/curated accounts; originals, replies, reposts, quotes and bio updates; a contract-only filter; token quick-buy UI. Documentation says 2,000+ curated accounts and five custom accounts outside its Top Subscriptions list. [X Tracker](https://docs.gmgn.ai/index/x-tracker) | A compact account list and explicit post-type filters are credible. Contract extraction is different from finding arbitrary thematic matches. Millisecond/return language is unverified marketing; private architecture is not disclosed. |
| Axiom | Tweet Monitor, a custom-account section and notifications; tweet previews integrated into Pulse. [Tweet Monitor](https://docs.axiom.trade/tweet-monitor), [Twitter Preview](https://docs.axiom.trade/twitter-preview-popup) | Source-post previews beside tokens reduce context switching. The monitor page is inconsistent: it both advertises forthcoming customization and shows a custom tracker. It states a five-SOL trading-volume access condition; not tested in a live account. |
| Axiom Similar Tokens | A page for related-token discovery with an older/high-market-cap “OG” option. [Similar Tokens](https://docs.axiom.trade/axiom/finding-tokens/similar-tokens) | A name/theme can have several candidates. Its documentation does not disclose similarity logic, accuracy or full universe coverage. |
| TweetShift | Account-to-Discord feeds, keyword filters, account setup and a repost option. [Home](https://tweetshift.com/), [Setup](https://help.tweetshift.com/setup), [Filters](https://help.tweetshift.com/filters) | A useful beginner reference for “choose an account; choose what to receive.” It is a delivery/filter product, not documented token matching or risk analysis. |
| TweetShift plans | Published table advertises Premium $2.99/month and Pro $9.99/month, with about one-minute and 5–10-second delivery respectively; explicitly best-effort. [Plans](https://help.tweetshift.com/premium) | Do not treat this as a verified current quote/SLA. The same page retains 2025 availability language and contradicts the homepage's free-feed emphasis. No purchase/account inspection was performed. |
| Kaito | Search, keyword/topic/event alerts, sentiment, narrative mindshare and summaries. [Kaito Pro](https://pro.kaito.ai/portal) | A reference for explaining narrative context; not evidence of immediate coverage of every new token or future-launch prediction. |
| LunarCrush | APIs for posts, creators, topics, sentiment, engagements and market data. [Developer documentation](https://lunarcrush.com/en/developers) | Potential enrichment; social intensity must remain separate from token risk. Public documentation alone does not establish suitability for earliest launch detection. |
| Santiment | Its AI social-volume metric links text to assets with named-entity recognition and entity linking. [Social Volume AI](https://academy.santiment.net/metrics/social-volume-ai/) | Evidence that semantic asset linking is a distinct processing layer. It is not proof that Soltech can infer new meme contracts with the same performance. |

## Minimal credible Soltech pipeline — recommendations

These are proposed design and engineering decisions, not claims about competitors' private code.

1. **Account selection.** Let a beginner select a small starter list or add an account. Confirm the returned profile. Store the account ID, source and selection provenance; show the current handle. Do not require connecting the user's own X account solely for supported public reads.
2. **Shared public-post ingestion.** Evaluate X Activity first for straightforward account events; compare it with Filtered Stream in a limited authorized trial. One ingestion service can route relevant events to many Soltech scanners. Do not allocate a new provider connection per end user.
3. **Durable event queue.** Record receipt time, provider, event type and identifiers. Make processing idempotent. Maintain monitoring status separately from an empty results list so an outage cannot masquerade as “nothing found.”
4. **Normalize context.** Resolve post type, author, quoted/replied-to content and current revision. Extract full available text and approved media metadata. Treat source content as data, never as instructions for an AI model. Keep cited source evidence separate from generated summaries.
5. **Direct reference path.** Extract candidate addresses and known token URLs without a language model. Check candidate addresses against the supported chain's token records. Resolve names/cashtags to a list of candidates; do not guess one contract when there are several. A ticker is not a unique identity.
6. **Related-idea path.** Generate a small structured set of phrases, entities and optional image-derived concepts. Retain the exact evidence spans or media reference behind each idea. Use lexical matching plus semantic retrieval to obtain candidates from the token index. A model can explain a proposed relation; it cannot establish that a token exists without chain/index evidence.
7. **Time-aware matching.** A coin might exist before the post or launch later. First match against existing supported tokens, then temporarily retain an eligible idea and re-evaluate it as new token events arrive. Use a bounded, visible watch window and budget; deduplicate repeated candidate matches. Set expiry based on measured usefulness and cost, not an invented universal window. Show “No matching coin yet” while watching, then “Watch ended”; never invent a coin to fill the screen.
8. **Separate relation from risk.** Store relation evidence independently of liquidity, ownership or contract checks. A strong thematic match can have high risk; missing risk data is “Unknown,” not low risk. A model's self-assigned percentage is not calibrated probability.
9. **Explain and route.** A result should show the source post, match reason, relevant token identity, current risk state and data freshness. Acknowledge when a token predates the post. Keep unsupported languages/images explicit instead of silently claiming full coverage.
10. **Corrections and lifecycle.** Recheck edits/deletions, invalidate outdated explanations, cancel a watch when appropriate, and show clear connection/coverage status. Persist users' configurations separately from deletable source content.

### Beginner defaults

- One choice for people to watch; one optional setting for “Direct mentions” versus “Mentions and related ideas.” Explain that related ideas are potential connections.
- Original posts and quote posts on. Reposts off to reduce repeated material. Replies available under advanced options, with context retrieval. These are hypotheses to test, not universally correct defaults.
- Result labels: **Direct reference**, **Possible connection**, **Unclear**. Risk uses the separately agreed green/yellow/red/unknown system.
- No alert merely because an account posted. Surface supported coin matches; let users inspect unmatched ideas if useful without flooding the main results.
- Summary structure: “This appeared because…”, “Connection…”, “Risk…”. Keep source links visible.
- A notification is optional. No automatic purchases, fabricated urgency or claims that a famous name makes a coin safer.

## Retention and use restrictions that affect architecture

X's policy requires current displayed content and deletion/modification of stored content as soon as reasonably possible, including within 24 hours after an X/account-owner request. It also restricts redistribution and off-X identity matching. The applicable agreement must be checked before offering bulk downloads, reselling content or joining personal identities to off-platform records. [Developer Policy](https://docs.x.com/developer-terms/policy)

The guidelines prohibit unauthorized model training and sensitive personal inference. A licensed inference/analytics workflow is a different question from retaining a corpus to train a model. Soltech should analyze public coin-related content and token relationships, not private identity, location, political-belief or financial-status profiles. [Developer Guidelines](https://docs.x.com/developer-guidelines)

The current public documents are inconsistent on hydrated-content redistribution: the policy states 500 objects/person/day via nonautomated export, while the guideline summary states 50,000/recipient/day. Do not convert either into a product promise until X confirms the applicable terms. Public API functionality is not a blanket license.

## What must be tested before promising a working scanner

| Question | Evidence needed |
|---|---|
| Can the chosen Soltech app receive the required events? | Approved live entitlement test, not only documentation |
| How quickly do useful results arrive? | Separate post-to-receipt, receipt-to-match and match-to-display timing; do not conflate vendor P99 with a Soltech SLA |
| Does account selection remain correct? | Rename, lookalike, quote, reply and repost cases; selected author ID remains authoritative |
| Are direct matches accurate? | Manually labeled address/name cases, including negation, warnings and ambiguous tickers |
| Are idea matches useful? | Human-labeled relevance, false-positive rate, abstentions and missed candidates by language/media type |
| Does matching work after the post? | Token launches later in the watch window; expired ideas; earlier same-name tokens; changed metadata |
| Can it recover? | Stream disconnects, pagination, duplicate delivery, rate limits, spending caps and unavailable source posts |
| Are summaries grounded? | Every asserted relation traced to source evidence; unsupported affiliation and endorsement claims rejected |
| What does it cost? | Billable resources and model/index requests per account and per useful match, measured over representative activity |

Defensible language now: “Watches selected public accounts and looks for coin mentions and possible related tokens within supported sources.” Avoid “all coins,” “instant,” “guaranteed early,” “official,” “safe,” “predicts the next meme coin,” or performance percentages until corresponding coverage and tests justify them.

## Research limits

All links were researched on September 28, 2026. No paid/private competitor implementation was inspected; exact internals remain unknown. TweetShift help pages were partially empty when opened directly, but their first-party indexed content was readable; stale wording is explicitly flagged above. No API delivery, billable charge, eligibility, semantic accuracy or trading result was tested. The report proposes a credible development path, not a claim that scanning is implemented in Soltech.
