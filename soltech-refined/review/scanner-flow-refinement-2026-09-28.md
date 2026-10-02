# Scanner creation review and refinement

The review found nested hidden filters, unclear new-coin age, incomplete review summaries, inconsistent generated names, and browser history that could create an unwanted draft.

## Implemented

- Retained three equal purpose cards: Posts on X, New coins, All coins.
- Purpose-specific setup: accounts and matching for X; visible maximum age with hour/day shortcuts for new coins; liquidity and valuation limits for all coins.
- New drafts start new-coin age at 24 hours. Automatic names and age suggestions follow purpose changes until edited. Existing drafts retain their values.
- Removed the double disclosure layer. Optional sections show whether settings are applied; their values survive changing purpose.
- Review leads with name and optional badge personalization, then a complete list of applied rules. The illustrative matching explanation is optional.
- Four symbols and four colors, with white symbols and the existing silver diagonal badge style. Review, Active, Saved, and details resolve the same appearance.
- Focused mobile setup replaces the general bottom navigation with reachable Back/Continue/Review/Save actions. Save draft & exit remains available.
- Contradictory pre-DEX stage and DEX venue combinations receive a correction. Invalid recovered Review drafts reopen editable settings. Completed builder routes no longer create drafts just by being viewed.
- Saving an edit preserves its Active/Saved destination and scanner identity.

## Verification actually performed

- Node suite: 133 tests passed, zero failed. Includes persistence, explicit appearance, legacy source identity, suggested-name ownership, age defaults, and full applied-rule summaries.
- Isolated local browser walkthrough: all three purpose paths; missing X accounts; invalid numeric range and correction; advanced rules on Review; badge and color selection; radio keyboard navigation; saving a custom scanner; activation and edit return to Active; save draft and resume; completed builder route without creating a new draft.
- Inspected desktop and phone rendering, plus a 320px browser width (phone content narrowed to 279px without horizontal overflow). Badge choices were at least 48px wide at that narrow size. Shared keyboard focus remains visible.
- Main preview tabs refreshed. Their user data was not used for test scanner creation. Main preview server was not restarted.
- Screenshots: `builder-refined-setup-mobile.png`, `scanner-icon-picker-mobile.png`, `builder-refined-review-desktop.png`.

## Limits / follow-up

- Live scanner processing and X monitoring remain unconnected. These are saved rules, not tested live matches.
- The 24-hour starting point and terminology need beginner usability testing; no engagement improvement is claimed.
- No physical-device or screen-reader audit, or full WCAG certification, was performed. New controls have native semantics; new motion was not introduced.
- Browser tooling reported a MutationObserver error without an application source URL; no corresponding app failure was reproduced.
- Existing scanner workspace storage does not have cross-tab conflict protection. Edit scanners in one preview at a time until that is addressed. Profile storage has its separate conflict handling.
- Project backups contain files, not browser local storage or the in-memory data API key. Keep the same browser and preview origin to retain local profile/scanner data.
