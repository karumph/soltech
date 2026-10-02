# Compact profile verification

September 28, 2026. Changes: profile home layout, conditional avatar-color visibility, and draft navigation/presentation. No storage schema or live-data connection changes.

All 112 automated tests passed; see profile-compact-test-results.txt. Syntax checks passed for app.js and profile.js.

Browser: standard fixed phone frame and desktop inspected. At 320px, long unbroken identity and draft names wrap without horizontal overflow. Main identity editing, Save/Cancel and draft links worked. Existing photo hides Avatar color; Remove shows the remembered Violet choice on the isolated test profile; Cancel restores the photo and hides the colors again. Saved list contains scanner cards only, and the draft remains reachable through Profile. No-draft Profile omits Continue draft.

The separate test origin on port 4177 was used for saved profile and draft mutations. User records on 4175 were not seeded or replaced. The main server was not restarted. Local screenshots are profile-compact-mobile.png and profile-compact-web.png.

No full WCAG, native-device, screen-reader or notification delivery audit is claimed. Notifications remain unconnected. No new motion is introduced. Research rationale and assumptions needing user tests are in ../research/profile-experience.md.
