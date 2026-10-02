# Blue-purple glass theme — September 28, 2026

The user preferred the established layout over the exploratory signature redesign. Continue in soltech-ui. soltech-signature remains a separate, unfinished comparison and is not the selected product direction.

Implemented in one shared blue-glass.css layer, linked after the existing styles:
- Blue-purple frosted glass around Check a coin, matching reflective scanner edges and glass actions. Reading surfaces stay white.
- Soltech and top-heading period accents use the same blue-to-purple tint.
- Main navigation, report tabs and chart ranges have white/clear tracks; only their moving selected glass is tinted.
- Overview / Chart / Details and all five chart ranges now share a 300ms sliding highlight. Existing tab state, keyboard semantics, chart values and storage code are unchanged.
- Reduced motion disables sliding. Reduced transparency uses opaque surfaces. Forced colors preserves selection and a distinct keyboard focus outline.

Verification: browser inspection of desktop, 390px phone and 320px layout; no horizontal overflow. Invalid-address red styling and keyboard Clear/focus return were checked. A live Pumpoween lookup returned market/risk/history data. Report tabs and range controls inspected with actual data. Scanner preview opened by keyboard. The CSS review caught and fixed pseudo-element border sizing and accessibility fallback issues. No business-logic changes; the full automated suite was not rerun for CSS-only work. Reduced-motion/transparency/forced-colors rules were reviewed in source, not OS-emulated; no real-phone check or full accessibility audit.

Current screenshots: blue-glass-report-mobile.png and blue-glass-scanners-web.png. Prior checkpoint preserves the pre-theme app. User scanners, profile, preferences and drafts remain in the browser and are separate from ZIP files. No site publication, scanner service connection or provider setup change.