---
name: Inactive bid panel
description: Product behavior for the bid panel outside an active dispute.
---

Keep the bid panel and its bid action visible when a dispute is paused, upcoming, or ended. Disable the amount controls and the main bid action unless the dispute is live. Do not replace the bid action with a redemption action or add a separate notify-me action.

**Why:** The user asked for the bid panel to remain a disabled bidding element when the dispute is not running, without a notification button.

**How to apply:** Preserve redemption in its own prize flow. Tie bid-control enabled state to the live phase, not to whether the user won or the dispute ended.
