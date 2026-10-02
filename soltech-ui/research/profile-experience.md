# A useful, compact Soltech profile

Reviewed September 28, 2026. This is a product-design recommendation, not evidence that engagement has increased.

## What was observed

The previous mobile profile gave most of its first screen to a large avatar, “Your space” and Edit. The saved-work link provided little information, and continuing a scanner draft required going through Saved. The editor also showed avatar colors while a photo covered them.

## Research and interpretation

- [NN/G: recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/) recommends making relevant information and choices visible so people need less memory. Applied here: display the actual draft name and active/inactive saved counts beside the relevant actions.
- [NN/G: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends prioritizing common choices and revealing less-used controls when relevant. Applied here: keep identity editing on its existing page, settings behind the gear, and hide avatar colors when a photo makes them irrelevant.
- [YouTube: the You tab](https://support.google.com/youtube/answer/9209643?hl=en-GB) groups personal collections and activity with account-related information. This supports the idea of a personal utility area. Soltech uses its existing saved scanners and draft, not unrelated social or trading statistics.
- [Phantom: profile management](https://help.phantom.com/articles/manage-your-profile-in-phantom-12977712693523) puts avatar and username changes in profile management. Its public trading/social profile serves a different purpose from Soltech’s local preview. Follower counts, PnL, verification, and connected social accounts were not copied.

Apple’s Settings page was located, but its full body was not readable through the web tool. The implementation does not rely on uninspected Apple guidance.

## Implemented decisions

- Compact horizontal identity row, 56px circular avatar and small Edit action. The larger avatar remains in the editor where it helps photo review.
- Saved scanners shows real placement counts. These reflect the UI’s saved state; scanner monitoring is still not connected.
- Continue draft is a distinct entry on Profile, shown only when a scanner draft exists. Its duplicate entry inside Saved is removed. The editor’s back link now returns to Profile while retaining the draft.
- Notification preferences have a direct shortcut, explicitly labeled as not connected to live alerts.
- General settings stay in the top-right gear. Existing identity Save/Cancel, local storage, conflict recovery and legal notices remain intact.
- A photo hides the avatar-color controls. Removing it reveals the remembered color. No extra “Custom” mode is needed.
- Names wrap on narrow screens. Main actions keep comfortable touch targets and existing keyboard focus styles.

## What still needs real-user testing

Can a first-time user find a saved scanner, resume a draft, and change a photo without help? Does Profile feel sufficiently personal with these useful shortcuts, or would a future saved-coins feature be valuable? Do not add that feature solely to fill blank space. Live notification delivery, account sync and X linking remain separate work.
