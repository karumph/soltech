# Soltech silver identity — September 29, 2026

## Direction

A separate comparison derived from the existing app. The unchanged dual-profile logo supplies contrast, connected forms and a small paired edge detail. Its faces and facets are not repeated as decoration across the interface.

The user's latest preference is silver rather than blue selection styling. Navigation and report controls use a silver moving highlight without a blue underline. Primary actions use a charcoal metallic fill; reading surfaces remain white. Personal avatar choices and meaningful warning/status colors retain their separate purpose.

## Shared rules

- White reading surfaces, charcoal text, cool gray dividers and restrained silver reflections.
- Clear system typography, deliberate spacing and moderate rounding; large headings identify the task, smaller labels organize evidence.
- Use a paired charcoal/silver seam sparingly on important identity and input areas.
- Keep input boundaries and keyboard focus visible. Errors restore a distinct red field boundary. Use text with all status colors.
- Navigation remains familiar. Motion belongs to selection and feedback, with reduced-motion, reduced-transparency and forced-color fallbacks.
- Choose layout by content: a coin report uses a metric ledger and disclosure sections; Scanner uses an identity row and rule list; Profile uses compact identity and shortcuts.
- Preserve established accessible labels, form hooks, validation, stored settings and cancellation behavior.

The final implementation is `dist/soltech-identity.css`, loaded after existing component styles. The earlier blue-glass stylesheet remains in the source for inherited layout and behavior; the final layer defines this comparison's look.

## Verification

- 152 automated tests passed, covering the existing data, storage, scanner, profile, crop and integration behavior. Later silver changes were CSS-only.
- Live Wrapped SOL lookup returned market and risk information; missing market cap remained unavailable, and an unconnected bundle service remained clearly marked.
- Overview / Chart / Details navigation, one-hour minute history, keyboard scrubbing, Clear and invalid-address feedback were checked in the rendered app.
- Profile Cancel retained the saved identity. Notification Save returned to Profile or Settings according to its entry route. About opened and dismissed with Escape.
- Combined scanner setup reached Review with both source rules. Save draft & exit, refresh and Continue restored the same unfinished source step. Save setup succeeded without implying live monitoring.
- Mobile frame and desktop were visually inspected. At 320px, Check, Scanner and Profile had no horizontal overflow. Control boundaries, focus and invalid styling were inspected.
- The original's 162 recorded files matched their SHA-256 baseline; the supplied logo is unchanged.

This was not a complete screen-reader or WCAG conformance audit, a physical iPhone test, or a native Liquid Glass implementation. The chart shows fetched history, not a continuous live stream. Scanner monitoring and alerts remain unconnected. No financial performance or risk-detection accuracy is inferred from visual polish.

## Files and follow-up

Current visual screenshots: `design-review/desktop-check-silver.png`, `design-review/mobile-check-silver.png`, `design-review/mobile-scanner-silver.png`, `design-review/mobile-profile-silver.png`. Other dated images are development history.

Compare this version with the original before choosing which to advance. Do not deploy using the inherited hosting identity. Browser-local user data is separate from the source backup, and comparison storage is isolated by port 4183.

## Follow-up: address decoration removed

The user found the two short charcoal/silver marks above Token address unclear. The checker form no longer renders those decorative marks. Its layout, input, Clear, lookup behavior and chart are unchanged. The paired detail elsewhere remains pending individual review.

## Follow-up: white and silver rim preview

The user chose theme refinement while keeping the existing composition. Check coin now has white-centered surfaces with fine silver rims, a silver Check coin button with dark text, and matching report tabs, range selectors and supporting controls. The light upper edge and darker lower edge echo the logo's silver planes without adding symbols or decoration. This is scoped to Check coin; the original app is untouched.

The chart plot, sizing, data, risk colors and report content remain unchanged. Rendered desktop and 390px layouts were checked. Invalid addresses retain the red boundary and keyboard focus remains visible; Clear restored the neutral border without changing field width. Current screenshots: `design-review/check-silver-rim-desktop.png` and `design-review/check-silver-rim-mobile.png`.

The user then requested removal of the Market / Ownership / Risk signals introductory summaries below the empty form. They are removed from both the initial and cleared states. Actual coin report sections are unchanged.

## Follow-up: cut corner on the earlier version

After reviewing the separate A3 version, the user asked for only the address field's cut corner on this earlier silver version. The joined address/Clear field now has a clipped upper-right corner with its existing thin neutral edge; error styling follows the same contour. The surrounding panel, white Check coin button, layout, chart and report styling remain as before. The separate soltech-a3 copy is unchanged by this follow-up.

The next selected change makes Check coin charcoal-black, inspired by the dark side of the logo, with white text and restrained shading. Its existing rounded shape remains intact, with no clipped corner. Only the submit button's paint changes; Clear and the address field retain the preceding treatment.

## Follow-up: clearer supporting text

Check coin's supporting text now uses a darker neutral with medium weight. Metric labels have a stronger charcoal tone; the privacy disclosure is 14px, and the smallest holder/source captions are 12px rather than 11px. Table headings are 13px. Headings and primary values retain their hierarchy. This is scoped to the checker; chart geometry, warning colors and disabled controls are unchanged.

Verified in the rendered desktop and mobile report: live lookup, report tabs and chart keyboard selection work, metadata is legible, and mobile has no horizontal overflow. The open AirPad report and selected chart time were restored after refreshing. Screenshots: `design-review/mobile-readable-labels.png` and `design-review/desktop-readable-labels.png`.

The user requested the smallest increase in silver depth on the outer search panel. Its surface gradient is now a few RGB levels darker, retaining the same rim, highlight, shadow, field and button.

## Follow-up: separate silver overview tiles and matching navigation

Price, market cap, liquidity and volume now have individual compact tiles with 10px gaps, subtle silver rims and the exact same surface gradient as the address panel. The main navigation container shares that gradient too, while retaining its sliding selected-tab highlight. Data, risk colors, and chart rendering are unchanged. The four-tile layout retains system-color borders in forced-colors mode.

Rendered mobile and desktop verified with a real coin report. At 320px, a small-screen 20px value size keeps the observed long price on one line, with no horizontal overflow. Navigation to Finds and back to Check works. Screenshots: `design-review/mobile-silver-metric-tiles.png` and `design-review/desktop-silver-metric-tiles.png`.

## Follow-up: clear moving glass and slightly deeper silver

The moving main-navigation, report-tab and chart-range highlights now use translucent white reflections, a fine bright edge and modest backdrop blur instead of an opaque silver fill. Text remains above the effect. The movement geometry and duration remain intact. Reduced transparency uses a solid white highlight; reduced motion removes the transition; forced colors retains system colors.

At the user's request, the shared silver surface was then darkened slightly to give these clear highlights more contrast. The search panel, individual metrics, main navigation, report-tab track and chart-range track share that surface. Mobile and desktop were visually checked; report tabs, chart ranges and main navigation were exercised successfully. This is a web glass effect, not native Apple Liquid Glass.

Latest screenshots: `design-review/mobile-clear-glass-silver-tracks.png` and `design-review/desktop-clear-glass-silver-tracks.png`.

## Follow-up: individual metric colors

The user then chose distinct colors for the four overview tiles instead of matching the silver panels: Price is soft blue, Market cap lilac, Liquidity aqua, and Volume muted rose. The same compact geometry and fine silver edges remain, with dark labels and values. These tints identify metrics, not performance or risk. Search, navigation, and report tracks keep their silver finish and clear moving highlights. The mobile and desktop live reports were visually verified. Latest metric screenshots: `design-review/mobile-individual-metric-colors.png` and `design-review/desktop-individual-metric-colors.png`.

## Selected refinement: M1 with soft corners — September 30

The user rejected the pastel palette, reviewed separate metric concepts, selected M1 (Fine outline), and asked to apply it directly. Their final correction specifies soft corners like the original M1 image, superseding the earlier sharp-corner interpretation. The four Overview metrics now use 12px rounded corners and thin neutral silver outlines with flat cool faces: Price #e6edf4, Market cap #fafbfc, Liquidity #e5e8ed, Volume #dae4ef. Labels and values retain the existing dark typography; spacing and responsive layout are preserved. This supersedes the pastel colors above. These shades identify metrics, not risk or performance.

Only the metric styling changed. Rendered mobile and desktop reports were checked with a live lookup; all four computed radii are now 12px. The bounded palette review found no override or contrast issues, and forced-colors retains system-color borders and faces. No new automated tests were needed for this CSS-only refinement. Current screenshots: `design-review/mobile-m1-soft-tiles.png` and `design-review/desktop-m1-soft-tiles.png`. Original and A3 versions remain separate; no deployment was performed.

## Latest: glass-style chart slider — September 30

The control beneath the chart now has a 34 by 26px translucent white pill handle, a reflective edge, and a 6px silver track. The native slider retains its 44px interaction height and original data/events. The plot and value calculations are unchanged. This is a CSS approximation inspired by Apple Liquid Glass, not a native Apple material. Reduced-transparency and forced-colors fallbacks are present; no motion was added. Backdrop blur can vary by browser.

Mobile and desktop were visually checked. Home, End and arrow keys update the selected time and value; pointer selection works. Bounded CSS review found no material issue. Physical iPhone testing has not been performed. Screenshots: `design-review/mobile-glass-chart-slider.png` and `design-review/desktop-glass-chart-slider.png`.

The user requested a pause after this change, then a fresh chat with saved progress. No further design edits are pending. Read `../SOLTECH-RESUME.txt` for the current handoff.
