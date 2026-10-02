# Default Soltech scanner review

## Delivered

Scanner now shows one Soltech scanner immediately, with a small Customize action. New users do not have to choose a preset or complete a builder. The derived default enables Posts on X and New coins. The optional editor can change these sources and their rules, name, symbol and color. The existing white/silver and blue-purple glass theme remains.

The default is derived when no configuration has been saved; merely viewing Scanner or Finds writes nothing. A customization creates a separate draft. Existing saved settings take precedence and legacy drafts retain their fields. Profile and Finds no longer tell people to choose a preset first. Earlier setups remain quietly available under Profile.

X scope is explicit: Soltech list or Choose accounts. The default list is not connected or populated yet; no account count or membership is invented. Personal accounts remain required and validated when custom scope is selected. Switching scope retains the user's handles. Older data without a scope remains custom. The default's direct mentions, 24-hour trading-age launch rule, and exclusion of high-risk results are product starting choices, not validated performance thresholds. Unassessed results remain a distinct included category.

An unfinished customization has one Continue setup action. Save draft & exit is distinct from Save setup: only the latter replaces the saved configuration. Cancel discards draft changes while preserving the saved configuration or default. The exit toast was corrected to say Draft saved.

## Verification

- All 152 automated tests passed, including fresh default reads, optional cosmetic customization, custom-account validation, mode switching, legacy scope inference, cancellation, save failures, unreadable data and cross-tab conflicts.
- Isolated browser origin on port 4182: default appears immediately; Customize opens preselected sources; Soltech scope needs no personal handles; custom scope rejects an empty list and focuses the field; switching scope and reloading preserves entered handles.
- Save draft & exit returns to Scanner with one resume action and leaves effective settings unchanged. Reload resumes the correct source and step. Save setup applies and reopens a renamed scanner. Cancel after a source change leaves the saved scanner unchanged.
- Finds shows an honest unconnected state and current source summary. No test/sample discoveries are inserted.
- Visual checks at 390px, 320px and 1280px. The 320px layout has no horizontal overflow; Customize wraps below the identity at that width. No browser errors were observed during the isolated walkthrough.
- Original mobile and desktop previews refreshed to Scanner. The user's existing unfinished customization remained intact. Original server was not restarted, provider credentials were not accessed, and hosted site was not deployed.

Screenshots: default-scanner-mobile.png (fresh default, 390px), default-scanner-desktop.png (saved customization, 1280px), default-scanner-original-mobile.png (current preview with the user's retained draft). The preceding bottom-icon follow-up is also retained in finds-scanner-nav-icons.png.

## Remaining work

Live scanner monitoring, maintained X account membership, launch ingestion and alert delivery are not implemented by this pass. A saved setup does not start scanning. Quality, coverage, latency and cost need a bounded live trial before calling the default effective. See ../research/default-scanner-2026-09-28.md for verified J7/GMGN/Axiom evidence and the proposed sequence. The live coin checker is separate and was not changed.

Browser-local profiles, preferences and scanner data remain separate from the project ZIP. No full screen-reader or physical-phone audit was performed.
