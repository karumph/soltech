# Guided scanner builder — September 28, 2026

Implemented the approved research direction: Purpose → Set up → Review. This is a local UI/setup change, not an X or live-scanning integration.

## What changed

- Two primary starting choices: Posts on X and New coins. All coins remains available under Other option for existing work.
- X setup asks for handles and explains direct mentions versus possible related ideas. New configurations default to direct mentions. Existing choices are preserved.
- New-coin setup starts with launch stage. Optional coin filters group age, liquidity/reserves, valuation, activity, risk and ownership. Post options remain separate.
- Review shows sources, matching mode, selected core limits, risk preferences and an explicitly illustrative explanation. Naming comes last; complete saved rules remain expandable.
- A new custom scanner saves inactive in Profile → Saved scanners. Edits retain the existing scanner's placement. No live scan is implied.
- Custom scanner detail now shows the same honest setup illustration instead of unrelated fictional finds and unread counts. Ready-made sample previews remain available.
- Empty and delimiter-only X accounts cannot finish setup. Incomplete or invalid work still autosaves as a draft.
- Existing two-step drafts migrate to Set up or Review with all fields retained. Three-step drafts are marked to prevent repeated migration.
- Changing purpose preserves a deliberately chosen name. Deletion recovery copy now points to Profile → Continue draft.

## Verification performed

- 127 automated tests passed, including new migration, new-step reload, incomplete X configuration, purpose switching, save placement and explicit-name preservation cases.
- JavaScript syntax checks passed for the changed app/editor modules.
- Isolated browser walkthrough: choose X, submit empty accounts, correct accounts, switch to related ideas, Review, refresh, resume from Profile, name and save into Saved.
- Desktop walkthrough: keyboard selection of New coins, launchpad selection, expand optional filters, submit an inverted market-cap range, correct it and review the saved limits.
- Inspected desktop, the normal phone frame and a 320px viewport. DOM bounds showed no horizontal overflow at 320px. Restored the normal viewport afterward.
- Focus moved to the invalid field and new step heading. Purpose validation uses an alert and description relationship. Reduced-motion CSS disables the new card transition.
- The main preview server was not restarted. User profile data was not edited. Existing user draft was retained and the mobile/web previews refreshed to Purpose for review.

## Limits / next review

No live X access, account verification, real rule matching or automatic scanning was added or tested. Illustrations are not filter test results. A full screen-reader audit and real-device testing remain outstanding. The builder still uses the existing browser-local workspace; concurrent scanner edits in separate tabs are not conflict-protected like profile edits.

Test with a beginner: can they distinguish direct mentions from uncertain related ideas, set a source without help, and understand that Save does not start a live scan? These are usability hypotheses, not measured improvements.

Screenshots: `builder-purpose-mobile.png`, `builder-purpose-desktop.png`, `builder-review-desktop.png`, `builder-review-320.png`.
