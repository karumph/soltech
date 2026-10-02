# Personal profile and settings

Implemented in the local mobile and desktop previews.

- Profile supports an optional name, local photo upload/change/remove, and four avatar colors. The fallback is a defined white person silhouette in a circular silver-edged badge, not initials. Uploaded photos use the same circular format.
- Settings is in the top-right app header. About Soltech is inside Settings. Saved scanners remains within Profile and points to existing scanner/draft storage.
- Settings includes future notification preferences, per-scanner choices, an accurate explanation of current data handling, and an explicitly unpublished Terms page. No legal agreement, account, cloud sync, or live notification delivery has been invented.
- Photos are decoded, center-cropped and resized to a 256-pixel JPEG entirely in the browser. Inputs accept JPG/PNG/WebP up to 6 MB. Invalid formats, decode failures, oversized images and stale/cancelled jobs are handled without replacing the saved photo.
- Profile data uses a separate browser-storage key. Saves are transactional; failure leaves the prior saved version intact. Section saves merge with current storage and reject conflicting edits from another tab. Unsaved edits survive internal navigation; Save commits them, Cancel discards them. Unsaved changes trigger the browser's close/reload warning.

## Verification

All 112 automated tests pass. Twelve new profile tests cover persistence, scanner/draft isolation, cancellation semantics, quota failure and retry, corrupt storage, cross-tab merging/conflicts, validation, Unicode names, photo cancellation and decode errors. Final output is in `profile-test-results.txt`.

Browser walkthrough used an isolated local origin for test data. Verified name/color/photo save and reload, photo removal with Cancel, keyboard Save/Cancel and switches, persisted notification choices, cross-tab conflict and recovery, unsaved-edit recovery during internal navigation, privacy/terms/About routes, and Profile navigation selection. Saved photo decoded at 256 by 256 pixels.

Rendered mobile and desktop inspected; a 320-pixel viewport had no horizontal overflow. Keyboard avatar selection had a visible focus ring. Narrow editor controls remained usable. The temporary viewport override was reset. Reduced-motion behavior was checked in CSS, not via OS preference emulation. No formal screen-reader or complete WCAG certification was performed.

Main preview refreshed without restarting its server or changing user scanners/drafts/profile data. The temporary QA server was stopped. Provider credentials remain only in the existing server's memory. No hosted deployment was made.

Screenshots: `personal-profile-mobile.png`, `personal-profile-web.png`, `personal-settings-mobile.png`.

## Limits

Profiles and preferences are local to this browser and origin, not user accounts. Notification delivery still requires the live scanner service. Reviewed legal terms and a published privacy policy remain launch work. The project ZIP backs up implementation files; browser profile/scanner data is separate and is not included.
