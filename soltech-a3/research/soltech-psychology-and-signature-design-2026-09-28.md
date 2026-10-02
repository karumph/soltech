# Soltech: trust, enjoyment, useful return, and a signature identity

Research and product recommendations · September 28, 2026

**Recommendation:** Make Soltech feel like a personal discovery tool that helps someone understand what they found. Give it a recognizable visual language and a recognizable way of explaining evidence. Preserve the simple app navigation. Make the experience satisfying through clarity, responsiveness, and saved progress.

The intended feeling is: **“That was interesting. I understand it better. I know what is still uncertain.”** That is a design objective, not a measured result.

This review combines 25 original empirical research publications/reports, a measurement framework, and accessibility guidance. It covers psychology, human–computer interaction, branding, and financial-interface experiments. It is a focused review, not a systematic review or proof of a universal formula. Most studies did not involve crypto scanners. Findings, product observations, and proposed design decisions are distinguished below. No application code or interface was changed for this research.

## 1. What makes people want to use an app again?

There are several different questions hidden inside “make it enjoyable.” They need separate answers and measurements.

| User experience | What Soltech should provide | What would be insufficient evidence |
| --- | --- | --- |
| An inviting first impression | An obvious purpose, readable hierarchy, a distinctive but coherent style | “It looks beautiful” alone |
| Feeling capable | Understandable results and a clear next action | Higher confidence without better understanding |
| Feeling in control | Meaningful choices, preserved work, easy editing and leaving | More options for their own sake |
| Appropriate trust | Inspectable sources, honest coverage, reliable behavior | A professional appearance or a green label |
| Satisfaction | The visit accomplished something worthwhile | Longer sessions or more refreshes |
| Useful return | Relevant discoveries, saved work, a real recurring need | Notification-driven traffic alone |
| Recognition | People can identify Soltech and recall what it helps them do | The founder or designer liking the treatment |

This table is our product interpretation. It is not a scientifically established sequence that every user follows.

### Appearance matters, but cannot carry the whole experience

Website screenshot experiments found that lower complexity and recognizable category structure supported initial aesthetic judgments. They did not measure whether people understood the product or returned later. A separate 80-person shopping experiment found that poor usability reduced later aesthetic ratings. A nice first impression can be undermined by frustrating use. [Tuch et al., first impressions, 2012](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/); [Tuch et al., experienced usability, 2012](https://www.sciencedirect.com/science/article/abs/pii/S0747563212000908).

**For Soltech:** keep recognizable search, tabs, back navigation, and editing. Put the originality into composition, materials, typography, and the way discoveries are explained. Unusual navigation is not required for an original identity.

### Enjoyment can come from understanding and ownership

Research on games linked autonomy, competence, and relatedness with enjoyment and intended future play. This supports investigating meaningful control and understandable feedback, but does not establish crypto-app retention. [Ryan, Rigby & Przybylski, 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf).

**For Soltech:** choosing what a scanner watches matters more than merely choosing its color. Both can be pleasant, but the first changes the job it does. A satisfying interaction might be understanding why a coin appeared, changing one rule, and seeing the explanation update. A custom name and icon then make that useful work feel personal.

An online-banking study associated satisfaction and perceived usefulness with intentions to continue. It was a one-time survey, not proof of actual future retention. Its useful lesson for us is to make a promise the product can fulfill consistently. [Bhattacherjee, 2001](https://doi.org/10.2307/3250921).

### More activity is not automatically more satisfaction

Points and leaderboards increased output in one annotation experiment without increasing intrinsic motivation. Other experiments found some benefits from particular combinations of game elements. There is no defensible blanket conclusion that gamification always works or never works. [Mekler et al., 2017](https://doi.org/10.1016/j.chb.2015.08.048); [Sailer et al., 2017](https://doi.org/10.1016/j.chb.2016.12.033).

The closer financial evidence is important. In an FCA randomized simulated-trading experiment with 9,140 completers, push notifications and points/prize mechanics increased trading frequency by 11% and 12%. Attention increased without a matching improvement in engagement with key information. The experiment does not show that every playful visual is harmful, or establish long-term financial outcomes. [FCA, 2024](https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf).

**For Soltech:** create pleasure through responsive controls, a good chart, interesting evidence, useful personalization, and a clear sense of completion. Do not use trade streaks, prize mechanics, pressure to refresh, or fabricated activity as the return loop. A person who understands the result and closes the app has completed a successful visit.

### Respectful reminders need testing

A notification field experiment found benefits from scheduled batches for some reported outcomes, but also tradeoffs; total suppression increased anxiety and FoMO in that setting. It does not establish the correct number of Soltech alerts. [Fitz et al., 2019](https://www.sciencedirect.com/science/article/pii/S0747563219302596).

**For Soltech:** when real scanner delivery exists, offer user-chosen alerts about material new findings, an optional summary, and easy pause. Do not bring back Daily recap merely to add content. The user already preferred findings inside scanners; that is a sensible starting hypothesis to test.

## 2. Trust should match the evidence

A polished interface can look credible even when its information has not been validated. In a large early website-credibility study, appearance featured prominently in participants' explanations; that does not mean appearance made the underlying content correct. [Fogg et al., 2003](https://doi.org/10.1145/997078.997097).

Soltech should help people decide how much to rely on each result. That means distinguishing:

- A reported observation from an inference.
- A check with no detected flags from a check that could not run.
- Current data from an older snapshot.
- A project's own claim from independently obtained evidence.
- An estimated historical market cap from an observed historical market cap.
- A saved scanner configuration from an operating monitoring service.

Explicit uncertainty does not inevitably destroy trust. Five experiments involving 5,780 participants found generally small trust effects, with differences by presentation. This supports honest disclosure; it does not justify invented confidence percentages. [van der Bles et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7149229/).

More explanation is not automatically better either. An AI-assisted task experiment found that interventions reducing overreliance could receive worse subjective ratings. Ease and liking must be checked alongside whether people accept incorrect conclusions. [Buçinca et al., 2021](https://kgajos.seas.harvard.edu/papers/bucinca21trust.pdf).

**Recommendation:** retain short risk language with a concrete reason and expandable evidence. Keep green “No flags reported” scoped to the checks that actually completed. Missing data stays distinct. Avoid turning a payment, boost, famous account, or attractive logo into implied security approval.

The FCA's risk-warning experiment analyzed 14,250 participants. More concrete wording combined with prominence improved comprehension by roughly 6–10 percentage points; prominence alone was not sufficient in the crypto branch. This was a simulated promotion experiment, not a test of Soltech. [FCA, 2022](https://www.fca.org.uk/publication/research/behaviourally-informed-risk-warnings.pdf).

**Writing implication:** trim repetition, but keep the few words that change interpretation. “Estimated,” “Not connected,” and “Checks unavailable” can be more valuable than another attractive icon.

## 3. What should make Soltech recognizably Soltech?

**My design recommendation is to develop the existing identity, rather than replace it with another fashionable theme.** The user has approved the white base, silver detail, colored scanner badges, and clearer profile. The missing piece is disciplined repetition and a product experience worth associating with that look.

Novelty and familiarity can coexist in aesthetic preference; research on physical product design supports that possibility, not a fixed formula for mobile interfaces. [Hekkert et al., 2003](https://bpspsychub.onlinelibrary.wiley.com/doi/abs/10.1348/000712603762842147).

A recent branding study compared 405 identity elements from 50 brands against consumer data from 7,505 respondents. Marketing professionals often overestimated recognition and underestimated uniqueness. This argues for measuring recognition instead of relying on our taste. It does not tell us which Soltech color or shape will succeed. [Brus et al., published online 2025](https://link.springer.com/article/10.1057/s41262-025-00395-y).

### A proposed visual system

These are art-direction choices to prototype, not psychological laws.

| Element | Proposed Soltech rule | Why it belongs |
| --- | --- | --- |
| Core composition | Airy white reading surfaces, strong dark text, compact information groups | Makes evidence and actions easy to find |
| Recognizable detail | One consistent silver facet/reflection derived from the existing mark | Connects the logo to scanner identity without repeating faces everywhere |
| Scanner badges | Keep the approved cut-corner silhouette, white symbols, and controlled color families | Gives personal scanners recognizable identity across screens |
| Utility controls | Smooth, simpler shapes; restrained glass on navigation and selected actions | Leaves scanner identity distinctive and keeps tools familiar |
| Color roles | Blue, lilac, and teal for identity/categories; separate labeled green, amber, red, and gray feedback | Prevents brand color from implying a risk judgment |
| Typography | One consistent heading voice, readable body type, stable numerical alignment and units | Creates recognizable proportions and makes comparisons easier |
| Motion | A small set of transitions that acknowledge selection, saving, or real incoming data | Adds responsiveness without delaying results or pretending a scanner is live |
| Language | Brief, specific, curious, and calm; explain unfamiliar terms at the point of use | Feels approachable without becoming vague or promotional |

The signature should still work in a static screenshot, without the wordmark, and with reduced motion enabled. If it requires a large logo, constant shimmer, or unusual controls to be recognizable, the system needs more work.

There is no evidence here that “blue creates trust,” silver is inherently premium, young adults all want neon, or glass improves retention. These are visual hypotheses shaped by the current brand and user preferences.

### A proposed signature interaction: explain the connection

Soltech's strongest distinctive feature could be a compact, consistent explanation of **why something appeared**. Use the same visual grammar across checker results and scanner findings.

For a future X finding:

**Original post → reason for the match → exact coin/network → checks and unknowns**

Someone can skim the conclusion, then inspect its basis. A direct contract-address reference must look different from a possible connection based on a phrase or theme. Related wording does not imply the public figure created or endorsed the token.

For a manually checked coin, start with the exact identity and checks; do not manufacture a social story. The interaction remains recognizable, while its content fits the evidence available.

This is a proposed Soltech pattern, not an already implemented feature or proof of uniqueness against every competitor. It needs a competitor comparison and beginner testing before we claim either.

### Three satisfying moments to design well

1. **Recognition:** the right coin, network, and real logo appear promptly, with a clear correction if the address is ambiguous.
2. **Understanding:** one short explanation answers why it matters, with unknowns next to the relevant claim.
3. **Ownership:** scanner choices and progress persist, and reopening brings the user back to useful work.

The personal profile supports this experience. It does not need follower counts, status scores, or extra fields to justify its existence.

## 4. What the existing product needs most

These are observations from source inspection and the saved implementation reviews, not a new end-to-end browser audit.

| Existing state | Practical implication | Priority |
| --- | --- | --- |
| Coin Checker uses real providers; coverage and freshness vary | Keep partial results useful and explain the specific missing pieces | High |
| Scanner configuration exists; live X monitoring is unconnected | “Active” placement must not be mistaken for currently monitoring. Test this explicitly | High |
| Some library scanner findings remain labeled samples; custom scanners show their saved setup | Keep demonstrations distinguishable from evidence found for the user | High |
| Profiles and scanner work are stored locally; project ZIPs do not back up browser state | Durable work and clear storage expectations are part of trust | High |
| Profile edits have conflict handling; scanner editing does not have equivalent protection | Address possible cross-tab lost work before scaling use | High |
| Chart market-cap history is estimated; history is a fetched snapshot | Preserve estimate and freshness meanings when making the graph more attractive | High |
| The builder already has Purpose, Set up, Review and personal icons | Test comprehension before adding more steps, presets, or controls | Medium |
| Recent icon improvements are approved | Consolidate a shared system rather than repeatedly restyling each icon | Medium |

These are priorities for subsequent work, not changes made during this research.

Speed is also part of the experience. Google's delay experiments observed reduced search usage when results were deliberately slowed. We cannot transfer the magnitude to Soltech, but should avoid making users wait for a decorative reveal after data is ready. [Brutlag, 2009](https://services.google.com/fh/files/blogs/google_delayexp.pdf).

Accessibility belongs in the design system: readable contrast, visible focus, labeled color states, keyboard access, and alternatives to dragging. Aim for WCAG 2.2 AA, with reduced-motion support as an additional design commitment. No conformance certification is claimed. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## 5. How we find out whether it works

### First: a small diagnostic study

Recruit roughly 8–12 adult beginner crypto users, plus a few experienced users to expose differences. This is a practical starting sample for finding problems, not a statistically representative retention study. Include accessibility needs and actual phone use. Do not treat “younger users” as one personality type.

Compare the current screen with one proposed identity treatment using identical content and data. Counterbalance order. Ask people what they think before offering words like “premium,” “fun,” or “trustworthy.”

| Task | What to observe |
| --- | --- |
| Briefly view the opening screen | Can they explain its purpose and where they would start? |
| Check an unfamiliar token | Correct identity/network, successful completion, errors, unnecessary backtracking |
| Explain a green, missing, and estimated result | Can they state what is and is not established? Does confidence match accuracy? |
| Build a scanner and revisit it | Can they explain its rules and whether it is actually monitoring? Is their work preserved? |
| See comparable screens after controlled exposure and a delay | Can they identify Soltech with the logo hidden, and explain which details helped? |
| Finish the visit | Was it worthwhile? What would give them a real reason to return? |

A proposed treatment should not advance merely because it is preferred visually. A repeated misunderstanding of “green means safe” or “saved means monitoring” requires revision even when participants like the design.

### Then: observe real use when there is a working recurring service

The HEART framework is useful for separating happiness, engagement, adoption, retention, and task success. It is a measurement framework, not evidence that a particular feature works. [Rodden, Hutchinson & Fu, 2010](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).

For an initial 4–6 week pilot, define success before collecting results:

- **Primary product outcome:** people complete a useful check or evidence review and can interpret its limits.
- **Useful return:** a later visit to review a relevant finding or saved work; validate event proxies with interviews.
- **Satisfaction:** whether the visit achieved the person's purpose, measured immediately and after repeated use.
- **Recognition:** identify the product after equal exposure, separate from liking it.
- **Reliability:** time until usable results, failed saves, stale data, provider errors, and recovery success.
- **Guardrails:** false safety conclusions, unnoticed missing checks, pressure to trade, and unwanted interruptions.

Use a randomized comparison and an appropriate sample-size calculation before making causal retention claims. A before/after redesign during different market conditions is not enough. Do not equate longer visits, more scans, or profitable trades with better UX. The pilot duration is a study choice, not a proven psychological threshold.

## 6. Recommended next step

**Approve a one-page identity and interaction brief, then apply it to one complete journey: check a coin, understand the result, and inspect its evidence.** Keep the approved navigation and scanner/profile work. Compare the current and proposed journey with beginners before spreading new styling across the app.

In parallel, prioritize reliable saved work and honest scanner service status. Those issues can damage trust more directly than an imperfect icon. After that, connecting one real scanner gives people a recurring benefit on which return can actually be evaluated.

The signature to aim for is a recognizable combination: **silver-faceted scanner identity, calm white information surfaces, purposeful color, and clear explanations of discoveries.** Its success remains something to test.

## Source notes and verification limits

The companion files contain individual study methods, samples where verified, links, limitations, and further testable hypotheses:

- [Trust: six original studies](psychology-trust-sources.md)
- [Motivation and return: eight original studies](psychology-motivation-sources.md)
- [Visual and interaction design: eight original studies](psychology-visual-sources.md)

This report adds the two FCA experiments and the branding study, giving 25 empirical publications/reports in the review. Primary papers, original institutional reports, author copies, and publisher abstracts were used; abstract-only access is identified in the notes. HEART and WCAG are additional guidance, not counted as empirical studies.

No new user study, retention experiment, accessibility audit, app test suite, or UI implementation was performed for this research. It does not establish a universally successful theme, guarantee trust or happiness, or validate coin safety. The product recommendations are a reasoned starting point for a prototype and testing.
