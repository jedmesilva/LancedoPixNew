---
name: Victory notice after dispute transitions
description: Preserve winner feedback when the current dispute changes to the next scheduled round.
---

A user who wins while the dispute page is open should see the victory modal and prize from that winning bid, even if the API has already advanced to its next round. Wins already present during initial page hydration are historical: do not reopen their modal after reload, and keep them available in “Meus lances.”

**Why:** The user wants immediate feedback for a new win but does not want past victories to interrupt every page reload.

**How to apply:** Seed the signed-in user's existing won-bid IDs as already shown on initial load or account change. Then show the modal only for a newly observed win during the active session; use that bid's prize and ID, and keep the modal open until dismissed. Do not use a time window alone to distinguish new from historical wins.
