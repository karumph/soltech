# Soltech redesign review — September 26, 2026

## What changed

The logo was disconnected from the pale-blue interface. The revised system uses dark neutral typography, white content, silver glass controls, and coordinated blue/lilac scanner categories. Faceted scanner marks borrow the logo's geometry without repeating its faces. The header is lighter, content panels are solid, and glass is concentrated on navigation and buttons. Existing shared styles were updated instead of adding another overriding theme file.

The global recap competed with scanner management and could show sample coins without an active scanner. It is removed. Active scanners now have persistent new-find counts and their own results. Public and project examples are separated. Custom names appear in match explanations, and unknown risk remains distinct from high-risk exclusions.

Active and Saved intentionally overlap because automatic saving was requested. Status labels explain that relationship. Using or activating a scanner opens its details on mobile, fixing the old return-to-list behavior. Drafts stay in Saved. A draft whose original was deleted can be recovered as a new scanner.

Customize exposes essential source choices first and puts numeric/technical controls in disclosures. Captions update as inputs change. Invalid input reopens the relevant section and focuses the error. Review says Risk preferences so it does not imply the fictional examples were filtered.

Additional fixes: account setup guidance before and after using a public preset; missing-scanner recovery points to Saved; consistent deletion wording; keyboard order matches the header; coin accessible names include the risk reason and New state; checkbox groups connect help/errors to controls.

## Verification performed

- All 32 automated state/filter/fixture checks and JavaScript syntax checks passed.
- Fresh first-use Add → Find → preview → Use → coin overview walked through.
- Edit → invalid range → correction → review → Save changes → Saved walked through.
- Unread counts drop only for the opened scanner and survive reloading.
- Saved-only and In Active states inspected. Draft persistence and missing-original recovery covered by tests.
- Fixed 390px phone frame and 320px viewport inspected, with no horizontal overflow on checked discovery/preview screens. Desktop discovery inspected at normal browser width.
- Dialog tabbing, Escape, and focus return checked. Visible buttons, links, and summaries in the checked 320px preview had no target below 24px in either dimension.
- Core color contrast: text 15.38:1, secondary 5.91:1, actions 5.79:1. All risk labels and the new-find badge exceed 4.5:1.

## Limits and user tests

This is not a WCAG certification. Screen-reader speech, all combinations at 200% zoom, every browser/device, and reduced-motion/transparency emulation were not tested. Loading and storage-failure handling remain; storage failure is tested in the state model rather than by disabling browser storage.

Results are fictional. Matching accuracy, freshness, financial outcomes, conversion, and retention have not been demonstrated. Test whether beginners understand New means unopened, Active differs from Saved, and Not assessed does not mean safe. The visual direction needs feedback from actual intended users.

The supplied logo bitmap is relatively large for its display size. Prepare an appearance-preserving optimized delivery asset before field performance testing. No production performance benchmark was run in this pass.


Browser log note: the fixed-phone wrapper recorded one MutationObserver error with no source URL. No MutationObserver code exists in the app or wrapper, the direct app page returned no console errors during the checked session, and the tested flows completed. The origin of the wrapper/integration error was not established.
