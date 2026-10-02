# Psychology of trust: primary-source notes for Soltech

Research reviewed 2026-09-28. Scope: a beginner-facing crypto coin checker/scanner. Research only; no UI changes. The Soltech implications below are design hypotheses inferred from adjacent domains, not effects demonstrated in crypto scanning. None of these papers establishes that a design pattern improves Soltech retention or engagement.

The useful objective is **appropriate reliance**: people should understand what the scanner can establish, what it cannot, and when to verify an output. Credibility impressions, stated trust, observed reliance, and actual system quality should be assessed separately.

## 1. Visual credibility can come from surface cues

**Fogg, B. J., et al. (2003). “How Do Users Evaluate the Credibility of Web Sites? A Study with Over 2,500 Participants.” DUX 2003.**

- Method: 2,684 participants compared two live websites; 100 sites across ten categories included finance. Researchers coded open-ended credibility comments.
- Finding: visual appearance appeared in 46.1% of coded comments; information structure in 28.5%. These percentages describe comment content, not variance explained, effect sizes, or percentages of users fooled.
- Caveat: a nonrepresentative volunteer sample; 2002-era websites; appearance was not experimentally isolated. Perceived credibility was studied, not factual accuracy, security, retention, or investment quality.
- Soltech implication: use clear hierarchy, readable type, consistent states, and restrained copy. Pair visual polish with inspectable evidence; professional appearance cannot substantiate a “safe coin” claim.

Sources: [Stanford publication record](https://credibility.stanford.edu/publications.html), [ACM DOI](https://doi.org/10.1145/997078.997097), [full original paper, external mirror](https://pureprose.wordpress.com/wp-content/uploads/2010/11/webcredibility.pdf).

## 2. Showing uncertainty need not destroy trust

**van der Bles, A. M., van der Linden, S., Freeman, A. L. J., & Spiegelhalter, D. J. (2020). “The effects of communicating uncertainty on public trust in facts and numbers.” PNAS, 117(14), 7672–7683.**

- Method: five experiments, total n=5,780, including a preregistered national-sample replication and a BBC News field experiment; verbal and numerical uncertainty around factual estimates.
- Finding: people noticed explicit uncertainty. Trust reductions were small overall and were more evident with verbal uncertainty; numerical ranges generally had little effect on trust.
- Caveat: chiefly uncertainty about present/past facts, rather than future investment performance. This does not validate invented confidence percentages or show that ranges improve investment decisions.
- Soltech implication: distinguish missing evidence, stale observations, conflicting sources, and measured uncertainty. Show a range only when the underlying method supports it. A generic “confidence 92%” is inappropriate without a defined, validated meaning.

Sources: [full open paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7149229/), [DOI](https://doi.org/10.1073/pnas.1913678117).

## 3. Credibility checking benefits from looking beyond the site

**Wineburg, S., & McGrew, S. (2019). “Lateral Reading and the Nature of Expertise: Reading Less and Learning More When Evaluating Digital Information.” Teachers College Record, 121(11), 1–40.**

- Method: think-aloud comparisons of 45 experienced internet users: ten professional fact checkers, ten PhD historians, and 25 Stanford undergraduates, evaluating live sites on social/political topics.
- Finding: fact checkers corroborated externally and reached better-supported conclusions faster. Other participants were more susceptible to appearances, logos, and domain names.
- Caveat: purposively selected expert groups, not a randomized interface experiment. It does not prove that adding source links automatically teaches beginners to verify claims.
- Soltech implication: put provider identity, observation time, contract address/network, and direct evidence links beside the relevant finding. Clearly identify project self-reports versus independent observations. Make checking the original evidence easy.

Sources: [publisher article and abstract](https://journals.sagepub.com/doi/10.1177/016146811912101102), [Stanford archive record](https://openarchive.stanford.edu/node/2559). Published version is 2019; earlier working-paper/archive dates differ.

## 4. Privacy information must be usable at the decision

**Tsai, J. Y., Egelman, S., Cranor, L., & Acquisti, A. (2011). “The Effect of Online Privacy Information on Purchasing Behavior: An Experimental Study.” Information Systems Research, 22(2), 254–268.**

- Method: randomized shopping experiment with 48 complete participants across three conditions; compact privacy indicators in search results. Participants made real purchases using their credit cards and received fixed reimbursement.
- Finding: prominent privacy information shifted purchases toward merchants with stronger privacy policies; some participants paid a premium.
- Caveat: small, task-specific shopping study with explicit indicators. Policy ratings are not an audit of actual compliance. Results do not establish a general conversion/retention uplift or a universal willingness to pay for privacy.
- Soltech implication: explain collection, purpose, sharing, and storage near an account or wallet-related choice in plain language. Only state “no wallet needed,” “not stored,” or similar assurances if verified in the implemented system.

Sources: [Carnegie Mellon accepted-manuscript record](https://kilthub.cmu.edu/articles/journal_contribution/The_Effect_of_Online_Privacy_Information_on_Purchasing_Behavior_An_Experimental_Study/16560339), [published DOI](https://doi.org/10.1287/isre.1090.0260). Online publication was 2010; journal issue was 2011. Sample/method also checked against indexed author manuscript text.

## 5. Errors can cause distrust; explanations can restore too much trust

**Dzindolet, M. T., Peterson, S. A., Pomranky, R. A., Pierce, L. G., & Beck, H. P. (2003). “The role of trust in automation reliance.” International Journal of Human-Computer Studies, 58(6), 697–718.**

- Method: three university-student laboratory studies, n=15, 180, and 24; participants detected camouflaged soldiers with an automated aid. Reliability, feedback, and reasons for errors varied.
- Finding: participants initially expected capable automation; observed errors could cause distrust even of useful aids. Explaining why errors occur increased trust and reliance, including reliance that was unwarranted.
- Caveat: an artificial detection task, with small samples in two studies. A persuasive error explanation is not evidence of successful repair or calibrated reliance.
- Soltech implication: report what failed, which findings are affected, observation freshness, and the next useful action. Keep unavailable checks visibly unknown rather than scoring them as passed. Preserve the query so users can retry; disclose corrections to prior findings.

Sources: [publisher article and indexed study sections](https://www.sciencedirect.com/science/article/pii/S1071581903000387), [DOI](https://doi.org/10.1016/S1071-5819(03)00038-7).

## 6. Explanations and user satisfaction are insufficient tests of safe reliance

**Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). “To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making.” Proceedings of the ACM on Human-Computer Interaction, 5(CSCW1), Article 188.**

- Method: online meal-substitution experiment; 199 analyzed participants, drawn from 260 recruited. Simulated AI was 75% accurate; interfaces varied explanations, uncertainty, and interventions requiring more active consideration.
- Finding: cognitive forcing reduced agreement with incorrect AI suggestions relative to simple explainable-AI interfaces. It did not eliminate overreliance; the most effective designs received worse subjective ratings. Benefits differed with motivation for effortful thinking.
- Caveat: nutrition task and controlled AI errors, not finance. This does not justify artificial delays throughout a scanner.
- Soltech implication: test a concise evidence review for consequential interpretations. Avoid treating a green score as sufficient evidence for a buying decision. Evaluate acceptance of incorrect outputs and understanding of missing checks alongside ease-of-use ratings.

Sources: [author-hosted published paper](https://kgajos.seas.harvard.edu/papers/bucinca21trust.pdf), [DOI](https://doi.org/10.1145/3449287), [author preprint](https://arxiv.org/abs/2102.09692).

## Implications to validate with beginners

These are proposed applications, not findings from a Soltech experiment:

1. A result should expose **finding → evidence/source → observation time → limitations → next step** in an understandable order.
2. Separate “no issue detected by these checks” from “this investment is safe.” A scanner's coverage and a coin's financial prospects are different questions.
3. Test whether users can identify the token/network, distinguish unavailable checks from passed checks, explain the score's scope, and find supporting evidence.
4. Include deliberately incomplete, stale, conflicting, and incorrect outputs in formative studies. Measure both unwarranted acceptance and unwarranted rejection.
5. Track actual service quality separately: data freshness, request failures, coverage, reproducibility, corrections, and validated error rates. Never manufacture reliability numbers for visual reassurance.

Evidence gap: these six studies offer mechanisms and cautions; none directly tests novice crypto-scanner behavior or demonstrates a causal increase in long-term engagement. Recovery controls and the proposed result layout remain product hypotheses requiring task-based evaluation.
