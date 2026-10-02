# Soltech: product and design research
September 26, 2026 · Research and recommendations, not measured product results

## The recommendation

Build Soltech around one useful outcome: **find something relevant, understand why it appeared, and know what remains uncertain.** Make that process pleasant, fast, and easy to revisit.

The strongest direction is a personal discovery workspace with recognizable scanners and short, inspectable coin reports. The logo-based identity can give it character. Reliable sources, clear matching, good explanations, and preserved work must provide the reason to return.

I treated “younger audience” as **adults roughly 18–34**, with beginner and experienced users considered separately. This is a working assumption, not a proven audience definition. None of the research establishes that this age group universally prefers a particular palette or visual style.

## Why some products succeed—and what this research can establish

A visual design cannot explain commercial success by itself. Product usefulness, data quality, reliability, acquisition, pricing, community, and market conditions can all matter. Public competitor interfaces show patterns; they do not reveal the causal contribution of those patterns to growth.

For Soltech, I would evaluate five layers:

| Layer | Question to answer | What would count as evidence |
|---|---|---|
| Value | Does this reduce the effort of finding and understanding relevant coins? | People complete a real research task more accurately or with less effort. |
| Comprehension | Do people understand the source, match, and uncertainty? | They explain a finding correctly without prompting. |
| Control | Can they shape a scanner and resume work? | Successful editing, recovery, and reopening with few errors. |
| Experience | Is using it clear, pleasant, and responsive? | Task observations plus separate clarity and appeal ratings. |
| Return value | Is there useful new information when they return? | Cohort-based meaningful review, linked to actual new findings. |

These are proposed evaluation criteria. They are not claims about the current prototype.

## What the audience evidence says

### Curiosity is an opportunity; social discovery is not blind trust

FINRA Foundation and CFA Institute surveyed 2,872 adults across four countries in late 2022. Among the U.S. investors aged 18–25, 65% identified curiosity as a major reason to start investing and 48% used social media to learn about financial topics. Family ranked above social media for trust, and clear explanations were valued. The online recruitment, self-reporting, and investor quotas limit generalization; this is not a study of all young crypto users or of Soltech.

**Implication:** invite exploration, make the underlying explanation easy to inspect, and avoid using an influencer’s prominence as a substitute for evidence. [Gen Z and Investing, 2023](https://www.finrafoundation.org/sites/finrafoundation/files/Gen-Z-and-Investing.pdf)

FCA’s 2025 UK crypto survey also documents reliance on forums, personal connections, and social media. Its research-source figures cover buyers of all ages, so they should not be presented as specific findings about young meme-coin users.

**Implication:** an inspectable chain from original post to possible match to token identity could distinguish Soltech. This is a product hypothesis, not an outcome proved by that survey. [Cryptoassets Consumer Research 2025](https://www.fca.org.uk/publication/research-notes/cryptoasset-consumer-research-2025-wave-6.pdf)

### Confidence and experience vary within the audience

Pew’s February 2024 survey of 10,133 U.S. adults found substantial skepticism about crypto’s safety and reliability, including among people who had used it. That broad attitude survey does not describe current meme-coin traders specifically.

**Implication:** design for curious but uncertain adults as well as confident users. Everyday language, readable explanations, and optional depth are more defensible starting points than assuming everyone wants a specialist trading terminal. [Pew Research Center, 2024](https://www.pewresearch.org/short-reads/2024/10/24/majority-of-americans-arent-confident-in-the-safety-and-reliability-of-cryptocurrency/)

### Concrete explanations matter more than repeating a disclaimer

An FCA randomized study with 14,250 completed participants tested investment-promotion mockups. Behaviorally informed warnings improved correct risk-comprehension responses by approximately 6–10 percentage points. Making a standard warning more prominent without changing its content did not improve average comprehension in the crypto branch. These were simulated browsing tasks, not long-term financial outcomes.

**Implication:** keep a specific concern beside each coin. Test whether users understand “Lower risk” and “Not assessed”; a green label or a large disclaimer is not evidence of understanding. [Going beyond “capital at risk,” 2022](https://www.fca.org.uk/publication/research/behaviourally-informed-risk-warnings.pdf)

A separate FCA experiment with 10,817 participants found that hypothetical information about crypto regulation could increase demand while misunderstandings about protections remained. It did not test Soltech badges.

**Implication by analogy:** keep assurances narrow. “Address matched” should not imply “project verified,” and “checks completed” should not imply “safe.” [Cryptoasset Regulation and Consumer Decision-Making, 2025](https://www.fca.org.uk/publication/research-notes/regulation-consumer-decision-making-evidence-online-experiment.pdf)

## How to make Soltech enjoyable

### Give the identity a useful role

The implemented design uses the existing logo’s contrast and facets: white content, dark typography, silver glass controls, and blue/lilac scanner categories. The category marks help distinguish scanners; the glass selection shows location; the New count communicates unread information.

This palette is an art-direction decision, not a finding about generational taste. In a two-week experiment with 60 mobile-phone users, the initial effect of attractive appearance on perceived usability weakened with repeated exposure. Older devices and the small sample limit transfer, but the study supports evaluating repeated use as well as first impressions. [Sonderegger and colleagues, 2012](https://folia.unifr.ch/unifr/documents/303010)

For Soltech, enjoyment should come from a responsive control, a useful explanation, a scanner that feels personal, and being able to leave and resume confidently. The following ideas remain proposals unless already implemented:

- Keep names and categories recognizable across Find, Active, Saved, and coin details.
- Celebrate successful configuration with a clear confirmation, rather than a trading reward.
- Make an unread count clear predictably after a coin is opened.
- Keep short summaries readable and deeper evidence one step away.
- Let users change their mind without losing a draft or a saved scanner.

### Teach concepts at the moment they matter

Progressive disclosure is useful when the primary controls remain obvious and specialized controls are secondary. It fails when it hides information required to make the current decision. [Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)

That distinction guides the current editor: scanner type, source accounts or launch stage first; optional numeric and technical controls in expandable groups. Account readiness remains visible. Empty numeric fields mean No limit, not an undisclosed protective default.

Mandatory onboarding is not automatically beneficial. A randomized study of over 45,000 players across three games found tutorial benefits varied by game; the more complex Foldit showed gains in play time and progress without a significant return-rate improvement. This is evidence about those games, not a conversion forecast for Soltech. [Andersen and colleagues, CHI 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf)

**Recommendation:** first test a short path into a scanner and an example report. Add contextual help where observed confusion occurs, rather than requiring a tour before the user sees any value.

### Avoid confusing frequent activity with success

In an FCA randomized simulated-trading experiment with 9,140 completed responses, frequent price notifications and prize-linked points increased trading activity and risk-taking. That experiment did not test a factual unread count such as 2 new, and it does not establish long-term effects for Soltech.

**Recommendation:** retain useful unread state. Do not add manufactured urgency, profit leaderboards, rewards for trading, or repetitive alerts to create return visits. Any future alert should correspond to a meaningful event the user chose to follow. [FCA trading-app experiment, 2024](https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf)

## What to learn from existing products

These are documented interface patterns, not evidence that the pattern caused the company’s success. I did not log into or benchmark paid competitor accounts.

| Reference | Observed/documented pattern | Translation for Soltech |
|---|---|---|
| Phantom | Categories lead to tokens and token details; followed categories are easy to revisit. | A clear path from scanner → finding → overview → return. Keep Soltech’s narrower scope. |
| GMGN X Tracker | Curated or personal account lists, post-type selection, and an address-only filter. | Make monitored sources explicit. Separate direct token references from inferred themes. |
| DEX Screener | Public navigation exposes Watchlist, New Pairs, filters, time windows, and market measures. | Support discovery and personal organization, while keeping expert density optional. |

Sources: [Phantom Explore documentation](https://help.phantom.com/articles/41523165147667), [GMGN X Tracker documentation](https://docs.gmgn.ai/index/x-tracker), [DEX Screener public interface](https://dexscreener.com/).

For Soltech specifically, keep **Active / Find / Saved** for now. The current new-find workflow gives Active a clear job. Add a combined feed only if users with multiple scanners struggle to review results efficiently. A Profile tab needs an account-related task; it does not solve the current information-structure problem.

## The product decisions that matter next

### Public figure scanner

Before live implementation, define three separate concepts:

1. **Source identity:** the monitored account and original post.
2. **Match evidence:** an exact address/link, or a possible thematic relationship.
3. **Coin risk and data coverage:** the checks performed, concerns found, and missing information.

A theme match is not an endorsement. A token using a person’s name is not necessarily associated with them. The future report should show the actual source, timestamp, token identity, and reason for the connection. Avoid numerical confidence until it is calibrated against reviewed examples.

The difficult work is proving relevant matching with acceptable false positives. A broad claim to find every related coin would exceed what a limited data source can establish.

### Early project scanner

Define early using launch stage and clearly named age measurements. Token creation, first trading, and a new pool are different events. Keep liquidity separate from market cap, and distinguish real launchpad reserves from DEX liquidity. These distinctions are already represented in the UI controls; their data coverage still needs verification.

When live data is considered, evaluate missed launches, duplicate pairs, unsupported venues, and delays. A quiet scanner can mean no match, stale data, or missing coverage. Those states must not share one empty screen.

### Risk presentation

Keep a short reason visible. High-risk exclusions should remain discoverable through their count. Unknown should remain its own state. Before a live release, test whether users infer that the remaining coins are “good” or guaranteed safe; the current filtering approach cannot establish that.

Use exact coin identity when combining results. A shared ticker is insufficient. Define whether a new finding means a newly found coin or a material update to an existing coin; the current prototype implements unopened sample coins per scanner.

### Reliability and access

Small delay studies support checking response experience, but do not provide a universal acceptable wait or a guaranteed conversion effect. A controlled study of 30 adults found its longest mobile-search delay harmed experience ratings; lower-delay differences were not significant. [Arapakis and colleagues, 2021](https://arxiv.org/pdf/2101.09086)

Test on slower networks and ordinary phones. Preserve draft state, show honest loading/error status, and optimize the existing logo delivery without changing its appearance. Measure real performance before setting promises.

Use WCAG 2.2 AA as a target: keyboard access, focus visibility, contrast, reflow, and usable targets. AA target size is 24×24 CSS pixels with exceptions; 44×44 is the enhanced AAA criterion and a useful comfortable-touch goal. This is a standard, not a claim of revenue uplift. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## What to measure

The HEART framework maps product goals to user-centered signals and metrics. It cautions against treating page views or active-user totals as sufficient evidence of UX improvement; extra activity can reflect confusion or market events. [Rodden, Hutchinson and Fu, CHI 2010](https://research.google.com/pubs/archive/36299.pdf)

The following are proposed Soltech measures, not installed analytics or measured results:

| Goal | Proposed measure | Guardrail |
|---|---|---|
| First value | Select a suitable scanner and interpret one finding without assistance | Correctly identify sample/live state, association, and uncertainty. |
| Easy configuration | Unassisted save/edit completion, input errors, recovery success | Optional controls remain findable and drafts survive navigation. |
| Useful review | Open a relevant finding and inspect its supporting evidence | Opens are a proxy, not proof of comprehension. |
| Return value | Activated cohorts returning for meaningful review in weeks two and four | Separate audience experience, acquisition source, and market events. |
| Enjoyment | Short ease, clarity, and appeal ratings plus an open-ended question | Revisit after repeated use; do not rely on first impressions alone. |
| Matching quality | Human-reviewed relevance, false associations, duplicates, and coverage | Do not present popularity or engagement as proof of accuracy. |

Do not optimize for session length: an efficient app may help someone finish sooner. Do not call higher opens a win if misunderstanding rises. Production experiments should predefine the primary measure, minimum worthwhile difference, sample size, and stopping rule. Current fictional data can validate usability, not finding-driven retention.

## A practical next research round

Recruit a small formative group, for example six crypto beginners and four more experienced adults. This is a practical starting plan, not a statistically representative sample or a magic required number. Include varied phones and accessibility needs.

Ask each person to:
1. Explain what Soltech does after viewing the first screen.
2. Choose the scanner that fits a stated need.
3. Open a finding and explain why it appeared.
4. Distinguish a direct mention, possible theme match, and endorsement.
5. Explain Not assessed and find the excluded-risk explanation.
6. Customize one filter, leave, locate the draft, and finish it.
7. Explain the relationship between Active and Saved, then find a scanner again.

Record task completion, mistakes, assistance, and their own explanation. Ask about visual appeal separately. Repeat a few tasks after several days to reduce novelty bias. Do not involve real-money transactions.

Test the current design against the previous appearance only with equivalent tasks, content, and behavior. Otherwise a preference may come from the improved flow rather than the colors. Counterbalance presentation order.

## Priorities and scope

**Implemented in the UI:** shared logo-based identity; per-scanner unread findings; clearer Active/Saved status; grouped customization; source-setup guidance; recovery/copy fixes; keyboard and accessible-name improvements.

**Next to validate:** comprehension, actual audience fit, whether the category identity is appealing, the meaning of New, discoverability of optional controls, and whether Saved feels redundant.

**Before building live scanning:** source access and coverage, matching quality, exact token identity, freshness/error states, risk methodology and missing-data handling, and user-approved persistence/notification behavior.

**Keep out of the current scope:** trading, wallet connections, an influencer marketplace without real creators, fabricated popularity, forced profile setup, and extra feeds without an observed need.

The current redesign is ready for review. The largest remaining uncertainty is whether Soltech can consistently surface relevant, explainable findings. Visual polish helps present that value; it does not replace it.

