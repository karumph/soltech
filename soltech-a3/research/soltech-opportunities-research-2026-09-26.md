# Soltech: opportunities worth testing

September 26, 2026 · Decision research for adult crypto beginners

This extends `soltech-product-design-research-2026-09-26.md`. The working product brief is a manual coin checker using live sources, with automated scanners still presented as fictional previews. This research does not certify the checker’s runtime coverage. It proposes product decisions and experiments; no product files were changed.

## The decision I would make

Concentrate Soltech on this job: **“I found a coin somewhere. Help me confirm which token it is, understand the available evidence, and remember what I still need to check.”**

That is a narrower, testable promise than finding the best coins or predicting safety. A first-time visitor can bring an existing question, receive useful information, and leave without creating an account or configuring automation. Scanners can later supply additional candidates to the same research workflow.

The strongest next investment is a clear, dated check with exact identity and visible gaps. The most promising subsequent experiment is comparison with the user’s previous check. The most distinctive longer-term connection is tracing a public mention to a specific token while stating when no connection has been established.

These ideas are distinctive directions for Soltech, not claims of category novelty. The unresolved commercial question is whether people find the work important and repeated enough to prefer Soltech over their existing combination of wallet, explorer, screener, and search.

## What the new evidence adds

### Identity is a separate problem from risk

Solana’s documentation defines a token by its mint account/address, while token accounts hold balances for that mint. Its metadata documentation separately describes name, symbol, URI, and update authority. A familiar image or ticker is therefore not a reliable record key. This is a technical property, not a usability experiment. [Solana mint documentation](https://solana.com/docs/tokens/basics/create-mint), [token/account distinctions](https://solana.com/docs/tokens), [metadata](https://solana.com/docs/tokens/extensions/metadata)

Phantom documents impersonation tokens copying names, tickers, logos, or branding. It also distinguishes recognition by its data providers from safety, and explicitly says lack of verification does not necessarily mean maliciousness. This is first-party product/security guidance, not a prevalence estimate. [Common token scams](https://help.phantom.com/articles/37418827844755), [verification meaning](https://help.phantom.com/articles/38425812822419)

A USENIX Security 2025 measurement study found extensive address-poisoning activity on Ethereum and BSC during July 2022–June 2024. It concerns lookalike recipient addresses and transfers, not Solana mint selection. The defensible transfer is limited: visual familiarity and abbreviated addresses can be inadequate for identity tasks. It does not establish how often Soltech users select a spoof token. [Tsuchiya and colleagues](https://www.usenix.org/system/files/usenixsecurity25-tsuchiya.pdf)

### Knowing that risk exists does not establish an effective response

A 2024 study combined 14 DeFi-user interviews with a survey of 493 users. It documented mismatches between feared threats and chosen protections, including beliefs that two-factor authentication could mitigate rug pulls or contract exploits. Recruitment and incident histories were self-reported; interviews deliberately included victims, and the sample was not representative of adult beginners. The authors also acknowledge that they did not measure victims’ net returns. Do not diagnose users as reckless or addicted from these findings. [Liu and colleagues, methods and limitations](https://www.usenix.org/system/files/usenixsecurity24-liu-mingyi.pdf)

The product implication is to explain the scope of a check: identifying a mint, assessing an authority, evaluating a website, and inspecting a transaction are different tasks. A coin report cannot silently stand in for all of them.

### A polished explanation can create misplaced confidence

A mixed-methods study of two AI-assisted prediction tasks found that explanation types affected reliance differently; the tested feature explanations could increase overreliance when the AI was wrong. This is adjacent evidence, not a crypto study or proof that all explanations fail. It argues for testing whether users can notice an unsupported conclusion rather than measuring whether they simply trust the page more. [Chen and colleagues, 2023](https://www.microsoft.com/en-us/research/publication/understanding-the-role-of-human-intuition-on-reliance-in-human-ai-decision-making-with-explanations/)

For Soltech, a fluent AI summary should never substitute for source-backed facts. If a summary is introduced, separate observed fields from interpretation and test its mistakes deliberately.

### Coverage and popularity are not quality guarantees

DEX Screener’s API schema permits missing or null market fields, including liquidity, market capitalization, and pair creation time. Its documentation is not a guarantee that every underlying observation is current when fetched. Separately, DEX Screener sells boosts that temporarily affect Trending Score. Neither a missing field nor paid visibility alone determines whether a token is malicious. [API reference](https://docs.dexscreener.com/api/reference), [boosting documentation](https://docs.dexscreener.com/boosting)

The opportunity is not adding more numbers. It is making the meaning, source, coverage, and comparability of the numbers easier to understand.

## Four ranked hypotheses

The ranking balances user value, uncertainty, implementation burden, and the current manual-checker scope. It is judgment, not a scoring model validated against customer demand.

| Rank | Hypothesis | Tier | Why this order |
|---|---|---|---|
| 1 | A dated, inspectable check reduces identity and coverage mistakes | Now | Foundational to any live report; usable without automation |
| 2 | Showing meaningful changes makes rechecking worth doing | Test | Natural repeat task, but repeated need remains unproven |
| 3 | A short research trail makes manual checks and scanner findings feel connected | Test | Preserves work; can be tested without new data ingestion |
| 4 | A source-to-token comparison answers a question generic risk dashboards miss | Later, test manually first | Strong fit with Public figure concept; matching and source access are difficult |

### 1. Give each lookup a dated, inspectable check

**Hypothesis:** Beginners make fewer consequential interpretation errors when a result answers four questions in a consistent order: which token, what was observed, what the observations mean, and what was not checked.

The first screen of the result should show the network and exact mint, recognizable metadata, and a copy action. Keep the full identifier accessible without relying on first/last characters. If the user provided a pool or token-account address, either explain its verified relationship to the mint or ask for the mint; do not silently reinterpret an unrecognized input.

Below that, give each conclusion a concrete reason and source. Distinguish provider retrieval time from an underlying observation time. Use separate states for no market found, unsupported data, provider failure, and a completed check with no flagged finding. An unknown result is useful when its boundary is clear.

**Experiment:** Use prepared cases with duplicate names, unavailable liquidity, mismatched metadata, and one failed provider. Compare the current result against the proposed structure in counterbalanced sessions with adult beginners. Ask participants to identify the exact token, explain the main concern, and name one unanswered question. Record mistaken reassurance as well as task completion and time.

**Decision gate:** If people still equate a successful lookup or recognized identity with safety, revise the language and hierarchy before expanding coverage. Do not declare success from attractive ratings alone.

### 2. Test “What changed since my last check?”

**Hypothesis:** A concise comparison is more useful for repeat research than returning to an apparently fresh version of the same report.

Begin with an optional local snapshot and an explicit Recheck action. Compare a small, documented set of fields only when they concern the same network, mint, provider, and measurement definition. A changed pool selection, unavailable provider, or newly supported check is a coverage change, not automatically a change in the token. Include unchanged material findings without creating artificial news.

Examples to investigate include authority status, a selected pool’s liquidity, or newly available risk data. Thresholds for “material” change should come from observed research needs and data stability. Do not lead with a price countdown or imply that an update is an entry signal.

**Experiment:** Run a two-week diary pilot using on-demand checks and prepared historical examples where live comparisons are unavailable. Ask what triggered each recheck and whether the difference answered a real question. Compare the proposed view with rereading two dated reports. Record false changes caused by source inconsistencies.

**Decision gate:** Expand to scheduled monitoring only if repeated, meaningful needs emerge and the comparison is reliable. Returning because a study reminder requested it is not organic retention. Retire this idea if users consistently have one-off questions.

### 3. Preserve a short research trail

**Hypothesis:** The missing bridge between manual checking and discovery is remembering why a coin mattered, not adding another feed.

A minimal record could retain the exact token, origin of the check, last checked time, and an optional unresolved question. Example: “From a public post; connection not established.” A user may revisit, dismiss, or retain that question without declaring a coin good or bad.

When a future live scanner finds an already checked mint, reopen its existing record and attach the new evidence. Do not create duplicate research solely because the token appears through another scanner. Keep scanner definitions and coin records conceptually separate: saving a scanner means retaining a rule; saving a check means retaining research. Test labels before expanding the existing Saved tab.

**Experiment:** Give participants several findings, including the same mint through two origins, then ask them to resume a question after an interruption. Test the current flow against a minimal history prototype. Ask users what they expect to remain on this device and what they expect to sync.

**Decision gate:** Proceed only if retrieval improves without making Active/Saved more confusing. This is a workspace experiment, not justification for social profiles, messaging, wallet connections, or a comprehensive portfolio tracker.

### 4. Test whether a public mention identifies this token

**Hypothesis:** People need help distinguishing an exact reference from a plausible story connecting a post and a meme coin.

Test a manual source-plus-token workflow before monitoring many accounts. Present the source identity and date, the exact content used as evidence, and one of three outcomes: an address/link match, an inferred thematic relationship, or no supported connection. Never turn absence of an exact match into proof of no relationship. An exact mention also does not establish endorsement or project legitimacy.

Use the same report later for Public figure scanner findings. Keep the user’s selected accounts separate from project-supplied social links, and distinguish quoted/reposted content from the account author’s own statement.

**Experiment:** Build a reviewed reference set containing direct mentions, quotations, ambiguous themes, impersonation, and unrelated tokens sharing a name. Have two reviewers label cases and document disagreements. Measure incorrect asserted relationships separately from missed matches; assess whether users understand the distinctions. Start with links and content that the team can lawfully access and retain.

**Decision gate:** If useful matching requires broad speculative association, postpone automation. Avoid numeric confidence until scores have been calibrated against reviewed cases. This is potentially memorable because it answers a specific question, but willingness to use it remains unproven.

## Positioning and validation before adding more scope

Test plain descriptions with adults who recently faced one of three situations: checking an address from social media, returning to a previously researched coin, or making sense of conflicting data. Ask what outcome they expect, what they currently use, and what would make the tool unnecessary. Favor a recent concrete example over an opinion about a hypothetical feature.

One candidate position is **“Understand the coin you found.”** Another is **“Check the address, evidence, and unanswered questions.”** These are copy hypotheses. Do not describe Soltech as a safety certificate, an endorsement engine, or a route to early profits.

Recruit a formative group such as 8–12 adults with varied experience, phones, and confidence, including people who use existing tools. That size is a practical starting choice, not statistical proof. Use mock cases for dangerous or incomplete situations; no purchase or signing task is necessary. Pay for participation independently of positive feedback.

Set the primary measure before each test: correct identity selection, accurate interpretation, or successful resumption. Pair behavior with an explanation in the participant’s own words. HEART offers a goals-to-signals-to-metrics process, not a guarantee of growth; retain only metrics relevant to the current decision. [Rodden, Hutchinson and Fu, CHI 2010](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)

For a later pilot, distinguish successful first checks from repeat checks tied to a new question or material update. Segment by acquisition source and experience; market events can change demand independently of design. A shorter session can be a better outcome. If testing willingness to pay, offer a concrete, costed service proposition after demonstrated use, rather than interpreting a survey’s “yes” as demand.

## Healthy return value and boundaries

The prior report reviewed FCA’s randomized simulated-trading experiment: price notifications and prize incentives affected trading activity and risk-taking. It did not test factual unread counts or establish long-term effects for Soltech. Keep “new” tied to genuinely unseen evidence, not a token’s desirability. [FCA experiment, 2024](https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf)

A responsible return loop is: a question remains → relevant evidence becomes available → the user chooses to review it → the record becomes clearer. Any future alert should state what changed, allow pause/mute, and stop when the condition is resolved. Track alert usefulness and unnecessary interruptions, not just opens.

Keep the checker’s safety boundary concrete. A 2026 wallet experiment with 364 participants tested approval-phishing interventions, with effects differing by intervention and outcome. That is evidence about authorization interfaces, not coin reports. Soltech should not imply that checking a token protects a user from a later malicious website or transaction. [Guan and colleagues, USENIX Security 2026](https://www.usenix.org/conference/usenixsecurity26/presentation/guan)

## Cost, privacy, and operational limits

The cost of a useful finding includes retrieval, retries, normalization, storage, review, and maintenance. Before offering continuous scanners, measure the number of unique resources fetched, cache hits, failed checks, and useful results. A simple internal measure is operating cost per completed informative check; it is not a substitute for user value.

X’s published pricing on this research date lists $0.005 per Post read and $0.010 per User read. Thus 1,000 billable Post reads alone would cost $5, before other services. Billing deduplication is described as a soft guarantee; credit limits can interrupt access. Model bounded source lists and backfills before promising broad monitoring, and verify terms and current rates before release. This is documented pricing, not tested account access. [X API pricing](https://docs.x.com/x-api/getting-started/pricing)

Market APIs also impose endpoint-specific limits. Cache only with clearly defined freshness, back off on failures, and keep partial results visibly partial. A second provider may improve coverage but is not necessarily independent corroboration if both rely on the same upstream data. Publish the measurement definition, not just the provider count. [DEX Screener API reference](https://docs.dexscreener.com/api/reference)

Public token addresses do not make a person’s research behavior private. DEX Screener’s policy describes IP addresses, search/browsing history, and interaction data; it does not establish exact logging for every API endpoint. Tell users which services receive lookups. A server proxy shifts visibility and responsibility rather than making queries anonymous. [DEX Screener privacy policy](https://docs.dexscreener.com/privacy/privacy-policy)

Prefer optional, deletable history; keep notes local until sync has a demonstrated purpose. Avoid analytics containing raw queries or private notes. Local storage also needs honest expectations about shared devices, clearing data, and lack of cross-device recovery. Shared report links should be deliberate, omit personal notes by default, and preserve the check date rather than presenting a frozen report as current.

## Recommendation tiers

**Now:** Finish the manual check as a coherent task. Prioritize exact identity, concrete reasons, partial-data states, source/time disclosure, and one understandable next step. Preserve the live/sample distinction across every route. Measure comprehension and provider reliability.

**Test:** Compare dated checks, minimal research history, and source-to-token explanations in controlled cases. Choose one experiment at a time. Ask users to show their current workaround and resume their work after a delay.

**Later:** Add scheduled changes, shared evidence records, or cross-device history only after repeated need and affordable coverage are demonstrated. Connect scanners through exact token identity and explainable findings. Expand chains only when their data definitions and coverage can be supported consistently.

**Skip for this stage:** A universal safety score, speculative AI buy/sell guidance, paid visibility presented as quality, profit leaderboards, trading streaks, wallet connection as onboarding, an influencer marketplace, and broad scanning before matching quality is established.

The next reviewable deliverable should be one tested coin report with a dated evidence trail. If it helps adults answer the right questions accurately, test the revisit workflow. If it does not, additional discovery volume will amplify the confusion.
