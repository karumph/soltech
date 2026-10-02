# A3 cut-corner implementation

Selected reference: design-concepts/silver-explorations-2026-09-29/01-edge-studies.png, A3.

The theme is implemented as the last cascade layer in dist/a3-checker.css. Two SVG frame assets use nine-slice borders so the clipped corner retains its proportions on mobile and desktop. No image mockup is used as a control, and the input, Clear, network select, submit and tabs remain native functional elements. Check coin is below the address and optional network choice at every viewport.

The form's former outer frame is removed so the A3 address and button are the focal elements. No additional panels or features were added. Existing sliding report selection and reduced-motion behavior are preserved. High-contrast mode uses the inherited system controls. Invalid fields retain a red error cue plus a distinct keyboard-focus ring.

Verified: rendered phone and desktop views; invalid-address correction; Clear keeps the field width stable; EVM network chooser; a live BONK market/risk/history lookup; report tab selection. Application JavaScript is identical to the source comparison; only the final stylesheet link, style assets and preview labeling/default port differ. This is not a physical-phone or full screen-reader audit.

comparison-baseline.json records the source comparison's hashes at copy time. Existing versions are retained, with separate browser storage.