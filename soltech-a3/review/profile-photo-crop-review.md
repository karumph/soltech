# Profile photo positioning and matching scanner badges

The profile photo picker now opens an adjustment dialog before changing the unsaved profile preview. A circular mask shows the final avatar crop. Drag repositions the image; a two-finger pinch changes zoom and keeps the photo point under the fingers. Reset restores the initial crop. On mobile, arrows and the zoom slider are collapsed under More controls; desktop opens those alternatives. Keyboard arrows and plus/minus also work.

Use photo updates only the pending profile edit. Save changes persists it through the existing transactional profile store. Cancel or Escape in the crop keeps the previous photo. Cancel in Edit profile keeps the last saved identity. Only a compact cropped JPEG is stored; the original image is released, so changing an already saved crop requires selecting the original photo again.

Custom scanners now use the same cut-corner badge, diagonal silver detail and white symbol treatment as the library scanners. The existing custom scanner symbol and all stored rules remain unchanged.

## Verification

- All 120 automated tests passed; output in profile-photo-crop-tests.txt. New checks cover crop bounds, off-center zoom, a moving pinch midpoint, zoom limits, image release and oversized decoded images.
- Syntax checks passed for app, profile, profile store and crop modules.
- Browser inspection covered desktop and a narrow 320px phone viewport. The mobile dialog fits, has no horizontal overflow, and initially hides the slider and arrows. More controls exposes working keyboard controls.
- Mouse dragging, keyboard zoom, Use photo, crop Escape/Cancel, and main editor Cancel were exercised. The preview and export use the same source rectangle. The existing user profile and scanners were not overwritten for testing.
- An independent code review found no issues with two-pointer transitions, crop anchoring, resource cleanup, focus restoration, or cancellation.
- Actual two-finger gestures on a physical phone and a full screen-reader audit have not been tested. No new animation was added.

Screenshots: profile-photo-crop-mobile.png and custom-scanner-badge-mobile.png.

The main preview server was not restarted. The updated mobile preview uses the regular port 4175. An existing profile-edit tab on 4177 and an older mobile tab have pending edits, so they were left intact rather than refreshed. Browser-local profile/scanner values and unsaved tab edits are separate from project backups. The bundled-data key stays only in the server's memory. The hosted Site was not published.
