# One customizable scanner for Soltech

Research and local prototype, September 28, 2026. This supersedes the earlier plan to make users create and manage multiple scanners. The existing app theme stays; the experimental redesign remains separate.

**Superseded setup recommendation:** The preset-first recommendation and setup flow below are preserved as historical context. The current direction is one default Soltech scanner immediately, with optional Customize and no required preset choice. Check remains first in the approved navigation. See [the default-scanner research addendum](default-scanner-2026-09-28.md) for the updated decision, J7 evidence and outstanding source work.

## Recommendation

Use one personal scanner with a combined **Finds** feed. Let people choose **X mentions**, **New launches**, or **X + new launches** as a starting point, then adjust sources and rules. Keep Check, Finds, Scanner, and Profile as the four primary destinations.

This is a product recommendation based on the user's goals and documented competitor patterns. The research does not establish that one scanner universally performs better than multiple scanners, or that any set of filters produces profitable or safe coins. Test comprehension with beginners before treating the flow as settled.

## What established tools document

| Source | Verified pattern | Useful lesson for Soltech |
| --- | --- | --- |
| [GMGN X Tracker](https://docs.gmgn.ai/index/x-tracker) | Users choose accounts separately from event types such as posts, replies, reposts and quotes. Its CA/Token option limits the feed to posts containing contract addresses. | Explain both **who is watched** and **what counts as a match**. A direct address reference should be distinct from a possible thematic connection. |
| [Axiom Pulse](https://docs.axiom.trade/axiom/finding-tokens/pulse) | Launch discovery is organized by lifecycle stage: new creations, approaching migration, and migrated tokens. Separate filters include age, holders, liquidity, volume, market cap, transactions and wallet concentration. | Age and launch stage are different concepts. Show source choices first and numeric limits afterward. Do not copy competitors' promotional claims or assume their thresholds are proven. |
| [GMGN Signals](https://docs.gmgn.ai/index/alert-sniper-new-following-limit-orders) | Its documentation groups different signal types and offers filtering of those events. | A feed can combine several sources while retaining a visible reason for each event. Different event types need their own settings. |
| [X: matching posts to rules](https://docs.x.com/x-api/posts/filtered-stream/integrate/matching-returned-tweets) | Multiple rules can share one stream. Returned posts identify matching rules; a post matching several rules is delivered once with the matching metadata. | One user-facing scanner need not mean one simplistic backend rule. Preserve the evidence for every match. |

[X's rule-building guide](https://docs.x.com/x-api/posts/filtered-stream/integrate/build-a-rule) documents AND, OR and grouping. That supports an explicit matching model, but it does not supply Soltech's token resolution, market filters or risk evaluation. Public documentation was reviewed; these findings are not a logged-in usability test, a latency benchmark, or a reverse engineering of proprietary systems. Documentation describes features, not independent evidence of accuracy or retention.

## How the single scanner should work

Sources are alternatives: a find may qualify through X **or** new launches **or** market data. Within each source, its applicable rules must all pass. Multiple selected accounts are alternatives; the same post cannot come from every account.

Example: watch selected X accounts without a token-age limit, and also watch launches under six hours old. The six-hour launch rule must not hide an older coin mentioned by one of those accounts. Each source therefore retains its own age, liquidity, activity and risk preferences.

Presets change which sources are enabled. They keep entered accounts and filters so switching a preset cannot silently erase custom work. The initial launch-age value is a transparent product default of 24 hours, not a research-backed optimum. Direct mentions are the initial X matching mode. There is no invented preset described as safe, profitable, or best performing.

Market data is available as a third source in customization. It means provider-indexed coins that meet chosen filters, not a guarantee that every coin on every chain is covered. Before live scanning, network scope and actual provider coverage must be explicit.

## Setup flow now implemented

1. **Sources:** choose a preset or enable sources individually.
2. **Set up:** handle one related group at a time. X asks for accounts; New coins defines age and launch stage; Market data starts with market limits. Combined sources receive separate setup screens.
3. **Filters:** defaults are available immediately; detailed controls are expandable and scoped to the selected source.
4. **Review:** name and icon, source summaries, and all chosen rules. Save setup is distinct from starting monitoring.

Finds is a separate, honestly empty destination while monitoring is unconnected. It explains what future findings will contain without displaying fictional matches. Profile retains earlier scanners and drafts under Previous setups, with an explicit way to copy one source's rules into the new setup. Existing records are not deleted or silently activated.

The new scanner has independent local storage, draft recovery, validation, write-failure handling and cross-tab conflict protection. Conflicting local work can be downloaded before loading the saved version. Saving the scanner does not change the profile or existing legacy workspace.

## What each real find should contain next

- Coin identity: network plus contract address, name and logo when available.
- The original post, launch event or market observation, and its time.
- A brief reason it matched this user's rules.
- Direct reference or possible connection, clearly distinguished.
- Risk signals, unavailable checks, source names and freshness.

Deduplicate coins by **network + contract address**, retaining all matching evidence. X's post deduplication alone does not deduplicate coins. A theme such as an animal name can match unrelated tokens; never imply that a public figure endorses a coin based on resemblance alone. Later launches may need bounded rechecking after the original post.

An empty feed should distinguish no matches from an unavailable source. Failed risk checks must not become a green pass. Missing numeric fields need an explicit matching policy before the backend applies filters; they should not silently become zero or pass a configured minimum.

## Backend work still required

The local prototype saves configuration only. It does not request X data, monitor new launches, execute these rules, deliver alerts or claim live findings. The existing coin checker remains a separate live lookup feature.

The next implementation milestone should be narrow and verifiable: ingest direct address mentions from a small chosen account list, resolve the exact network and coin, apply documented filters, and emit a find with source evidence. Add launch events next, then deduplication across both sources. Add thematic matching only after direct matches can be tested reliably.

Separate adapters for X, launches and market data can feed a common event model. Resolve identity before enriching market and risk details. Record configuration version, provider timestamps and match reasons so changing settings has explainable effects. Persist monitoring on a server; closing a phone browser must not terminate a promised live scanner. Add retries, stale-source status, usage limits and deletion/compliance handling before broad launch.

Access, billing, licensing, rate limits and observed completeness need a real provider trial. None was enabled or purchased for this UI transition. “One big scanner” is a simple user model, not a claim of unlimited coverage.

## Beginner validation

Ask a beginner to choose accounts, combine launches, explain which coins could appear, change only one source's age limit, and return to a saved setup. Success means they can explain the result without being taught Boolean logic. Also test the distinction between saved setup, live monitoring and no findings. Avoid adding more controls until those tasks are understandable.

In the next session, walk through the combined preset with the user. Then agree on the first live source and its coverage before connecting monitoring.
