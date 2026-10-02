# Scanner creation: beginner mobile UX research

Research date: 28 September 2026. Scope: public-source desktop research and read-only inspection of the current Soltech scanner editor. No product changes, live account connections, browser-tab access, trades, messages, or usability sessions were performed.

## Recommendation

Replace the general filter form with a short, task-based flow: **Choose a purpose → Set up the source → Review and save**. The first choice should be between **Follow people on X** and **Find newly launched coins**. Keep account selection, the difference between direct mentions and possible themes, and the scanner's actual running state visible. Put optional market constraints behind one clearly named entry, **Add coin filters**.

This is a design hypothesis supported by comparable workflows and form-design guidance, not a measured claim that a three-screen flow will improve Soltech engagement. Test comprehension and independent task completion before committing to the final layout. Preserve a compact edit mode for experienced users; do not make them repeat an onboarding wizard for every small change.

The most important distinction is semantic, not visual: a post containing an identifiable token address, a possible theme inferred from a post, and a newly detected trading event are three different kinds of evidence. The interface should teach this distinction through choices and result examples. No amount of accordion cleanup fixes an unclear definition of what the scanner finds.

## What was actually inspected

- Current source: `soltech-ui/dist/scanner-editor.js`, `scanner-settings.js`, `workspace.js`, and builder-related portions of `app.js`. This was code inspection, not a live mobile usability test or a visual inspection of every screen.
- Three documented workflows in detail: GMGN X Tracker; Zapier trigger setup/testing; IFTTT classic Applet creation. Official pages were opened directly on the research date. Their published workflows are evidence of product behavior described by their owners, not proof that every current app screen is identical.
- Supporting references: GMGN new-pair documentation, Axiom Tweet Monitor documentation, TweetShift's public site, and NN/g research/guidance on forms, progressive disclosure, and contextual help.
- No logged-in competitor product was used. Images embedded in documentation were not independently visually inspected; the findings below rely on the page text.
- TweetShift's current setup and account-filter pages were reached but returned no readable body through the web tool. Do not describe their detailed current flow as inspected. The older docs redirect to the current help site.
- Axiom's official page simultaneously says customization is coming and describes adding custom handles and notifications. Treat its detailed chronology/current availability as unresolved rather than filling gaps from third-party coverage.

## Comparison of real workflows

| Product and evidence | Documented workflow inspected | Transfer to Soltech (our inference) | What not to copy |
| --- | --- | --- | --- |
| [GMGN X Tracker](https://docs.gmgn.ai/index/x-tracker.md) | Add accounts through Customize/My List, then choose the kinds of activity to display. The docs explicitly state that the CA/Token option shows only posts with a contract address. The page also describes purchasing and automatic trading, which are separate capabilities. | Put **who to watch** before filter detail. Explain exactly what qualifies as a match beside the choice. Show selected accounts as individually removable items. | Trading jargon, account popularity as a quality judgment, speculative return language, and mixing scanner creation with buying. The documented account caps are product-specific, not a reason to adopt the same cap. |
| [Zapier trigger setup](https://help.zapier.com/hc/en-us/articles/8496288188429-Set-up-your-Zap-trigger) | Select app and event, connect the account, configure needed fields, then load and inspect a test record. Drafts autosave. The documentation distinguishes real account records from generic test data and says live behavior can differ. | Establish the source/event first. Make test provenance visible. Separate a valid configuration from successful live operation. Save work while the user explores. | Desktop app/action complexity and a mandatory chain of irrelevant setup tabs. Soltech should not require users to learn “triggers” and “actions.” |
| [Zapier testing](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps) | Trigger tests retrieve sample records; action tests may change the connected application. Tests can be rerun and required-field changes reset affected tests. | Define a Soltech rule test as read-only. Invalidate stale test evidence after any change that could change matching. Display why a record matched or was excluded. | A generic green “Test successful” mark that users may interpret as proof of coverage, safety, future matches, or profitability. |
| [IFTTT creation](https://help.ifttt.com/hc/en-us/articles/360021401373-Creating-your-own-Applet) | Official page updated 23 September 2026: creation offers chat and a classic editor. Classic chooses If This/service/trigger, Then That/service/action, configures fields, names the Applet, then Finish turns it on. Unsupported services are separated and labeled. | Use a readable sentence that connects source, condition, and output. Ask for a name after the user knows what they made. Label unsupported coverage at the selection point. Make the final action's effect explicit. | “Finish” as an ambiguous activation label. A freeform AI prompt should not be the only path for beginners who do not know what the product can do. |
| [IFTTT filter setup](https://help.ifttt.com/hc/en-us/articles/4406412223771-How-to-add-filter-code) | Additional filtering is inserted after a basic trigger and action exist. | Establish a useful scanner before offering precision controls. | Code-based filtering as the beginner mental model. |

Additional context: [GMGN's new-pair guide](https://docs.gmgn.ai/index/new-pair.md) describes a time-based feed and metrics including age, liquidity, capitalization, holders, and trading activity. That supports keeping launch discovery distinct from social monitoring; it does not establish good beginner defaults or prove a new pool equals a new project. [Axiom's official monitor page](https://docs.axiom.trade/tweet-monitor) emphasizes account monitoring and configurable notifications, but its inconsistent customization wording limits stronger conclusions. [TweetShift's homepage](https://tweetshift.com/) establishes an account-to-feed concept and keyword filtering; the unreadable [setup](https://help.tweetshift.com/setup) and [filter](https://help.tweetshift.com/filters) pages limit workflow comparison.

## Why the current editor feels difficult

These are source-based diagnoses to verify with users:

1. **It starts with administrative work.** “Scanner name” arrives before the user has decided what the scanner means. “My first scanner” does not help define its job.
2. **The first categories mix unlike things.** “Public figures” identifies a source; “New projects” describes a discovery goal; “All coins” appears to combine scanner types without explaining the logic. Beginners must invent the relationship.
3. **It defaults to the less certain interpretation.** “Direct mentions + related themes” contains two evidence standards. Even with existing help text, a novice could infer that a theme candidate was actually mentioned by the account.
4. **It demands input syntax.** A handles textarea asks users to type and separate account identifiers. Syntax validity alone cannot establish that an account exists, is the intended person, or can be monitored.
5. **Collapsed sections still impose a taxonomy.** “Age & market,” “Trading activity,” “Risk & ownership,” and “Posts to watch” ask beginners to decide whether they need unfamiliar controls. Unrestricted defaults help, but the form still foregrounds the existence of many decisions.
6. **The review reads like a configuration dump.** It lists “Any” values, technical properties, and default settings at roughly equal weight. The primary behavior is harder to find than it should be.
7. **State and meaning compete.** The current prototype honestly says settings are saved locally and examples do not change; saving also puts a scanner into “Active.” That may still imply real monitoring. Use a distinct preview/saved state until a live scanner exists.
8. **Existing good behavior should survive.** The code preserves hidden controls in drafts without constraining the other scanner type, saves drafts locally, validates min/max relationships, distinguishes pool/token/trading age, separates launchpad reserves from DEX liquidity, and states that missing checks are unassessed. Simplification should retain these semantics.

[NN/g's progressive-disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) supports showing frequent, important choices first and making specialized options clearly discoverable. It also cautions against splitting interdependent choices across too many steps. This is why account selection and matching belong together, and why filter editing should keep its effect visible rather than become a long wizard of its own.

[NN/g's form guidance](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/) supports a logical question order, relevant branching, persistent labels/help, clear optional fields, a single column, and errors near the affected field. The proposed copy below applies these principles to Soltech; it is not copy taken from competitor screens.

## Proposed mobile flow and exact draft copy

The screen copy in this section is proposed original copy. Bracketed values are real dynamic data requirements, not fabricated display values. Keep a visible Back control, a clear page title, one main action, and autosave status. Use three progress labels: **Purpose · Set up · Review**. Do not assert a completion time until measured.

### 1. Purpose

**Title:** “What would you like to find?”

**Intro:** “Choose what this scanner watches. You can adjust it later.”

Two full-width radio cards:

- **Follow people on X** — “Find coins directly mentioned in their posts. You can also include possible meme connections.”
- **Find newly launched coins** — “Find coins as they start trading on supported sources.”

**Main action:** “Continue”

**Preview-only status:** “Scanner preview · Live monitoring is not connected.”

Do not preselect either task for a user entering Create scanner from scratch. When entering from a clearly named template, inherit the task and open Set up instead. Let users understand and edit the template's choices. Remove “All coins” from the beginner creation entry; if broad market scanning becomes a real separate task, give it a separate explainable purpose rather than treating it as the union of two unrelated sources.

If nothing is selected, a tap on Continue should give the inline instruction “Choose what you want this scanner to watch.” Preserve normal radio semantics even if the controls look like cards.

### 2A. Set up: people on X

**Title:** “Who should it watch?”

**Label:** “X accounts”

**Help:** “Add an @handle or paste an X profile link.”

An Add action resolves one account at a time. Show display name, exact handle, profile image when available, and a remove control with an accessible account-specific name. Accept multiple pasted handles as a convenience, normalize whitespace/commas/URLs, deduplicate, and show the result for each one. Do not silently pick a similarly named account. Any suggested accounts must be explicitly added; do not secretly subscribe people to a list of “winners.”

**Second question:** “What should count as a match?”

- **Direct coin mentions** (initial default) — “Posts with a token address or link that identifies a specific coin.”
- **Direct mentions + possible themes** — “Also look for coins related to a post's words or images. These connections may be unrelated to the author.”

Visible explanation under the broader option when selected: **“Theme matches do not mean the person mentioned, owns, or supports the coin.”** This option must only promise image interpretation if the actual pipeline supports it; otherwise say “words.” If symbols/names alone are supported, do not automatically present them as address-level identification. Ambiguous names need a separate uncertain candidate state.

**Small defaults summary:** “Watching original posts. Replies, reposts, and quotes are off.” This is a proposed comprehensible starting point, not an empirically optimal choice. Provide an **“Edit post types”** link to a small sheet with individual selections. A quote's original author and quoting author must remain separate in match evidence. Default all-post-type behavior can be reconsidered after coverage and user testing.

**Optional entry:** “Add coin filters” — “Liquidity, age, trading activity, and more.” Once used: “Coin filters · [number] set.”

**Main action:** “Review scanner”

**Draft behavior:** Users may save/leave a draft with no account. A live People scanner cannot activate without at least one supported, resolved source. In a prototype, label the account “Saved handle · Not verified” instead of fabricating a successful identity check. Continue may lead to Review, but that review must say what is missing and cannot imply readiness to monitor.

### 2B. Set up: newly launched coins

**Title:** “What does new mean for this scanner?”

**Question:** “Watch for”

- **Started trading** — “Coins whose first supported trading activity was detected recently.”
- **New DEX pools** — “New trading pools on supported exchanges. The coin itself may be older.”

These choices depend on real provider events. If the system only knows pool creation, offer only New DEX pools and title the purpose accordingly. If verified launchpad migration is implemented, it can become **“Moved from a launchpad to a DEX”**, with that event's timestamp. Do not label every new pool a migration, graduation, or new project.

**Question:** “How recent?”

Offer a small time choice such as **Past hour / Past 24 hours / Custom**, with an explicit label explaining which event starts the clock. Past 24 hours can be a design starting point because it is understandable, not a claim that it identifies better investments. Apply this to each evaluation time, not only the date of creation. Exact source coverage and history depth must be confirmed before enabling a choice.

**Coverage row:** “[Supported network] · [Supported sources]” with “View coverage.” Never use “All coins” if the feed only covers a subset. If multiple networks exist, select networks here; if there is only one, communicate it without creating an unnecessary dropdown.

**Optional entry:** “Add coin filters”

**Main action:** “Review scanner”

Avoid asking novices to pick market cap versus FDV, launchpad reserves versus DEX liquidity, and three alternate clocks just to make a first scanner. Those distinctions remain available in filters and must stay explicit whenever used.

### 3. Review, test, and save

**Title:** “Review your scanner”

Lead with one readable summary, for example:

> “Watch [account names] for direct coin mentions in original X posts.”

or:

> “Find new [network] trading pools created within the past 24 hours on [sources].”

Below, show four editable rows at most: **Accounts or sources**, **Matching**, **Coin filters**, and **Name**. Expand “View all settings” for the full technical summary. Explicitly list active restrictions, including any inherited from a template; omit a wall of “Any” defaults. If no numeric filter is set, say “No extra coin filters.”

**Name:** Generate a sensible editable suggestion such as “My X mentions” or “New [network] pools.” The name is editable here, not a blocking first question. Preserve a user-edited name when other rules change.

**Live implementation test action:** “Test with recent data”

**Test helper:** “Check which recent items match these rules. Testing does not turn the scanner on.”

**Live final action:** “Start scanner” if it truly enables monitoring, or “Save scanner” if it only saves a configuration. The description directly above must state where results go and whether alerts are enabled. Push notifications should be a separate understandable opt-in, asked when their benefit is clear and only if implemented.

**Current prototype final action:** “Save scanner preview”

**Current prototype helper:** “Saves these choices in this browser. Live scanning and alerts are not connected.”

**After successful live activation:** “Scanner started” with “Watching [sources]. New matches will appear here.” Show actual source status and last successful check, not a decorative pulsing “live” indicator. **After prototype save:** “Scanner preview saved” with “Your settings are saved in this browser.”

## Preview and test rules

Use three distinct concepts; never blend them in the same unlabeled results list:

| Mode | What may appear | Required label | What it proves |
| --- | --- | --- | --- |
| Explanation example | Deliberately fictional post/coin, fixed wording | “Illustration · Not a live result” | How the match type works. Nothing about coverage, account identity, filter correctness, or token quality. |
| Rule test | Actual fetched records evaluated against this exact draft | “Recent-data test”, source range, retrieval time, rule version, records checked | What happened on the available records. It does not predict future frequency or returns. |
| Live scanner results | Items detected after activation according to defined backfill policy | Source event time, detected time when useful, last check/coverage status | The scanner observed and classified this item under the recorded rules. |

For a helpful explanation example, use an invented “Example account” with no real public figure's avatar or handle. A direct illustration can say that a fictional post includes a token address. A theme illustration can show a fictional post about a space animal and a coin that shares those words. Write “Possible theme connection” and “No direct coin mention.” Do not invent an address that looks copyable or a live price. “Matched 12 coins” is only permissible when 12 real records were actually evaluated and matched.

The test should show a few inspectable outcomes: **Matched**, **Excluded by your filters**, and **Could not assess**. On each item expose the specific reason, source post/event, account/source, timestamp, and applied rule. Examples: “Address in the post identifies this coin”; “Possible word connection: [term]”; “Below your minimum liquidity”; “Liquidity unavailable.” Show time coverage and partial failures. Zero matches with valid data is different from receiving no data.

A count must state its denominator and coverage: “[m] matches from [n] available posts, [time window].” If retrieval is capped or partial, state that. Do not estimate alerts per day from one short sample. A test is read-only; it should not activate alerts, post messages, or submit trades.

Changing accounts, post types, match mode, supported network/source, time basis/window, or any active filter marks old results **“Rules changed · Test again”**. A previous result may remain visible with that label, but may not be used as current evidence. Ensure rule-test semantics match runtime semantics, including missing values, duplicate posts, quoted material, and event timestamps.

For the current UI-only implementation, show a static illustrative explanation or a plain-language rule preview. Do not offer an apparently functional live Test button followed by canned matches. If local fixtures are actually evaluated, label them “Example-data test” and disclose that no recent X or market data was fetched.

## Basic controls versus optional filters

Use one model underneath the beginner and detailed views. Going to advanced editing should reveal the same settings, not apply a different undocumented strategy.

| Keep in the main path | Put behind “Add coin filters” or a contextual edit link |
| --- | --- |
| Purpose, accounts/source, supported coverage | Custom numeric age bounds and alternate event clocks |
| Direct versus possible-theme matching | Liquidity/reserves minimums, with the applicable trading stage |
| A readable post-type summary | Market cap or FDV and min/max range |
| Discovery event and understandable recency | Volume/trades/active wallets with explicit window |
| Actual save/run state | Price change and window, holder concentration, creator holdings |
| Plain-language rule review and provenance | Token-control exclusions and detailed risk-status preferences |
| Result-level known/unknown checks | Personal notes and rarely used venue refinements |

Advanced editing should start with **“Only add filters you want to use”**, not an array of empty min/max inputs. Select a filter, then set its threshold. Display active filters as editable rows with Remove. The mobile editor can be a dedicated full-screen page; use bottom sheets for short, self-contained choices such as post types or explanatory help, not a nested multi-screen builder.

Every numerical filter needs a unit, an event/window when relevant, and a plain example. Empty means no constraint; zero means zero. Allow comprehensible shorthand only if parsing is reliable and normalize it visibly. Validate min/max relationships at the field after editing or submission. Never silently clamp an input or change its unit. Include a visible missing-data policy: items lacking a required metric are **Could not assess**, not passes. If users elect to include them, label them distinctly.

Do not invent “Safe,” “Balanced,” and “Aggressive” threshold presets without a defined, maintained policy and user research. A liquidity threshold is a data constraint, not a safety guarantee. Risk information should remain visible on results regardless of whether a user uses it as a filter. Avoid a mandatory risk questionnaire as the price of making a social scanner.

## Empty states, errors, and recovery

| Situation | Proposed message and action |
| --- | --- |
| No accounts yet | “Add an X account to watch.” Show the persistent input help and Add action. |
| Invalid handle/profile URL | “Enter an @handle or an X profile link.” Highlight just the invalid entry and preserve other accounts. |
| Valid syntax, no resolved account | “We couldn't find [handle]. Check the handle and try again.” Do not imply the account does not exist if the provider is unavailable. |
| Account lookup unavailable | “Account lookup is unavailable. Your handle is saved; try verification again.” Preserve the draft. |
| Source not supported | “[Source/account type] cannot be monitored yet.” Offer supported alternatives only if known. |
| No recent matching items | “No matches in the available [window] data.” Show records checked, coverage, and “Edit rules” / “Test again.” Do not mark the scanner broken. |
| No data returned | “No recent data was available to test.” Show the relevant account/source and retry. Do not claim there were zero mentions. |
| Some accounts failed | “Checked [n] of [total] accounts.” Name failed sources and label the test partial. |
| Conflicting limits | “Maximum must be at least [minimum].” Keep the value visible and focus the field. |
| Missing metric | “Could not assess this filter: liquidity data unavailable.” Do not substitute zero. |
| Draft persistence failure | “Your draft is only kept in this tab. Leave this tab open to keep editing.” Do not show a saved checkmark. |
| Permission/source failure after activation | “Needs attention: [specific source] isn't updating.” Keep prior results with timestamps; expose retry/reconnect when appropriate. |

When a user opens Create scanner and already has a draft, provide **“Continue draft”** and **“Start a new scanner”**. If the app supports only one draft, starting another is a destructive replacement and must clearly say what happens; adding support for multiple drafts is preferable to routinely forcing replacement. Do not silently overwrite unfinished work.

Back goes to the previous step without resetting values. Leaving the builder returns to the entry context and retains the draft. The current link always goes to Profile; instead remember whether the person started in discovery, their collection, or a specific scanner. Show “Draft saved in this browser” only after a successful write. Browser refresh should restore the step and form content when persistence succeeds.

When switching purpose, preserve the abandoned branch's choices in its draft so Back can restore them. Clearly show which branch is currently active; irrelevant hidden values must not constrain results. When editing a live scanner, edits remain a draft until **“Save changes”**; show which running configuration is still active. Saving a preview must not start background monitoring or alerts.

Use **“Discard draft”** as a secondary explicit action, with either a clear confirmation or reliable undo. If a saved scanner is removed while an edit exists, retain the edit and explain that it will save as a new scanner. Existing Soltech code already handles parts of this recovery and should retain them.

[NN/g's contextual-help guidance](https://www.nngroup.com/articles/onboarding-tutorials/) supports explaining unfamiliar concepts when people encounter them and making help dismissible and recoverable. Apply that with short definitions beside “possible themes,” “new pool,” and numerical units. Do not prepend a compulsory tutorial explaining every advanced filter.

## Validation before implementation

Prototype both paths with representative beginners, including people who know X but do not understand liquidity or FDV. Use these observable tasks, without teaching the answer first:

1. Make a scanner that follows one specified account and finds coins directly mentioned by it. Ask the participant to explain what it will and will not show.
2. Include possible meme themes. Show a theme candidate and ask whether the person mentioned or endorsed that coin. Treat mistaken attribution as a critical comprehension failure.
3. Find recent trading activity; show an older token with a new pool. Ask why it appeared and whether the project is new.
4. Add a liquidity constraint, encounter unknown liquidity, and explain the result. The participant should not interpret missing data as zero or a pass.
5. Leave midway, resume, change a setting after testing, and identify whether the test still applies.
6. Save the present prototype and explain whether it is monitoring live data or sending alerts.

Record task completion without help, misunderstood terms, backtracking caused by uncertainty, incorrect rule interpretation, time to a valid rule, and recovery from an error. Treat time as supporting evidence, not the sole goal. Do not use session duration or more alerts as evidence of a better scanner. Compare alternatives on understanding, correct configuration, and correct interpretation of results.

Open product/data questions that must be settled before live wording is finalized:

- Which X accounts/post types and sources are actually supported, with what latency and history window?
- Does “direct” require an address/link, or can a symbol/name be reliably resolved? How are ambiguous symbols, replies, quotations, links, and images handled?
- What exact event and timestamp define “new”: first supported trade, mint, pool creation, or verified launchpad migration?
- Are filtered-out records available for inspection, and how are unknown metrics classified?
- Is testing run through the same matching/filtering code as live operation? Is test history attributable to a specific rules version?
- Which activation, persistence, notification, and account-verification features are actually implemented?

The redesign can proceed as a truthful prototype before these integrations exist. In that case, use “preview,” “illustration,” and local-save wording throughout the path, and keep the live test/activation contract documented for later implementation.
