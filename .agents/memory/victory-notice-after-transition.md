---
name: Victory notice after dispute transitions
description: Preserve winner feedback when the current dispute changes to the next scheduled round.
---

A user who wins a dispute should see the victory modal and the prize amount belonging to their winning bid, even if the API has already advanced the shared auction to its next round.

**Why:** The user explicitly expects the winner to be notified and shown their prize; the shared server may move from an ended dispute directly to a scheduled next dispute before the client polls.

**How to apply:** Base the notice and redemption action on the signed-in user's won-bid record, not only the current auction phase or leader. Keep the modal open until the user dismisses it, and use that same winning bid's prize and ID.
