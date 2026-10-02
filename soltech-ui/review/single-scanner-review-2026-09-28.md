# Single-scanner transition: verification and stopping point

The chosen product direction is one customizable scanner. Primary navigation is Check / Finds / Scanner / Profile. The existing theme is retained; the experimental signature copy is separate and unchanged.

## Delivered

- Independent source branches for X posts, new coins and market data. Source presets preserve accounts and filters.
- Sources → Set up → Filters → Review, with one source's essentials at a time, complete review, custom name and badge.
- Clear Save & exit action; Continue setup reopens the draft. Duplicate resume actions removed from the configured-scanner screen.
- Finds is honestly empty until live monitoring is connected. No fictional matches or old sample unread counts in this flow.
- Earlier scanners and drafts remain in Profile → Previous setups, with explicit rule copying. The legacy records are retained.
- Separate scanner storage, validation, saving and draft recovery, conflict warning/export and failure handling. A pending storage problem prevents Save & exit from claiming success.
- Notification preferences are now a single New finds choice; old preference data is not erased.
- Bottom-navigation labels and icons stay neutral gray, including the selected item. Their color transition is removed; the selected glass still slides.

## Verification

All 147 Node tests passed, including independent-source persistence, enabled-source validation, legacy preservation, draft cancellation/reopening, stale-tab conflicts and failed final-save recovery. JavaScript syntax checks passed after the final exit-button change. The final exit button was tested in the rendered browser; the full suite was not redundantly rerun for that presentation change.

Isolated browser QA used a separate local origin, leaving the main preview's profile and scanner choices untouched. Walkthrough covered combined sources, blank-X-account rejection, sequential source setup, reload recovery, a six-hour launch limit independent of an X liquidity filter, Review, name/symbol/color, Save, reopening, cancellation preserving saved setup, Finds, Profile and notification Save returning to Profile. Save & exit returned to Scanner and Continue setup reopened the unfinished step.

Layouts were inspected at 390px, 320px and desktop size. The 320px page had no horizontal overflow. Computed main-navigation styles confirmed the selected and unselected labels use the same neutral color with no transition. Keyboard interaction was used throughout the walkthrough. This is not a full screen-reader or physical-phone test.

The current mobile and web previews were refreshed on the original port without restarting the server. The existing Check screen loads. Live coin data providers were not re-benchmarked in this UI transition. No hosted deployment, paid access or monitoring service was enabled.

## Files and next step

- Research: research/single-scanner-direction-2026-09-28.md
- Screenshot of current main preview: review/single-scanner-preview.png
- New draft control: review/single-scanner-save-exit-mobile.png
- QA examples: review/single-scanner-mobile.png, review/single-scanner-web.png, review/single-scanner-setup-320.png

The next session should walk through the combined preset, then choose a bounded live-source trial. Direct coin-address references should come before thematic matching. Network coverage, missing-data filtering, source freshness and alert behavior still need a backend design and live validation.

Project checkpoints contain source and review files. Browser-local profiles, scanner setups and preferences remain separate; use the same browser and port and do not clear site data. The QA origin is test work, not the user's main workspace. Provider secrets remain outside this checkpoint.

Bottom-navigation icon follow-up: Finds now uses the existing simple coin symbol, and Scanner uses the same scan-frame symbol as the scanner card. Labels, gray color, selected-glass movement, sizing and routes are unchanged. Mobile rendering and desktop SVG/computed colors were verified. No new tests were needed for this icon-only edit. Screenshot: review/finds-scanner-nav-icons.png.
